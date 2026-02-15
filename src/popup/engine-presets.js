import { GENERAL_ENGINE_PRESETS_A } from "./engine-presets/general-a.js";
import { GENERAL_ENGINE_PRESETS_B } from "./engine-presets/general-b.js";
import { RPGMAKER_ENGINE_PRESETS } from "./engine-presets/rpgmaker.js";

/**
 * Game engine preset definitions.
 *
 * Each engine entry contains:
 * - id:          unique identifier
 * - name:        display name
 * - icon:        emoji icon
 * - description: short description shown in the UI
 * - presets:     array of cheat presets with label, searchType, value/name, or direct path
 *
 * Preset entry fields:
 * - label:      button label
 * - path:       direct object path to read/write (optional)
 * - searchName: pre-fill "name" search (optional)
 * - searchType: "value" | "name" | "nameAndValue" (optional, default "name")
 * - category:   grouping label for the UI
 */
export const ENGINE_PRESETS = [
  ...RPGMAKER_ENGINE_PRESETS,
  ...GENERAL_ENGINE_PRESETS_A,
  ...GENERAL_ENGINE_PRESETS_B,
];

/**
 * Find the preset definition for a given engine id.
 * @param {string} engineId
 * @returns {object|undefined}
 */
export function getPresetsForEngine(engineId) {
  return ENGINE_PRESETS.find((enginePreset) => enginePreset.id === engineId);
}
