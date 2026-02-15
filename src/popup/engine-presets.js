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
  {
    id: "rpgmaker-mv-mz",
    name: "RPG Maker MV / MZ",
    icon: "⚔️",
    description:
      "RPG Maker MV/MZ (nw.js oder Web-Deploy). Globale Variablen wie $gameParty, $gameActors erkannt.",
    presets: [
      {
        label: "💰 Gold",
        path: "$gameParty._gold",
        category: "Ressourcen",
      },
      {
        label: "❤️ HP (Held 1)",
        path: "$gameActors._data.1._hp",
        category: "Held 1",
      },
      {
        label: "🔵 MP (Held 1)",
        path: "$gameActors._data.1._mp",
        category: "Held 1",
      },
      {
        label: "⚡ TP (Held 1)",
        path: "$gameActors._data.1._tp",
        category: "Held 1",
      },
      {
        label: "📊 Level (Held 1)",
        path: "$gameActors._data.1._level",
        category: "Held 1",
      },
      {
        label: "❤️ HP (Held 2)",
        path: "$gameActors._data.2._hp",
        category: "Held 2",
      },
      {
        label: "🔵 MP (Held 2)",
        path: "$gameActors._data.2._mp",
        category: "Held 2",
      },
      {
        label: "⚡ TP (Held 2)",
        path: "$gameActors._data.2._tp",
        category: "Held 2",
      },
      {
        label: "📊 Level (Held 2)",
        path: "$gameActors._data.2._level",
        category: "Held 2",
      },
      {
        label: "❤️ HP (Held 3)",
        path: "$gameActors._data.3._hp",
        category: "Held 3",
      },
      {
        label: "🔵 MP (Held 3)",
        path: "$gameActors._data.3._mp",
        category: "Held 3",
      },
      {
        label: "❤️ HP (Held 4)",
        path: "$gameActors._data.4._hp",
        category: "Held 4",
      },
      {
        label: "🔵 MP (Held 4)",
        path: "$gameActors._data.4._mp",
        category: "Held 4",
      },
      {
        label: "🔍 Alle HP suchen",
        searchType: "name",
        searchName: "_hp",
        category: "Suche",
      },
      {
        label: "🔍 Alle MP suchen",
        searchType: "name",
        searchName: "_mp",
        category: "Suche",
      },
      {
        label: "🔍 Gold suchen",
        searchType: "name",
        searchName: "_gold",
        category: "Suche",
      },
      {
        label: "🔍 Level suchen",
        searchType: "name",
        searchName: "_level",
        category: "Suche",
      },
    ],
  },
  {
    id: "rpgmaker-mz-effekseer",
    name: "RPG Maker MZ (Effekseer)",
    icon: "⚔️",
    description:
      "RPG Maker MZ mit Effekseer-Effekten erkannt. Gleiche Variablenstruktur wie MV/MZ.",
    presets: [
      {
        label: "💰 Gold",
        path: "$gameParty._gold",
        category: "Ressourcen",
      },
      {
        label: "❤️ HP (Held 1)",
        path: "$gameActors._data.1._hp",
        category: "Held 1",
      },
      {
        label: "🔵 MP (Held 1)",
        path: "$gameActors._data.1._mp",
        category: "Held 1",
      },
      {
        label: "⚡ TP (Held 1)",
        path: "$gameActors._data.1._tp",
        category: "Held 1",
      },
      {
        label: "📊 Level (Held 1)",
        path: "$gameActors._data.1._level",
        category: "Held 1",
      },
      {
        label: "🔍 Alle HP suchen",
        searchType: "name",
        searchName: "_hp",
        category: "Suche",
      },
      {
        label: "🔍 Alle MP suchen",
        searchType: "name",
        searchName: "_mp",
        category: "Suche",
      },
    ],
  },
  {
    id: "phaser",
    name: "Phaser",
    icon: "🎮",
    description:
      "Phaser-Game-Framework erkannt. Spielstatus variiert je nach Spiel.",
    presets: [
      {
        label: "🔍 Score suchen",
        searchType: "name",
        searchName: "score",
        category: "Typisch",
      },
      {
        label: "🔍 Health suchen",
        searchType: "name",
        searchName: "health",
        category: "Typisch",
      },
      {
        label: "🔍 Lives suchen",
        searchType: "name",
        searchName: "lives",
        category: "Typisch",
      },
      {
        label: "🔍 Coins suchen",
        searchType: "name",
        searchName: "coins",
        category: "Typisch",
      },
      {
        label: "🔍 Gold suchen",
        searchType: "name",
        searchName: "gold",
        category: "Typisch",
      },
      {
        label: "🔍 Speed suchen",
        searchType: "name",
        searchName: "speed",
        category: "Typisch",
      },
      {
        label: "🔍 Damage suchen",
        searchType: "name",
        searchName: "damage",
        category: "Typisch",
      },
    ],
  },
  {
    id: "construct",
    name: "Construct 2/3",
    icon: "🏗️",
    description:
      "Construct 2 oder 3 Engine erkannt. Spielwerte über Runtime-Variablen zugänglich.",
    presets: [
      {
        label: "🔍 Score suchen",
        searchType: "name",
        searchName: "score",
        category: "Typisch",
      },
      {
        label: "🔍 Health suchen",
        searchType: "name",
        searchName: "health",
        category: "Typisch",
      },
      {
        label: "🔍 HP suchen",
        searchType: "name",
        searchName: "hp",
        category: "Typisch",
      },
      {
        label: "🔍 Lives suchen",
        searchType: "name",
        searchName: "lives",
        category: "Typisch",
      },
      {
        label: "🔍 Gold suchen",
        searchType: "name",
        searchName: "gold",
        category: "Typisch",
      },
      {
        label: "🔍 Money suchen",
        searchType: "name",
        searchName: "money",
        category: "Typisch",
      },
    ],
  },
  {
    id: "renpy",
    name: "Ren'Py Web",
    icon: "📖",
    description: "Ren'Py Visual Novel Engine erkannt (Web-Export).",
    presets: [
      {
        label: "🔍 Affection suchen",
        searchType: "name",
        searchName: "affection",
        category: "Typisch",
      },
      {
        label: "🔍 Love suchen",
        searchType: "name",
        searchName: "love",
        category: "Typisch",
      },
      {
        label: "🔍 Points suchen",
        searchType: "name",
        searchName: "points",
        category: "Typisch",
      },
      {
        label: "🔍 Money suchen",
        searchType: "name",
        searchName: "money",
        category: "Typisch",
      },
    ],
  },
  {
    id: "godot",
    name: "Godot (HTML5)",
    icon: "🤖",
    description:
      "Godot-Engine (HTML5-Export) erkannt. Spielvariablen je nach Projekt verschieden.",
    presets: [
      {
        label: "🔍 Health suchen",
        searchType: "name",
        searchName: "health",
        category: "Typisch",
      },
      {
        label: "🔍 Score suchen",
        searchType: "name",
        searchName: "score",
        category: "Typisch",
      },
      {
        label: "🔍 Gold suchen",
        searchType: "name",
        searchName: "gold",
        category: "Typisch",
      },
      {
        label: "🔍 Lives suchen",
        searchType: "name",
        searchName: "lives",
        category: "Typisch",
      },
    ],
  },
  {
    id: "twine",
    name: "Twine / SugarCube",
    icon: "🧶",
    description:
      "Twine (SugarCube) Interactive-Fiction-Engine erkannt. Spielvariablen über State.variables.",
    presets: [
      {
        label: "🔍 Money suchen",
        searchType: "name",
        searchName: "money",
        category: "Typisch",
      },
      {
        label: "🔍 Health suchen",
        searchType: "name",
        searchName: "health",
        category: "Typisch",
      },
      {
        label: "🔍 Score suchen",
        searchType: "name",
        searchName: "score",
        category: "Typisch",
      },
      {
        label: "🔍 Points suchen",
        searchType: "name",
        searchName: "points",
        category: "Typisch",
      },
    ],
  },
  {
    id: "unity",
    name: "Unity WebGL",
    icon: "🎯",
    description:
      "Unity WebGL erkannt. Werte sind oft im WASM-Speicher und schwer zugänglich.",
    presets: [
      {
        label: "🔍 Score suchen",
        searchType: "name",
        searchName: "score",
        category: "Typisch",
      },
      {
        label: "🔍 Health suchen",
        searchType: "name",
        searchName: "health",
        category: "Typisch",
      },
      {
        label: "🔍 Gold suchen",
        searchType: "name",
        searchName: "gold",
        category: "Typisch",
      },
    ],
  },
  {
    id: "bitsy",
    name: "Bitsy",
    icon: "👾",
    description: "Bitsy Pixel-Adventure-Engine erkannt.",
    presets: [
      {
        label: "🔍 Items suchen",
        searchType: "name",
        searchName: "item",
        category: "Typisch",
      },
      {
        label: "🔍 Variables suchen",
        searchType: "name",
        searchName: "variable",
        category: "Typisch",
      },
    ],
  },
  {
    id: "pixi",
    name: "PixiJS",
    icon: "✨",
    description:
      "PixiJS Rendering-Engine erkannt. Wird oft als Renderer für andere Engines genutzt.",
    presets: [
      {
        label: "🔍 Score suchen",
        searchType: "name",
        searchName: "score",
        category: "Typisch",
      },
      {
        label: "🔍 Health suchen",
        searchType: "name",
        searchName: "health",
        category: "Typisch",
      },
      {
        label: "🔍 Gold suchen",
        searchType: "name",
        searchName: "gold",
        category: "Typisch",
      },
    ],
  },
];

/**
 * Find the preset definition for a given engine id.
 * @param {string} engineId
 * @returns {object|undefined}
 */
export function getPresetsForEngine(engineId) {
  return ENGINE_PRESETS.find((e) => e.id === engineId);
}
