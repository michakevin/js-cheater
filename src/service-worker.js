// src/service-worker.js
// js-cheater – Background Service-Worker (Manifest V3)
import { DEBUG } from "./debug.js";
import "./background-common.js";

globalThis.__jsCheaterInitBackground?.({
  debugEnabled: DEBUG,
  actionApi: chrome.action,
});
