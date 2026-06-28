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
import { $ } from "./utils.js";
import { hideStatus, showStatus } from "./editor-status.js";
import { createTabSender, readTabIdFromLocation } from "./editor-shell.js";
import { showDialog } from "./dialog.js";

// ---- Communication helpers ----
// This page is opened as a popup/window from the extension sidebar.
// It communicates with the active tab through chrome.tabs.sendMessage,
// the same way the main popup does.

let activeTabId = null;
const send = createTabSender(() => activeTabId);

// ---- State ----
let currentSlotKey = "";
/** @type {"localStorage"|"indexedDB"|""} */
let currentSlotSource = "";
let editorData = null;
let hasChanges = false;

/**
 * Cache of slot data from the last getRpgMakerSaves call.
 * Maps "key" → { key, source, raw, encoding? }.
 * @type {Map<string, {key: string, source: string, raw: string, encoding?: string}>}
 */
const slotCache = new Map();

// DOM references
function resetLoadedSlotState() {
  currentSlotKey = "";
  currentSlotSource = "";
  editorData = null;
  hasChanges = false;
}

function getSaveErrorMessage(result) {
  return (
    result?.error || result?.message || "Unbekannter Fehler beim Speichern."
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
    .filter((key) => /^RPG\s+(File\d+|Global|Config)$/i.test(key))
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
  const aGlobal = /global|config|achievement|locale/i.test(a.key) ? 0 : 1;
  const bGlobal = /global|config|achievement|locale/i.test(b.key) ? 0 : 1;
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

// ---- Save file import ----

/**
 * Parse an RPG Maker save filename like file6.rpgsave or global.rmmzsave.
 * @param {string} filename
 * @returns {{ kind: "file"|"global"|"config"|"achievements"|"locale"|"unknown", index: number|null, extension: string|null }}
 */
export function parseSaveFileName(filename) {
  const base = String(filename || "")
    .replace(/^.*[\\/]/, "")
    .trim();
  const match = base.match(
    /^(global|config|achievements|locale|file(\d+))(?:\.(rpgsave|rmmzsave))?$/i,
  );
  if (!match) {
    return { kind: "unknown", index: null, extension: null };
  }

  const [, name, numStr, ext] = match;
  const extension = ext ? ext.toLowerCase() : null;
  if (/^global$/i.test(name)) {
    return { kind: "global", index: null, extension };
  }
  if (/^config$/i.test(name)) {
    return { kind: "config", index: null, extension };
  }
  if (/^achievements$/i.test(name)) {
    return { kind: "achievements", index: null, extension };
  }
  if (/^locale$/i.test(name)) {
    return { kind: "locale", index: null, extension };
  }
  return {
    kind: "file",
    index: parseInt(numStr, 10),
    extension,
  };
}

/**
 * Convert raw save file bytes to the string format expected by decodeSaveData.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function arrayBufferToSaveRaw(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return "";

  // MZ saves use zlib (first byte 0x78) stored as a binary string.
  if (bytes[0] === 0x78) {
    let str = "";
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return str;
  }

  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
  }

  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str.trim();
}

/**
 * Read a File/Blob from disk into save raw data.
 * @param {Blob} file
 * @returns {Promise<string>}
 */
export async function readSaveFileAsRaw(file) {
  if (typeof file.arrayBuffer === "function") {
    return arrayBufferToSaveRaw(await file.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.trim());
        return;
      }
      resolve(arrayBufferToSaveRaw(/** @type {ArrayBuffer} */ (reader.result)));
    };
    reader.onerror = () => reject(reader.error || new Error("Datei konnte nicht gelesen werden."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract the RPG Maker MZ game id from existing save slot keys.
 * @param {Array<{key: string}>} slots
 * @returns {string|null}
 */
export function extractMzGameId(slots) {
  for (const slot of slots) {
    const match = slot.key.match(/^rmmzsave\.(\d+)\./i);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract a savefile id from a browser storage key.
 * @param {string} key
 * @returns {number|null}
 */
export function extractSavefileIdFromKey(key) {
  const mvMatch = key.match(/^RPG File(\d+)$/i);
  if (mvMatch) return parseInt(mvMatch[1], 10);

  const mzMatch = key.match(/^rmmzsave\.\d+\.file(\d+)$/i);
  if (mzMatch) return parseInt(mzMatch[1], 10);

  return null;
}

/**
 * Format RPG Maker playtime from frame count.
 * @param {number} frames
 * @returns {string}
 */
export function formatPlaytimeFromFrames(frames) {
  const totalSeconds = Math.floor(Number(frames || 0) / 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Build save-menu metadata from imported save contents.
 * Mirrors RPG Maker's DataManager.makeSavefileInfo output.
 * @param {object} contents
 * @returns {{ title: string, characters: Array<Array<string|number>>, faces: Array<Array<string|number>>, playtime: string, timestamp: number }}
 */
export function buildSavefileInfoFromContents(contents) {
  const party = contents?.party;
  const actors = contents?.actors;
  const system = contents?.system;
  const actorIds = party?._actors || [];

  const characters = [];
  const faces = [];
  for (const id of actorIds) {
    const actor = actors?.[String(id)] ?? actors?.[id];
    if (!actor) continue;
    characters.push([
      actor._characterName ?? "",
      actor._characterIndex ?? 0,
    ]);
    faces.push([actor._faceName ?? "", actor._faceIndex ?? 0]);
  }

  return {
    title: system?._gameTitle ?? system?.gameTitle ?? "",
    characters,
    faces,
    playtime: formatPlaytimeFromFrames(system?._framesOnSave ?? 0),
    timestamp: Date.now(),
  };
}

/**
 * Insert or replace one entry in the global save index array.
 * @param {Array<*>} globalInfo
 * @param {number} savefileId
 * @param {object} entry
 * @returns {Array<*>}
 */
export function setGlobalInfoEntry(globalInfo, savefileId, entry) {
  const info = Array.isArray(globalInfo) ? [...globalInfo] : [];
  info[savefileId] = entry;
  return info;
}

/**
 * Resolve the browser storage key for the global save index.
 * @param {Array<{key: string}>} slots
 * @param {string} format
 * @returns {{ key: string, source: string, encoding?: string } | null}
 */
export function resolveGlobalTarget(slots, format) {
  const mzGameId = extractMzGameId(slots);
  if (format === "zlib" || (mzGameId && format !== "lzstring")) {
    if (!mzGameId) return null;
    return {
      key: `rmmzsave.${mzGameId}.global`,
      source: "indexedDB",
      encoding: "string",
    };
  }
  return { key: "RPG Global", source: "localStorage" };
}

/**
 * Update the global save index after importing a slot file.
 * @param {number} savefileId
 * @param {object} saveContents
 * @param {string|null|undefined} existingGlobalRaw
 * @param {string} format
 * @returns {Promise<string>}
 */
export async function prepareUpdatedGlobalRaw(
  savefileId,
  saveContents,
  existingGlobalRaw,
  format,
) {
  let globalInfo = [];
  if (existingGlobalRaw) {
    const decoded = await decodeSaveData(existingGlobalRaw);
    if (decoded && Array.isArray(decoded.data)) {
      globalInfo = decoded.data;
    }
  }

  const entry = buildSavefileInfoFromContents(saveContents);
  const updated = setGlobalInfoEntry(globalInfo, savefileId, entry);
  return encodeSaveData(updated, format);
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isFileSlotKey(key) {
  return /^RPG File\d+$/i.test(key) || /^rmmzsave\.\d+\.file\d+$/i.test(key);
}

/**
 * Rebuild the global save index from all readable file slots.
 * @param {Array<{key: string, raw: string}>} slots
 * @returns {Promise<{ globalInfo: Array<*>, format: string, registered: number[] }>}
 */
export async function rebuildGlobalInfoFromSlots(slots) {
  const fileSlots = slots
    .filter((slot) => isFileSlotKey(slot.key) && slot.raw)
    .map((slot) => ({
      slot,
      savefileId: extractSavefileIdFromKey(slot.key),
    }))
    .filter(
      (entry) =>
        entry.savefileId !== null && entry.savefileId !== undefined,
    )
    .sort((a, b) => a.savefileId - b.savefileId);

  let globalInfo = [];
  let format = "lzstring";
  const registered = [];

  for (const { slot, savefileId } of fileSlots) {
    const decoded = await decodeSaveData(slot.raw);
    if (!decoded) continue;

    format = decoded.format;
    globalInfo = setGlobalInfoEntry(
      globalInfo,
      /** @type {number} */ (savefileId),
      buildSavefileInfoFromContents(decoded.data),
    );
    registered.push(/** @type {number} */ (savefileId));
  }

  return { globalInfo, format, registered };
}

/** Plugin/auxiliary save files mapped from desktop filenames to browser keys. */
export const AUXILIARY_SAVE_TARGETS = {
  achievements: {
    match: /achievement/i,
    mvDefault: "Achievement-Game",
  },
  locale: {
    match: /^locale$/i,
    mvDefault: "locale",
  },
};

/**
 * Resolve import target for plugin auxiliary saves like achievements.rpgsave.
 * @param {"achievements"|"locale"} name
 * @param {Array<{key: string, source: string, encoding?: string}>} slots
 * @param {boolean} preferMz
 * @param {boolean} preferMv
 * @returns {{ key: string, source: string, encoding?: string, guessed?: boolean } | null}
 */
export function resolveAuxiliaryImportTarget(name, slots, preferMz, preferMv) {
  const config = AUXILIARY_SAVE_TARGETS[name];
  if (!config) return null;

  if (preferMz && !preferMv) {
    const mzGameId = extractMzGameId(slots);
    if (!mzGameId) return null;
    return {
      key: `rmmzsave.${mzGameId}.${name}`,
      source: "indexedDB",
      encoding: "string",
    };
  }

  const existing = slots.find((slot) => config.match.test(slot.key));
  if (existing) {
    return {
      key: existing.key,
      source: existing.source,
      encoding: existing.encoding,
    };
  }

  return {
    key: config.mvDefault,
    source: "localStorage",
    guessed: true,
  };
}

/**
 * Resolve where an imported save file should be written.
 * Uses the selected slot, filename, detected format, and existing slots.
 * @param {{ kind: string, index: number|null, extension: string|null }} parsed
 * @param {Array<{key: string, source: string, encoding?: string}>} slots
 * @param {string} format
 * @param {string} [selectedSlotKey]
 * @returns {{ key: string, source: string, encoding?: string } | null}
 */
export function resolveImportTarget(parsed, slots, format, selectedSlotKey) {
  const useSelectedSlot =
    selectedSlotKey &&
    (parsed.kind === "file" ||
      parsed.kind === "unknown" ||
      (["achievements", "locale"].includes(parsed.kind) &&
        !isFileSlotKey(selectedSlotKey)));

  if (useSelectedSlot) {
    const existing = slots.find((slot) => slot.key === selectedSlotKey);
    if (existing) {
      return {
        key: existing.key,
        source: existing.source,
        encoding: existing.encoding,
      };
    }
    if (/^RPG\s+(File\d+|Global|Config)$/i.test(selectedSlotKey)) {
      return { key: selectedSlotKey, source: "localStorage" };
    }
    if (/^rmmzsave\.\d+\./i.test(selectedSlotKey)) {
      return {
        key: selectedSlotKey,
        source: "indexedDB",
        encoding: format === "zlib" ? "string" : undefined,
      };
    }
    if (["achievements", "locale"].includes(parsed.kind)) {
      return { key: selectedSlotKey, source: "localStorage" };
    }
  }

  const mzGameId = extractMzGameId(slots);
  const preferMz =
    parsed.extension === "rmmzsave" ||
    format === "zlib" ||
    (format !== "lzstring" && Boolean(mzGameId) && parsed.extension !== "rpgsave");
  const preferMv =
    parsed.extension === "rpgsave" ||
    format === "lzstring" ||
    (!preferMz && !mzGameId);

  if (parsed.kind === "achievements" || parsed.kind === "locale") {
    return resolveAuxiliaryImportTarget(parsed.kind, slots, preferMz, preferMv);
  }

  if (parsed.kind === "global") {
    if (preferMz && !preferMv) {
      if (!mzGameId) return null;
      return {
        key: `rmmzsave.${mzGameId}.global`,
        source: "indexedDB",
        encoding: "string",
      };
    }
    return { key: "RPG Global", source: "localStorage" };
  }

  if (parsed.kind === "config") {
    if (preferMz && !preferMv) {
      if (!mzGameId) return null;
      return {
        key: `rmmzsave.${mzGameId}.config`,
        source: "indexedDB",
        encoding: "string",
      };
    }
    return { key: "RPG Config", source: "localStorage" };
  }

  if (parsed.kind === "file" && parsed.index !== null) {
    if (preferMz && !preferMv) {
      if (!mzGameId) return null;
      return {
        key: `rmmzsave.${mzGameId}.file${parsed.index}`,
        source: "indexedDB",
        encoding: "string",
      };
    }
    return {
      key: `RPG File${parsed.index}`,
      source: "localStorage",
    };
  }

  return null;
}

/**
 * @param {string} fileName
 * @param {{ key: string }} target
 * @param {{ kind: string }} parsed
 * @returns {string}
 */
function buildImportConfirmMessage(fileName, target, parsed) {
  let message =
    `${fileName} nach „${target.key}“ importieren?\n\n` +
    "Bestehende Daten werden überschrieben.";
  if (parsed.kind === "file") {
    message +=
      "\n\nDer Slot wird zusätzlich im Global-Index registriert, damit er im Spielmenü erscheint.";
  } else if (parsed.kind === "achievements" && target.guessed) {
    message +=
      "\n\nEs wird der Standard-Schlüssel für Achievement-Plugins verwendet. Wenn das Spiel einen anderen Schlüssel nutzt, wähle ihn oben in der Liste.";
  }
  return message;
}

/**
 * @param {string} message
 * @returns {Promise<boolean>}
 */
async function confirmImport(message) {
  return showDialog({
    type: "confirm",
    title: "Save-Datei importieren",
    message,
    confirmText: "Importieren",
    cancelText: "Abbrechen",
  });
}

async function importSaveFile(file) {
  if (!file) return;

  showStatus("⏳ Lese " + file.name + "…", "info");

  try {
    const raw = await readSaveFileAsRaw(file);
    const decoded = await decodeSaveData(raw);
    if (!decoded) {
      showStatus(
        "❌ Die Datei konnte nicht als RPG-Maker-Save gelesen werden.",
        "error",
      );
      return;
    }

    const parsed = parseSaveFileName(file.name);
    const slots = [...slotCache.values()];
    const select = /** @type {HTMLSelectElement} */ ($("#slotSelect"));
    const selectedSlotKey = select?.value || "";

    const target = resolveImportTarget(
      parsed,
      slots,
      decoded.format,
      selectedSlotKey,
    );

    if (!target) {
      showStatus(
        parsed.kind === "config" || decoded.format === "zlib"
          ? "❌ Ziel-Slot unbekannt. Bitte einmal im Spiel speichern oder oben einen Slot wählen."
          : "❌ Ziel-Slot unbekannt. Dateiname erkennen (z. B. file6.rpgsave) oder oben einen Slot wählen.",
        "error",
      );
      return;
    }

    const confirmed = await confirmImport(
      buildImportConfirmMessage(file.name, target, parsed),
    );
    if (!confirmed) {
      hideStatus();
      return;
    }

    showStatus("⏳ Importiere nach " + target.key + "…", "info");

    const saveResult = await send("setRpgMakerSave", {
      key: target.key,
      source: target.source,
      raw,
      encoding: target.encoding,
    });

    if (!saveResult || saveResult.success !== true) {
      throw new Error(getSaveErrorMessage(saveResult));
    }

    let globalTargetKey = "";
    if (parsed.kind === "file") {
      const savefileId =
        extractSavefileIdFromKey(target.key) ?? parsed.index ?? null;
      const globalTarget = resolveGlobalTarget(slots, decoded.format);
      if (savefileId !== null && globalTarget) {
        const existingGlobalRaw = slotCache.get(globalTarget.key)?.raw ?? null;
        const globalRaw = await prepareUpdatedGlobalRaw(
          savefileId,
          decoded.data,
          existingGlobalRaw,
          decoded.format,
        );
        const globalResult = await send("setRpgMakerSave", {
          key: globalTarget.key,
          source: globalTarget.source,
          raw: globalRaw,
          encoding: globalTarget.encoding,
        });
        if (!globalResult || globalResult.success !== true) {
          throw new Error(getSaveErrorMessage(globalResult));
        }
        globalTargetKey = globalTarget.key;
      }
    }

    await loadSlots();

    if (select) {
      select.value = target.key;
      await loadSlotData(target.key);
    }

    showStatus(
      "✅ " +
        file.name +
        " nach " +
        target.key +
        " importiert!" +
        (globalTargetKey ? " Global-Index (" + globalTargetKey + ") aktualisiert." : "") +
        " Lade das Spiel neu, um den Stand zu laden.",
      "success",
    );
  } catch (e) {
    showStatus("❌ Fehler beim Import: " + e.message, "error");
  }
}

async function fixGlobalState() {
  showStatus("⏳ Analysiere Speicherstände…", "info");

  try {
    const slots = [...slotCache.values()];
    const rebuild = await rebuildGlobalInfoFromSlots(slots);

    if (rebuild.registered.length === 0) {
      showStatus(
        "❌ Keine lesbaren Speicherstände gefunden, aus denen der Global-Index gebaut werden kann.",
        "error",
      );
      return;
    }

    const globalTarget = resolveGlobalTarget(slots, rebuild.format);
    if (!globalTarget) {
      showStatus(
        "❌ Global-Ziel unbekannt. Bitte einmal im Spiel speichern.",
        "error",
      );
      return;
    }

    const slotList = rebuild.registered.join(", ");
    const confirmed = await showDialog({
      type: "confirm",
      title: "Global-Index reparieren",
      message:
        `Den Global-Index in „${globalTarget.key}“ aus ${rebuild.registered.length} Speicherstand/Speicherständen neu aufbauen?\n\n` +
        `Erkannte Slots: ${slotList}\n\n` +
        "Bestehende Global-Daten werden überschrieben. Nicht gefundene Slots verschwinden aus dem Lade-Menü.",
      confirmText: "Reparieren",
      cancelText: "Abbrechen",
    });
    if (!confirmed) {
      hideStatus();
      return;
    }

    showStatus("⏳ Repariere Global-Index…", "info");

    const globalRaw = await encodeSaveData(rebuild.globalInfo, rebuild.format);
    const saveResult = await send("setRpgMakerSave", {
      key: globalTarget.key,
      source: globalTarget.source,
      raw: globalRaw,
      encoding: globalTarget.encoding,
    });

    if (!saveResult || saveResult.success !== true) {
      throw new Error(getSaveErrorMessage(saveResult));
    }

    await loadSlots();
    showStatus(
      "✅ Global-Index repariert (" +
        globalTarget.key +
        "). Registrierte Slots: " +
        slotList +
        ". Lade das Spiel neu.",
      "success",
    );
  } catch (e) {
    showStatus("❌ Fehler beim Reparieren: " + e.message, "error");
  }
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
      // Preserve the original IndexedDB storage type (object vs. string).
      encoding: slotCache.get(currentSlotKey)?.encoding,
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
      row.classList.remove("search-match");
    });
    if (countEl) countEl.textContent = "";
    return;
  }

  const lower = query.toLowerCase();
  let matchCount = 0;

  // Zuerst alle Zeilen ausblenden, dann gezielt die Treffer und den jeweiligen
  // Pfad zu ihnen (Eltern-Knoten) wieder einblenden.
  allRows.forEach((row) => {
    row.style.display = "none";
    row.classList.remove("search-match");
  });

  allRows.forEach((row) => {
    const keyEl = row.querySelector(".json-key");
    const valEl = row.querySelector(".json-value");
    const keyText = keyEl?.textContent?.toLowerCase() || "";
    const valText = valEl?.textContent?.toLowerCase() || "";

    // Strukturzeilen (z. B. schließende Klammer) haben weder Key noch Value.
    if (!keyText && !valText) return;

    if (keyText.includes(lower) || valText.includes(lower)) {
      matchCount++;
      row.style.display = "";
      row.classList.add("search-match");
      revealRowPath(row);
    }
  });

  if (countEl) {
    countEl.textContent = matchCount + " Treffer";
  }
}

/**
 * Blendet den gesamten Pfad zu einer Treffer-Zeile wieder ein: alle
 * übergeordneten Knoten-Zeilen werden sichtbar gemacht und eingeklappte
 * Container aufgeklappt.
 * @param {Element} row
 */
function revealRowPath(row) {
  let el = row.parentElement;
  while (el) {
    if (
      (el.classList.contains("json-children") ||
        el.classList.contains("category-children")) &&
      el.classList.contains("collapsed")
    ) {
      el.classList.remove("collapsed");
      const prev = el.previousElementSibling;
      const toggle = prev?.querySelector(".json-toggle, .category-toggle");
      if (toggle) toggle.textContent = "▼";
    }
    if (el.classList.contains("json-node")) {
      const openRow = el.querySelector(":scope > .json-key-row");
      if (openRow) openRow.style.display = "";
    }
    el = el.parentElement;
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

// ---- Init ----

document.addEventListener("DOMContentLoaded", () => {
  activeTabId = readTabIdFromLocation();

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

  const importBtn = $("#importSave");
  const importInput = /** @type {HTMLInputElement} */ ($("#importSaveInput"));
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => {
      const file = importInput.files?.[0];
      importInput.value = "";
      if (file) importSaveFile(file);
    });
  }

  const fixGlobalBtn = $("#fixGlobalState");
  if (fixGlobalBtn) {
    fixGlobalBtn.addEventListener("click", () => {
      void fixGlobalState();
    });
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
