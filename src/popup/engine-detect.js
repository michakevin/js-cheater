/**
 * Engine detection UI module.
 *
 * Sends a "detectEngine" command via the content-script bridge,
 * displays the result in the search tab, and wires preset buttons
 * to either fill the search form or directly poke known paths.
 */

import { send, getActiveTab } from "./communication.js";
import { $ } from "./utils.js";
import { getPresetsForEngine } from "./engine-presets.js";
import { showError, showSuccess, showInfo } from "./messages.js";
import { showDialog } from "./dialog.js";
import { saveFavorite } from "./favorites.js";

const ENGINE_COLLAPSE_KEY_PREFIX = "engine_collapsed_";

let lastDetectedEngine = null;
let lastRawResult = null;

/**
 * Ask the page-context scanner to detect the game engine.
 * @returns {Promise<{id:string,name:string}|null>}
 */
export async function detectEngine() {
  const result = await send("detectEngine");
  if (result && result.id) {
    lastDetectedEngine = result;
    return result;
  }
  // Store raw result for debugging
  lastDetectedEngine = null;
  lastRawResult = result;
  return null;
}

/**
 * @returns {*} The raw result from last detection attempt (for debugging).
 */
export function getLastRawResult() {
  return lastRawResult;
}

/**
 * @returns {object|null} The last detection result.
 */
export function getLastDetection() {
  return lastDetectedEngine;
}

/**
 * Run detection and render the preset panel.
 * @param {string} [containerId="enginePresets"] – DOM id of the target container
 * Safe to call multiple times – rebuilds the UI each time.
 */
export async function detectAndShowPresets(containerId = "enginePresets") {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  container.classList.add("hidden");

  const engine = await detectEngine();
  // Reflect detection on body so responsive CSS (e.g. inline Editor tab)
  // and other UI elements can react to the active engine family.
  document.body.classList.toggle(
    "engine-rpgmaker",
    Boolean(engine?.id && engine.id.startsWith("rpgmaker")),
  );
  if (!engine) {
    // No engine detected – keep container hidden, show nothing
    return;
  }

  const preset = getPresetsForEngine(engine.id);
  if (!preset) return;

  container.classList.remove("hidden");
  renderPresetPanel(container, preset);
}

/**
 * Get the domain key for collapse state storage.
 * @returns {Promise<string>}
 */
async function getCollapseKey() {
  try {
    const tab = await getActiveTab();
    if (tab?.url) {
      const origin = new URL(tab.url).origin;
      if (origin && origin !== "null") {
        return ENGINE_COLLAPSE_KEY_PREFIX + origin;
      }
    }
  } catch {
    /* ignore */
  }
  return ENGINE_COLLAPSE_KEY_PREFIX + "unknown";
}

/**
 * Check whether engine panel is collapsed for current domain.
 * @returns {Promise<boolean>}
 */
async function isCollapsedForDomain() {
  const key = await getCollapseKey();
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * Save collapse state for current domain.
 * @param {boolean} collapsed
 */
async function setCollapsedForDomain(collapsed) {
  const key = await getCollapseKey();
  try {
    if (collapsed) {
      localStorage.setItem(key, "1");
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

function renderPresetPanel(container, preset) {
  // Collapsible header
  const header = document.createElement("div");
  header.className = "engine-header engine-header-toggle";
  header.setAttribute("role", "button");
  header.setAttribute("tabindex", "0");
  header.innerHTML = `<span class="engine-toggle-arrow">▼</span> <span class="engine-icon">${preset.icon}</span> <strong>${preset.name}</strong> erkannt`;
  container.appendChild(header);

  // Collapsible body wrapping description + presets
  const body = document.createElement("div");
  body.className = "engine-body";

  // Description
  const desc = document.createElement("div");
  desc.className = "engine-description";
  desc.textContent = preset.description;
  body.appendChild(desc);

  // Group presets by category
  const groups = groupBy(preset.presets, "category");

  for (const [category, items] of Object.entries(groups)) {
    const groupEl = document.createElement("div");
    groupEl.className = "engine-preset-group";

    const groupTitle = document.createElement("div");
    groupTitle.className = "engine-preset-category";
    groupTitle.textContent = category;
    groupEl.appendChild(groupTitle);

    const btnRow = document.createElement("div");
    btnRow.className = "engine-preset-buttons";

    for (const item of items) {
      const btn = document.createElement("button");
      btn.className = "engine-preset-btn";
      btn.textContent = item.label;

      if (item.path) {
        btn.title = `Pfad: ${item.path}`;
        btn.addEventListener("click", () => handleDirectPreset(item));
      } else if (item.searchName) {
        btn.title = `Suche nach: ${item.searchName}`;
        btn.addEventListener("click", () => handleSearchPreset(item));
      }

      btnRow.appendChild(btn);
    }

    groupEl.appendChild(btnRow);
    body.appendChild(groupEl);
  }

  container.appendChild(body);

  // Toggle logic
  function toggleCollapse() {
    const collapsed = body.classList.toggle("collapsed");
    header.querySelector(".engine-toggle-arrow").textContent = collapsed
      ? "▶"
      : "▼";
    setCollapsedForDomain(collapsed);
  }

  header.addEventListener("click", toggleCollapse);
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCollapse();
    }
  });

  // Restore saved collapse state
  isCollapsedForDomain().then((collapsed) => {
    if (collapsed) {
      body.classList.add("collapsed");
      header.querySelector(".engine-toggle-arrow").textContent = "▶";
    }
  });
}

/**
 * Handle a preset with a direct path: read current value, allow editing.
 */
async function handleDirectPreset(item) {
  // Read the current value via pokeByPath with no change
  const readResult = await send("readPath", { path: item.path });

  if (readResult && readResult.error) {
    showError(`❌ Pfad nicht gefunden: ${item.path}`);
    return;
  }

  const currentValue =
    readResult !== null && readResult !== undefined ? readResult.value : "???";

  const newValue = await showDialog({
    type: "prompt",
    title: item.label,
    message: `${item.path}\nAktueller Wert: ${currentValue}`,
    defaultValue: String(currentValue),
  });

  if (newValue !== null) {
    let parsed = newValue;
    try {
      parsed = JSON.parse(newValue);
    } catch {
      // keep as string
    }
    const pokeResult = await send("poke", {
      path: item.path,
      value: parsed,
    });
    if (pokeResult && pokeResult.success) {
      showSuccess(`✅ ${item.label}: ${currentValue} → ${parsed}`);
      await saveFavorite(item.path, parsed, item.label);
    } else {
      showError(
        `❌ Änderung fehlgeschlagen: ${pokeResult?.error || "Unbekannter Fehler"}`,
      );
    }
  }
}

/**
 * Handle a preset that fills in the search form fields.
 */
function handleSearchPreset(item) {
  const searchType = $("#searchType");
  const valueInput = $("#value");
  const nameInput = $("#nameInput");
  const nameInputGroup = $("#nameInputGroup");

  if (!searchType || !valueInput) return;

  if (item.searchType === "name") {
    searchType.value = "name";
    valueInput.value = item.searchName;
    if (nameInputGroup) nameInputGroup.classList.add("hidden");
  } else if (item.searchType === "nameAndValue") {
    searchType.value = "nameAndValue";
    if (nameInput) nameInput.value = item.searchName || "";
    if (nameInputGroup) nameInputGroup.classList.remove("hidden");
    valueInput.value = item.searchValue || "";
  } else {
    searchType.value = "value";
    valueInput.value = item.searchValue || "";
    if (nameInputGroup) nameInputGroup.classList.add("hidden");
  }

  // Trigger change event so the UI updates
  searchType.dispatchEvent(new Event("change"));
  valueInput.focus();

  showInfo(`🔍 Suchfelder für "${item.label}" ausgefüllt – jetzt Scan starten`);
}

/**
 * Group an array of objects by a key.
 */
function groupBy(arr, key) {
  const result = {};
  for (const item of arr) {
    const group = item[key] || "Sonstige";
    if (!result[group]) result[group] = [];
    result[group].push(item);
  }
  return result;
}
