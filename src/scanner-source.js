import { createScanner } from "./scanner-core.js";
// JS-Cheater Scanner - Füge diesen Code in die Browser-Konsole ein
(function () {
  const DEBUG = window.DEBUG || false;
  if (DEBUG) console.log("🎮 JS-Cheater Scanner wird geladen...");

  window.__cheatScanner__ = createScanner(DEBUG);

  /* -------- PostMessage‑Bridge für das Content‑Script -------- */
  const REQ = "__jsCheaterRequest";
  const RES = "__jsCheaterResponse";

  window.addEventListener(
    "message",
    (ev) => {
      if (ev.source !== window) return;
      if (ev.data?.type !== REQ) return;
      const { id, command, data } = ev.data;
      let result;
      try {
        switch (command) {
          case "scan":
            result = window.__cheatScanner__.scan(data.value);
            break;
          case "refine":
            result = window.__cheatScanner__.refine(data.value);
            break;
          case "scanByName":
            result = window.__cheatScanner__.scanByName(data.name);
            break;
          case "refineByName":
            result = window.__cheatScanner__.refineByName(data.name);
            break;
          case "scanByNameAndValue":
            result = window.__cheatScanner__.scanByNameAndValue(
              data.name,
              data.value,
            );
            break;
          case "refineByNameAndValue":
            result = window.__cheatScanner__.refineByNameAndValue(
              data.name,
              data.value,
            );
            break;
          case "list":
            result = window.__cheatScanner__.list();
            break;
          case "poke":
            result = data.path
              ? window.__cheatScanner__.pokeByPath(data.path, data.value)
              : window.__cheatScanner__.poke(data.idx, data.value);
            break;
          case "freeze":
            result = window.__cheatScanner__.freezeByPath(
              data.path,
              data.value,
            );
            break;
          case "unfreeze":
            result = window.__cheatScanner__.unfreezeByPath(data.path);
            break;
          case "detectEngine":
            result = window.__cheatScanner__.detectEngine();
            break;
          case "readPath":
            result = window.__cheatScanner__.readPath(data.path);
            break;
          case "test":
            result = window.__cheatScanner__.test();
            break;
          default:
            result = { error: "Unknown command: " + command };
        }
      } catch (e) {
        result = { error: e.message };
      }
      window.postMessage({ type: RES, id, result }, "*");
    },
    false,
  );

  if (DEBUG)
    console.log(
      "🎮 JS-Cheater Scanner bereit! Verwende window.__cheatScanner__.scan(wert)",
    );
})();
