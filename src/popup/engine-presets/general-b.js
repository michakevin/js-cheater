export const GENERAL_ENGINE_PRESETS_B = [
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
  {
    id: "js-cheater-testpage",
    name: "JS-Cheater Testseite",
    icon: "🧪",
    description:
      "Die eingebaute Testseite wurde erkannt. Alle Spielwerte sind direkt zugänglich.",
    presets: [
      {
        label: "🏆 Score",
        path: "gameScore",
        category: "Direkt",
      },
      {
        label: "❤️ Health",
        path: "playerHealth",
        category: "Direkt",
      },
      {
        label: "🔵 Mana",
        path: "playerMana",
        category: "Direkt",
      },
      {
        label: "💰 Gold",
        path: "playerGold",
        category: "Direkt",
      },
      {
        label: "💚 Lives",
        path: "playerLives",
        category: "Direkt",
      },
      {
        label: "📊 Level",
        path: "gameLevel",
        category: "Direkt",
      },
      {
        label: "🎲 Random",
        path: "randomValue",
        category: "Direkt",
      },
      {
        label: "🏆 Nested Score",
        path: "gameState.player.stats.score",
        category: "Nested",
      },
      {
        label: "❤️ Nested Health",
        path: "gameState.player.stats.health",
        category: "Nested",
      },
      {
        label: "💎 Gems",
        path: "gameState.player.inventory.gems",
        category: "Nested",
      },
      {
        label: "🪙 Coins",
        path: "gameState.player.inventory.coins",
        category: "Nested",
      },
    ],
  },
];

