export const RPGMAKER_ENGINE_PRESETS = [
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
];

