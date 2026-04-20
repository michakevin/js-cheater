/* global DecompressionStream, CompressionStream */
/**
 * Save-Game-Editor for RPG Maker MV/MZ saves.
 *
 * RPG Maker MV stores save data in localStorage under keys like
 * "RPG File1", "RPG File2", etc. compressed with LZString.compressToBase64.
 *
 * RPG Maker MZ stores save data in IndexedDB via localforage with keys
 * like "rmmzsave.<gameId>.file0", compressed with pako/zlib (deflate).
 *
 * This editor decompresses, parses, and renders the JSON as an editable
 * tree. Changed values are re-compressed and written back.
 */

import { compressToBase64, decompressFromBase64 } from "./lz-string.js";

// ---- Communication helpers ----
// This page is opened as a popup/window from the extension sidebar.
// It communicates with the active tab through chrome.tabs.sendMessage,
// the same way the main popup does.

let activeTabId = null;

/**
 * @returns {Promise<chrome.tabs.Tab|null>}
 */
async function getActiveTab() {
  // If tabId was passed via URL params, always use that.
  // The save-editor runs in its own window, so tabs.query would
  // return the editor's own tab instead of the game tab.
  if (activeTabId) {
    return { id: activeTabId };
  }
  return null;
}

/**
 * @param {number} tabId
 * @param {object} message
 * @returns {Promise<*>}
 */
async function sendTabMessage(tabId, message) {
  if (!chrome?.tabs?.sendMessage) {
    throw new Error("tabs.sendMessage ist nicht verfügbar");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (err, r) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve(r);
    };
    const cb = (r) => {
      const e = chrome.runtime?.lastError;
      e ? settle(new Error(e.message || String(e))) : settle(null, r);
    };
    try {
      const p = chrome.tabs.sendMessage(tabId, message, cb);
      if (p && typeof p.then === "function") {
        p.then((r) => settle(null, r)).catch((e) => settle(e));
      }
    } catch (e) {
      settle(e);
    }
  });
}

/**
 * @param {string} cmd
 * @param {object} extra
 * @returns {Promise<*>}
 */
async function send(cmd, extra = {}) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("Kein aktiver Tab gefunden");
  return sendTabMessage(tab.id, { cmd, ...extra });
}

// ---- State ----
let currentSlotKey = "";
/** @type {"localStorage"|"indexedDB"|""} */
let currentSlotSource = "";
let editorData = null;
let hasChanges = false;

/**
 * Cache of slot data from the last getRpgMakerSaves call.
 * Maps "key" → { key, source, raw }.
 * @type {Map<string, {key: string, source: string, raw: string}>}
 */
const slotCache = new Map();

// DOM references
const $ = (sel) => document.querySelector(sel);

function resetLoadedSlotState() {
  currentSlotKey = "";
  currentSlotSource = "";
  editorData = null;
  hasChanges = false;
}

function getSaveErrorMessage(result) {
  return (
    result?.error ||
    result?.message ||
    "Unbekannter Fehler beim Speichern."
  );
}

// ---- RPG Maker save key detection ----

/**
 * Detect RPG Maker save slots from the getRpgMakerSaves response.
 * Accepts either the new format { slots: [{key, source, raw}] } or a
 * legacy localStorage object { "RPG File1": "data", … }.
 * @param {object} input
 * @returns {Array<{key: string, source: string, raw: string}>}
 */
export function detectSaveSlots(input) {
  if (!input || typeof input !== "object") return [];

  // New format: { slots: [{key, source, raw}] }
  if (Array.isArray(input.slots)) {
    return [...input.slots].sort(slotSorter);
  }

  // Legacy format: plain object of localStorage key→value
  return Object.keys(input)
    .filter((key) => /^RPG\s+(File\d+|Global)$/i.test(key))
    .map((key) => ({ key, source: "localStorage", raw: input[key] }))
    .sort(slotSorter);
}

/**
 * Sort comparator for save slots: global/config first, then numeric.
 * @param {{key: string}} a
 * @param {{key: string}} b
 * @returns {number}
 */
function slotSorter(a, b) {
  const aGlobal = /global|config/i.test(a.key) ? 0 : 1;
  const bGlobal = /global|config/i.test(b.key) ? 0 : 1;
  if (aGlobal !== bGlobal) return aGlobal - bGlobal;
  return a.key.localeCompare(b.key, undefined, { numeric: true });
}

/**
 * Try to decode an RPG Maker save string.
 * Attempts (in order):
 * 1. LZString.decompressFromBase64 → JSON.parse (RPG Maker MV)
 * 2. pako/zlib inflate via DecompressionStream (RPG Maker MZ)
 * 3. Plain JSON.parse (uncompressed saves)
 * @param {string} raw
 * @returns {Promise<{ data: *, json: string, format: string } | null>}
 */
export async function decodeSaveData(raw) {
  if (!raw || typeof raw !== "string") return null;

  // 1) LZString decompression (RPG Maker MV standard)
  try {
    const decompressed = decompressFromBase64(raw);
    if (decompressed) {
      const data = JSON.parse(decompressed);
      return { data, json: decompressed, format: "lzstring" };
    }
  } catch {
    /* not LZString compressed */
  }

  // 2) pako/zlib inflate (RPG Maker MZ standard)
  //    MZ uses pako.deflate(json, {to:"string", level:1}) which produces
  //    a zlib-format binary string stored in IndexedDB.
  try {
    const inflated = await inflateBinaryString(raw);
    if (inflated) {
      const data = JSON.parse(inflated);
      return { data, json: inflated, format: "zlib" };
    }
  } catch {
    /* not zlib compressed */
  }

  // 3) Plain JSON (some games store uncompressed)
  try {
    const data = JSON.parse(raw);
    return { data, json: raw, format: "json" };
  } catch {
    /* not valid JSON either */
  }

  return null;
}

/**
 * Inflate a binary string produced by pako.deflate({to:"string"}).
 * Uses the browser's built-in DecompressionStream API.
 * @param {string} binaryStr
 * @returns {Promise<string|null>}
 */
async function inflateBinaryString(binaryStr) {
  if (typeof DecompressionStream === "undefined") return null;
  if (!binaryStr || binaryStr.length < 2) return null;

  // Check for zlib header (first byte 0x78 = deflate, CMF)
  const b0 = binaryStr.charCodeAt(0);
  if (b0 !== 0x78) return null;

  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i) & 0xff;
  }

  const ds = new DecompressionStream("deflate");
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const reader = readable.pipeThrough(ds).getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

/**
 * Deflate a JSON string to pako-compatible zlib binary string.
 * Uses the browser's built-in CompressionStream API.
 * @param {string} json
 * @returns {Promise<string>}
 */
async function deflateToBinaryString(json) {
  const encoded = new TextEncoder().encode(json);
  const cs = new CompressionStream("deflate");
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });

  const reader = readable.pipeThrough(cs).getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert back to binary string (matching pako's {to:"string"} output)
  let str = "";
  for (let i = 0; i < result.length; i++) {
    str += String.fromCharCode(result[i]);
  }
  return str;
}

/**
 * Encode save data back to the storage format.
 * @param {*} data
 * @param {string} format - "lzstring", "zlib", or "json"
 * @returns {Promise<string>}
 */
export async function encodeSaveData(data, format) {
  const json = JSON.stringify(data);
  if (format === "lzstring") return compressToBase64(json);
  if (format === "zlib") return deflateToBinaryString(json);
  return json;
}

// ---- Tree rendering ----

/** @type {Set<string>} */
const collapsedPaths = new Set();

/**
 * Category mapping for top-level RPG Maker keys.
 * @param {string} key
 * @returns {{ icon: string, label: string }}
 */
function getCategoryInfo(key) {
  const categories = {
    party: { icon: "👥", label: "Party" },
    actors: { icon: "🧙", label: "Helden" },
    map: { icon: "🗺️", label: "Karte" },
    player: { icon: "🚶", label: "Spieler" },
    switches: { icon: "🔘", label: "Schalter" },
    variables: { icon: "📊", label: "Variablen" },
    selfSwitches: { icon: "🔲", label: "Selbst-Schalter" },
    items: { icon: "🎒", label: "Items" },
    system: { icon: "⚙️", label: "System" },
    screen: { icon: "📺", label: "Bildschirm" },
    timer: { icon: "⏱️", label: "Timer" },
    message: { icon: "💬", label: "Nachrichten" },
    temp: { icon: "🔄", label: "Temporär" },
    troop: { icon: "⚔️", label: "Truppen" },
  };

  const lower = key.replace(/^\$game/, "").toLowerCase();
  return categories[lower] || { icon: "📄", label: key };
}

/**
 * Render a JSON value as a displayable string.
 * @param {*} value
 * @returns {{ text: string, className: string }}
 */
function renderValue(value) {
  if (value === null) return { text: "null", className: "json-value-null" };
  if (value === undefined)
    return { text: "undefined", className: "json-value-null" };

  const type = typeof value;
  if (type === "boolean")
    return { text: String(value), className: "json-value-boolean" };
  if (type === "number")
    return { text: String(value), className: "json-value-number" };
  if (type === "string") {
    const display = value.length > 60 ? value.substring(0, 57) + "…" : value;
    return {
      text: JSON.stringify(display),
      className: "json-value-string",
    };
  }
  return { text: String(value), className: "" };
}

/**
 * Count entries in an object/array.
 * @param {*} value
 * @returns {string}
 */
function summarize(value) {
  if (Array.isArray(value)) {
    const nonNull = value.filter((v) => v !== null && v !== undefined).length;
    return `Array [${nonNull}/${value.length}]`;
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    return `Object {${keys.length}}`;
  }
  return "";
}

/**
 * Build a tree node for a JSON key-value pair.
 * @param {string} key
 * @param {*} value
 * @param {string} path
 * @param {function} onValueChange
 * @returns {HTMLElement}
 */
function buildTreeNode(key, value, path, onValueChange) {
  const isExpandable = value !== null && typeof value === "object";
  const row = document.createElement("div");
  row.className = "json-key-row";
  row.dataset.path = path;

  if (isExpandable) {
    const toggle = document.createElement("span");
    toggle.className = "json-toggle";
    const collapsed = collapsedPaths.has(path);
    toggle.textContent = collapsed ? "▶" : "▼";
    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "json-toggle";
    spacer.textContent = "";
    row.appendChild(spacer);
  }

  const keySpan = document.createElement("span");
  keySpan.className = "json-key";
  keySpan.textContent = key;
  row.appendChild(keySpan);

  const sep = document.createElement("span");
  sep.className = "json-separator";
  sep.textContent = ":";
  row.appendChild(sep);

  if (isExpandable) {
    const bracket = document.createElement("span");
    bracket.className = "json-bracket";
    bracket.textContent = Array.isArray(value) ? "[" : "{";
    row.appendChild(bracket);

    const summary = document.createElement("span");
    summary.className = "json-summary";
    summary.textContent = " " + summarize(value);
    row.appendChild(summary);
  } else {
    const { text, className } = renderValue(value);
    const valSpan = document.createElement("span");
    valSpan.className = "json-value " + className;
    valSpan.textContent = text;
    valSpan.title = "Doppelklick zum Bearbeiten";
    row.appendChild(valSpan);

    // Double-click to edit (use property to avoid listener accumulation)
    valSpan.ondblclick = () => {
      startEditing(valSpan, value, path, onValueChange);
    };
  }

  const container = document.createElement("div");
  container.className = "json-node";
  container.appendChild(row);

  if (isExpandable) {
    const childContainer = document.createElement("div");
    childContainer.className =
      "json-children" + (collapsedPaths.has(path) ? " collapsed" : "");

    const entries = Array.isArray(value)
      ? value.map((v, i) => [String(i), v])
      : Object.entries(value);

    for (const [childKey, childValue] of entries) {
      const childPath = path + "." + childKey;
      childContainer.appendChild(
        buildTreeNode(childKey, childValue, childPath, onValueChange),
      );
    }

    // Closing bracket
    const closingRow = document.createElement("div");
    closingRow.className = "json-key-row";
    const closingBracket = document.createElement("span");
    closingBracket.className = "json-bracket";
    closingBracket.style.marginLeft = "18px";
    closingBracket.textContent = Array.isArray(value) ? "]" : "}";
    closingRow.appendChild(closingBracket);
    childContainer.appendChild(closingRow);

    container.appendChild(childContainer);

    // Toggle click
    const toggleEl = row.querySelector(".json-toggle");
    if (toggleEl) {
      const toggleFn = () => {
        const isCollapsed = childContainer.classList.toggle("collapsed");
        toggleEl.textContent = isCollapsed ? "▶" : "▼";
        if (isCollapsed) {
          collapsedPaths.add(path);
        } else {
          collapsedPaths.delete(path);
        }
      };
      toggleEl.addEventListener("click", toggleFn);
      // Also allow clicking the key to toggle
      keySpan.style.cursor = "pointer";
      keySpan.addEventListener("click", toggleFn);
    }
  }

  return container;
}

/**
 * Start inline editing of a value.
 * @param {HTMLElement} valSpan
 * @param {*} currentValue
 * @param {string} path
 * @param {function} onValueChange
 */
function startEditing(valSpan, currentValue, path, onValueChange) {
  // Don't allow nested editing
  if (valSpan.querySelector("input")) return;

  const input = document.createElement("input");
  input.className = "json-edit-input";
  input.type = "text";

  // Show raw value for editing
  if (typeof currentValue === "string") {
    input.value = currentValue;
    input.dataset.wasString = "true";
  } else {
    input.value = currentValue === null ? "null" : String(currentValue);
    input.dataset.wasString = "false";
  }

  const originalText = valSpan.textContent;
  const originalClasses = valSpan.className;
  valSpan.textContent = "";
  valSpan.appendChild(input);
  input.focus();
  input.select();

  /**
   * @param {boolean} save
   */
  function finishEditing(save) {
    if (!input.parentNode) return;

    if (save) {
      const raw = input.value;
      let newValue;

      // Parse the value
      if (raw === "null") {
        newValue = null;
      } else if (raw === "true") {
        newValue = true;
      } else if (raw === "false") {
        newValue = false;
      } else if (
        raw !== "" &&
        !isNaN(Number(raw)) &&
        input.dataset.wasString !== "true"
      ) {
        newValue = Number(raw);
      } else {
        // Keep as string
        newValue = raw;
      }

      // Update display
      const { text, className } = renderValue(newValue);
      valSpan.className =
        "json-value " +
        className +
        (newValue !== currentValue ? " modified" : "");
      valSpan.textContent = text;
      valSpan.title = "Doppelklick zum Bearbeiten";

      // Re-attach dblclick (use property to avoid listener accumulation)
      valSpan.ondblclick = () => {
        startEditing(valSpan, newValue, path, onValueChange);
      };

      if (newValue !== currentValue) {
        onValueChange(path, newValue);
      }
    } else {
      // Cancel – restore original
      valSpan.className = originalClasses;
      valSpan.textContent = originalText;
      valSpan.title = "Doppelklick zum Bearbeiten";
      valSpan.ondblclick = () => {
        startEditing(valSpan, currentValue, path, onValueChange);
      };
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEditing(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishEditing(false);
    }
  });

  input.addEventListener("blur", () => {
    finishEditing(true);
  });
}

/**
 * Set a value at a dotted path in an object.
 * @param {*} obj
 * @param {string} path – dot-separated like "root.actors.1._hp"
 * @param {*} value
 */
function setAtPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (Array.isArray(current)) {
      current = current[parseInt(key, 10)];
    } else {
      current = current[key];
    }
    if (current === null || current === undefined) return;
  }
  const lastKey = parts[parts.length - 1];
  if (Array.isArray(current)) {
    current[parseInt(lastKey, 10)] = value;
  } else {
    current[lastKey] = value;
  }
}

// ---- Main render function ----

/** @type {string} */
let saveFormat = "json";

/**
 * Render the full JSON tree into the editor.
 * @param {*} data
 */
function renderEditor(data) {
  const container = $("#editorContent");
  if (!container) return;
  container.innerHTML = "";

  if (!data || typeof data !== "object") {
    container.innerHTML = `
      <div class="empty-state">
        <p>⚠️ Daten konnten nicht als Objekt interpretiert werden.</p>
      </div>`;
    return;
  }

  const searchBar = $("#searchBar");
  if (searchBar) searchBar.classList.remove("hidden");

  const tree = document.createElement("div");
  tree.className = "json-tree";

  const entries = Object.entries(data);

  for (const [key, value] of entries) {
    const category = getCategoryInfo(key);
    const isExpandable = value !== null && typeof value === "object";

    if (isExpandable) {
      // Render as category
      const catHeader = document.createElement("div");
      catHeader.className = "category-header";
      catHeader.dataset.path = key;

      const catToggle = document.createElement("span");
      catToggle.className = "category-toggle";
      catToggle.textContent = "▼";

      const catIcon = document.createElement("span");
      catIcon.className = "category-icon";
      catIcon.textContent = category.icon;

      const catName = document.createElement("span");
      catName.className = "category-name";
      catName.textContent = category.label;

      const catCount = document.createElement("span");
      catCount.className = "category-count";
      catCount.textContent = summarize(value);

      catHeader.appendChild(catToggle);
      catHeader.appendChild(catIcon);
      catHeader.appendChild(catName);
      catHeader.appendChild(catCount);

      const catChildren = document.createElement("div");
      catChildren.className = "category-children";

      const childEntries = Array.isArray(value)
        ? value.map((v, i) => [String(i), v])
        : Object.entries(value);

      for (const [childKey, childValue] of childEntries) {
        const childPath = key + "." + childKey;
        const node = buildTreeNode(
          childKey,
          childValue,
          childPath,
          (path, newVal) => {
            setAtPath(editorData, path, newVal);
            markChanged();
          },
        );
        node.classList.add("top-level");
        catChildren.appendChild(node);
      }

      catHeader.addEventListener("click", () => {
        const collapsed = catChildren.classList.toggle("collapsed");
        catToggle.textContent = collapsed ? "▶" : "▼";
      });

      tree.appendChild(catHeader);
      tree.appendChild(catChildren);
    } else {
      // Render as simple node
      const node = buildTreeNode(key, value, key, (path, newVal) => {
        setAtPath(editorData, path, newVal);
        markChanged();
      });
      node.classList.add("top-level");
      tree.appendChild(node);
    }
  }

  container.appendChild(tree);
}

function markChanged() {
  hasChanges = true;
  const saveBtn = $("#saveChanges");
  if (saveBtn) saveBtn.disabled = false;
}

function showStatus(message, type = "info") {
  const el = $("#statusMessage");
  if (!el) return;
  el.textContent = message;
  el.className = "status-message status-" + type;
  el.classList.remove("hidden");
  if (type === "success") {
    setTimeout(() => el.classList.add("hidden"), 3000);
  }
}

function hideStatus() {
  const el = $("#statusMessage");
  if (el) el.classList.add("hidden");
}

// ---- Slot loading ----

async function loadSlots() {
  const select = /** @type {HTMLSelectElement} */ ($("#slotSelect"));
  if (!select) return;

  select.innerHTML = '<option value="">⏳ Lade Slots…</option>';
  slotCache.clear();

  try {
    const result = await send("getRpgMakerSaves");
    if (!result) {
      select.innerHTML = '<option value="">❌ Keine Daten</option>';
      return;
    }

    const slots = detectSaveSlots(result);
    if (slots.length === 0) {
      select.innerHTML =
        '<option value="">❌ Keine RPG Maker Saves gefunden</option>';
      return;
    }

    // Populate cache
    for (const slot of slots) {
      slotCache.set(slot.key, slot);
    }

    select.innerHTML = '<option value="">– Slot wählen –</option>';
    for (const slot of slots) {
      const opt = document.createElement("option");
      opt.value = slot.key;
      const sourceLabel = slot.source === "indexedDB" ? " (IndexedDB)" : "";
      opt.textContent = slot.key + sourceLabel;
      select.appendChild(opt);
    }
  } catch (e) {
    select.innerHTML = `<option value="">❌ Fehler: ${e.message}</option>`;
  }
}

async function loadSlotData(key) {
  if (!key) {
    resetLoadedSlotState();

    const container = $("#editorContent");
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📂 Kein Speicherslot ausgewählt.</p>
          <p class="text-secondary">Wähle oben einen Slot aus, um die Speicherdaten zu bearbeiten.</p>
        </div>`;
    }
    const searchBar = $("#searchBar");
    if (searchBar) searchBar.classList.add("hidden");
    const saveBtn = $("#saveChanges");
    if (saveBtn) saveBtn.disabled = true;
    hideStatus();
    return;
  }

  showStatus("⏳ Lade " + key + "…", "info");

  try {
    const slot = slotCache.get(key);
    if (!slot || !slot.raw) {
      showStatus("❌ Slot nicht gefunden: " + key, "error");
      return;
    }

    const decoded = await decodeSaveData(slot.raw);

    if (!decoded) {
      showStatus("❌ Save-Daten konnten nicht dekodiert werden.", "error");
      return;
    }

    currentSlotKey = key;
    currentSlotSource = slot.source;
    editorData = decoded.data;
    saveFormat = decoded.format;

    const saveBtn = $("#saveChanges");
    if (saveBtn) saveBtn.disabled = true;

    collapsedPaths.clear();
    renderEditor(editorData);
    hideStatus();
  } catch (e) {
    showStatus("❌ Fehler beim Laden: " + e.message, "error");
  }
}

async function saveChanges() {
  if (!currentSlotKey || !editorData || !hasChanges) return;

  showStatus("⏳ Speichere…", "info");

  try {
    const encoded = await encodeSaveData(editorData, saveFormat);

    const saveResult = await send("setRpgMakerSave", {
      key: currentSlotKey,
      source: currentSlotSource,
      raw: encoded,
    });

    if (!saveResult || saveResult.success !== true) {
      throw new Error(getSaveErrorMessage(saveResult));
    }

    // Update cached raw data
    const cached = slotCache.get(currentSlotKey);
    if (cached) cached.raw = encoded;

    hasChanges = false;
    const saveBtn = $("#saveChanges");
    if (saveBtn) saveBtn.disabled = true;

    showStatus(
      "✅ " +
        currentSlotKey +
        " gespeichert! Lade das Spiel neu, um die Änderungen zu sehen.",
      "success",
    );
  } catch (e) {
    showStatus("❌ Fehler beim Speichern: " + e.message, "error");
  }
}

// ---- Search ----

let searchTimeout = null;

function setupSearch() {
  const input = /** @type {HTMLInputElement} */ ($("#searchInput"));
  const countEl = $("#searchCount");
  if (!input) return;

  input.addEventListener("input", () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(input.value.trim(), countEl);
    }, 200);
  });
}

/**
 * @param {string} query
 * @param {HTMLElement|null} countEl
 */
function performSearch(query, countEl) {
  const allRows = document.querySelectorAll(".json-key-row");

  if (!query) {
    allRows.forEach((row) => {
      row.style.display = "";
    });
    if (countEl) countEl.textContent = "";
    return;
  }

  const lower = query.toLowerCase();
  let matchCount = 0;

  allRows.forEach((row) => {
    const keyEl = row.querySelector(".json-key");
    const valEl = row.querySelector(".json-value");
    const keyText = keyEl?.textContent?.toLowerCase() || "";
    const valText = valEl?.textContent?.toLowerCase() || "";

    const matches = keyText.includes(lower) || valText.includes(lower);
    row.style.display = "";

    if (matches) {
      matchCount++;
      // Auto-expand parent containers
      let parent = row.parentElement;
      while (parent) {
        if (
          parent.classList.contains("json-children") &&
          parent.classList.contains("collapsed")
        ) {
          parent.classList.remove("collapsed");
          const prev = parent.previousElementSibling;
          if (prev) {
            const toggle = prev.querySelector(".json-toggle");
            if (toggle) toggle.textContent = "▼";
          }
        }
        if (
          parent.classList.contains("category-children") &&
          parent.classList.contains("collapsed")
        ) {
          parent.classList.remove("collapsed");
          const prev = parent.previousElementSibling;
          if (prev) {
            const toggle = prev.querySelector(".category-toggle");
            if (toggle) toggle.textContent = "▼";
          }
        }
        parent = parent.parentElement;
      }
    }
  });

  if (countEl) {
    countEl.textContent = matchCount + " Treffer";
  }
}

// ---- Expand/Collapse All ----

function expandAll() {
  collapsedPaths.clear();
  document.querySelectorAll(".json-children.collapsed").forEach((el) => {
    el.classList.remove("collapsed");
  });
  document.querySelectorAll(".category-children.collapsed").forEach((el) => {
    el.classList.remove("collapsed");
  });
  document.querySelectorAll(".json-toggle").forEach((el) => {
    if (el.textContent === "▶") el.textContent = "▼";
  });
  document.querySelectorAll(".category-toggle").forEach((el) => {
    if (el.textContent === "▶") el.textContent = "▼";
  });
}

function collapseAll() {
  document.querySelectorAll(".json-children").forEach((el) => {
    el.classList.add("collapsed");
    const path = el.previousElementSibling?.dataset?.path;
    if (path) collapsedPaths.add(path);
  });
  document.querySelectorAll(".category-children").forEach((el) => {
    el.classList.add("collapsed");
  });
  document.querySelectorAll(".json-toggle").forEach((el) => {
    if (el.textContent === "▼") el.textContent = "▶";
  });
  document.querySelectorAll(".category-toggle").forEach((el) => {
    if (el.textContent === "▼") el.textContent = "▶";
  });
}

// ---- Receive tabId from opener ----

function receiveTabId() {
  // The opener passes the tabId via URL search params
  const params = new URLSearchParams(window.location.search);
  const tabIdParam = params.get("tabId");
  if (tabIdParam) {
    activeTabId = parseInt(tabIdParam, 10);
  }
}

// ---- Init ----

document.addEventListener("DOMContentLoaded", () => {
  receiveTabId();

  const select = /** @type {HTMLSelectElement} */ ($("#slotSelect"));
  if (select) {
    select.addEventListener("change", () => {
      loadSlotData(select.value);
    });
  }

  const refreshBtn = $("#refreshSlots");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadSlots());
  }

  const saveBtn = $("#saveChanges");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => saveChanges());
  }

  const expandBtn = $("#expandAll");
  if (expandBtn) {
    expandBtn.addEventListener("click", expandAll);
  }

  const collapseBtn = $("#collapseAll");
  if (collapseBtn) {
    collapseBtn.addEventListener("click", collapseAll);
  }

  setupSearch();
  loadSlots();
});
