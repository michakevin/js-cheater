/**
 * Engine detection UI module.
 *
 * Sends a "detectEngine" command via the content-script bridge,
 * displays the result in the search tab, and wires preset buttons
 * to either fill the search form or directly poke known paths.
 */

import { send } from "./communication.js";
import { $ } from "./utils.js";
import { getPresetsForEngine } from "./engine-presets.js";
import { showError } from "./messages.js";
import { showDialog } from "./dialog.js";

let lastDetectedEngine = null;

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
  return null;
}

/**
 * @returns {object|null} The last detection result.
 */
export function getLastDetection() {
  return lastDetectedEngine;
}

/**
 * Run detection and render the preset panel into #enginePresets.
 * Safe to call multiple times – rebuilds the UI each time.
 */
export async function detectAndShowPresets() {
  const container = $("#enginePresets");
  if (!container) return;

  container.innerHTML = "";
  container.classList.add("hidden");

  const engine = await detectEngine();
  if (!engine) return;

  const preset = getPresetsForEngine(engine.id);
  if (!preset) return;

  container.classList.remove("hidden");
  renderPresetPanel(container, preset);
}

/**
 * Build the preset UI inside the given container element.
 */
function renderPresetPanel(container, preset) {
  // Header
  const header = document.createElement("div");
  header.className = "engine-header";
  header.innerHTML = `<span class="engine-icon">${preset.icon}</span> <strong>${preset.name}</strong> erkannt`;
  container.appendChild(header);

  // Description
  const desc = document.createElement("div");
  desc.className = "engine-description";
  desc.textContent = preset.description;
  container.appendChild(desc);

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
    container.appendChild(groupEl);
  }
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
      showError(`✅ ${item.label}: ${currentValue} → ${parsed}`);
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

  showError(
    `🔍 Suchfelder für "${item.label}" ausgefüllt – jetzt Scan starten`,
  );
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
