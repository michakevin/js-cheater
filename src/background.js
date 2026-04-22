// src/background.js
// js-cheater – Hintergrundskript für Firefox (Manifest V2)

// Kept in sync with src/debug.js by scripts/build-extensions.mjs.
const DEBUG = false;

globalThis.__jsCheaterInitBackground?.({
  debugEnabled: DEBUG,
  actionApi: chrome.action ?? chrome.browserAction,
});
