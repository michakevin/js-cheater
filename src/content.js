(() => {
  if (window.__jsCheaterContentInitialized__) {
    return;
  }
  window.__jsCheaterContentInitialized__ = true;

  // Kept in sync with src/debug.js by scripts/build-extensions.mjs.
  const DEBUG = false;
  if (DEBUG)
    console.log("[js-cheater] Content script loaded (postMessage Mode)");

  const REQ = "__jsCheaterRequest";
  const RES = "__jsCheaterResponse";

  const API = {
    async sendCommand(command, data = {}, timeoutMs = 20000) {
      const id =
        "req_" + Date.now() + "_" + Math.random().toString(36).slice(2);

      return new Promise((resolve) => {
        let timerId;
        const cb = (ev) => {
          if (ev.source !== window) return;
          if (ev.data?.type !== RES || ev.data.id !== id) return;
          clearTimeout(timerId);
          window.removeEventListener("message", cb);
          resolve(ev.data.result);
        };

        window.addEventListener("message", cb, false);
        window.postMessage({ type: REQ, id, command, data }, "*");

        timerId = setTimeout(() => {
          window.removeEventListener("message", cb);
          resolve({ error: "Timeout", timeout: true });
        }, timeoutMs);
      });
    },

    async start(value) {
      return this.sendCommand("scan", { value });
    },

    async refine(value) {
      return this.sendCommand("refine", { value });
    },

    async scanByName(name) {
      return this.sendCommand("scanByName", { name });
    },

    async refineByName(name) {
      return this.sendCommand("refineByName", { name });
    },

    async scanByNameAndValue(name, value) {
      return this.sendCommand("scanByNameAndValue", { name, value });
    },

    async refineByNameAndValue(name, value) {
      return this.sendCommand("refineByNameAndValue", { name, value });
    },

    async list() {
      return this.sendCommand("list");
    },

    async poke(idx, value) {
      return this.sendCommand("poke", { idx, value });
    },

    async pokeByPath(path, value) {
      return this.sendCommand("poke", { path, value });
    },

    async freezeByPath(path, value) {
      return this.sendCommand("freeze", { path, value });
    },

    async unfreezeByPath(path) {
      return this.sendCommand("unfreeze", { path });
    },

    async detectEngine() {
      return this.sendCommand("detectEngine");
    },

    async readPath(path) {
      return this.sendCommand("readPath", { path });
    },

    async test() {
      // Short timeout for setup polling, but not too short for slower pages.
      return this.sendCommand("test", {}, 1500);
    },
  };

  const commandHandlers = {
    ping: () => "pong",
    start: (msg) => API.start(msg.value),
    scanByName: (msg) => API.scanByName(msg.value),
    refine: (msg) => API.refine(msg.value),
    refineByName: (msg) => API.refineByName(msg.value),
    scanByNameAndValue: (msg) => API.scanByNameAndValue(msg.name, msg.value),
    refineByNameAndValue: (msg) =>
      API.refineByNameAndValue(msg.name, msg.value),
    list: () => API.list(),
    poke: (msg) =>
      msg.path
        ? API.pokeByPath(msg.path, msg.value)
        : API.poke(msg.idx, msg.value),
    freeze: (msg) => API.freezeByPath(msg.path, msg.value),
    unfreeze: (msg) => API.unfreezeByPath(msg.path),
    detectEngine: () => API.detectEngine(),
    readPath: (msg) => API.readPath(msg.path),
    getLocalStorage: () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    },
    setLocalStorage: (msg) => {
      const data = msg.data || {};
      // When `replace` is set the import is treated as a full restore: existing
      // keys that are not part of the imported snapshot are removed first, so
      // the result matches the imported state instead of merging into it.
      let removed = 0;
      if (msg.replace === true) {
        const incoming = new Set(Object.keys(data));
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!incoming.has(key)) toRemove.push(key);
        }
        toRemove.forEach((k) => {
          localStorage.removeItem(k);
          removed += 1;
        });
      }
      const skipped = [];
      Object.entries(data).forEach(([k, v]) => {
        if (typeof v !== "string") {
          skipped.push({ key: k, type: typeof v });
          console.warn(
            "[js-cheater] setLocalStorage skipped non-string value",
            k,
            typeof v,
          );
          return;
        }
        try {
          localStorage.setItem(k, v);
        } catch (e) {
          console.error("[js-cheater] Failed to set", k, e);
        }
      });
      return { success: true, skipped, removed };
    },
    /**
     * Enumerate RPG Maker save slots from both localStorage and IndexedDB.
     * Returns { slots: Array<{key, source, raw}> } where source is
     * "localStorage" or "indexedDB".
     */
    getRpgMakerSaves: async () => {
      const slots = [];

      // 1) localStorage: RPG Maker MV keys ("RPG File1", "RPG Global")
      //    and MZ-style keys ("rmmzsave.*")
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (/^RPG\s+(File\d+|Global)$/i.test(key) || /^rmmzsave\b/i.test(key)) {
          slots.push({
            key,
            source: "localStorage",
            raw: localStorage.getItem(key),
          });
        }
      }

      // 2) IndexedDB: RPG Maker MZ via localforage
      try {
        const forageSlots = await readLocalForage();
        for (const s of forageSlots) {
          slots.push(s);
        }
      } catch (e) {
        if (DEBUG) console.log("[js-cheater] IndexedDB forage read failed:", e);
      }

      return { slots };
    },
    /**
     * Write a single RPG Maker save slot back.
     * @param {{key: string, source: string, raw: string, encoding?: string}} msg
     */
    setRpgMakerSave: async (msg) => {
      const { key, source, raw, encoding } = msg;
      if (source === "localStorage") {
        localStorage.setItem(key, raw);
        return { success: true };
      }
      if (source === "indexedDB") {
        try {
          await writeLocalForage(key, raw, encoding);
          return { success: true };
        } catch (e) {
          return { error: e.message };
        }
      }
      return { error: "Unknown source: " + source };
    },
    test: () => API.test(),
    /**
     * Fetch RPG Maker static data files from the game server.
     * Works because content scripts share the page's origin for fetch.
     */
    getRpgMakerGameData: async () => {
      const files = ["Items", "Weapons", "Armors", "System"];
      const result = {};
      await Promise.all(
        files.map(async (name) => {
          try {
            const res = await fetch(`/data/${name}.json`);
            result[name.toLowerCase()] = res.ok ? await res.json() : null;
          } catch {
            result[name.toLowerCase()] = null;
          }
        }),
      );
      return result;
    },
  };

  /**
   * Read all RPG Maker MZ save entries from IndexedDB (localforage).
   * localforage uses DB "localforage" with store "keyvaluepairs".
   * @returns {Promise<Array<{key: string, source: string, raw: string, encoding: string}>>}
   */
  function readLocalForage() {
    return new Promise((resolve, reject) => {
      const results = [];
      // Try common localforage DB names
      const dbNames = ["localforage", "RPG Maker MZ"];
      let tried = 0;

      function tryNextDB() {
        if (tried >= dbNames.length) {
          resolve(results);
          return;
        }
        const dbName = dbNames[tried++];
        try {
          const openReq = indexedDB.open(dbName);
          openReq.onerror = () => tryNextDB();
          openReq.onupgradeneeded = (ev) => {
            // DB didn't exist, close and delete it
            ev.target.transaction.abort();
            tryNextDB();
          };
          openReq.onsuccess = (ev) => {
            const db = ev.target.result;
            const storeNames = [...db.objectStoreNames];
            if (storeNames.length === 0) {
              db.close();
              tryNextDB();
              return;
            }
            // Read from the first store (usually "keyvaluepairs")
            const storeName = storeNames.includes("keyvaluepairs")
              ? "keyvaluepairs"
              : storeNames[0];
            try {
              const tx = db.transaction(storeName, "readonly");
              const store = tx.objectStore(storeName);
              const cursorReq = store.openCursor();
              cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                  const k = cursor.key;
                  const v = cursor.value;
                  // Include entries that look like RPG Maker save data
                  if (
                    typeof k === "string" &&
                    (/rmmzsave/i.test(k) ||
                      /^RPG\s+(File|Global)/i.test(k) ||
                      /^(file|save)\d+$/i.test(k) ||
                      /^(config|global)$/i.test(k))
                  ) {
                    const isString = typeof v === "string";
                    const raw = isString ? v : JSON.stringify(v);
                    // Remember the original storage encoding so the write-back
                    // can restore the same type (object slots must not become
                    // strings, or the game may fail to read them).
                    results.push({
                      key: k,
                      source: "indexedDB",
                      raw,
                      encoding: isString ? "string" : "json",
                    });
                  }
                  cursor.continue();
                } else {
                  db.close();
                  tryNextDB();
                }
              };
              cursorReq.onerror = () => {
                db.close();
                tryNextDB();
              };
            } catch {
              db.close();
              tryNextDB();
            }
          };
        } catch {
          tryNextDB();
        }
      }
      tryNextDB();

      // Safety timeout
      setTimeout(() => {
        if (results.length === 0) reject(new Error("IndexedDB timeout"));
        else resolve(results);
      }, 5000);
    });
  }

  /**
   * Write a value back to localforage IndexedDB.
   * @param {string} key
   * @param {string} raw
   * @param {string} [encoding] - "json" if the slot was originally stored as a
   *   non-string object; the raw JSON is then parsed back to an object before
   *   writing so the stored type is preserved.
   * @returns {Promise<void>}
   */
  function writeLocalForage(key, raw, encoding) {
    let value = raw;
    if (encoding === "json") {
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw;
      }
    }
    return new Promise((resolve, reject) => {
      const dbNames = ["localforage", "RPG Maker MZ"];
      let tried = 0;

      function tryNextDB() {
        if (tried >= dbNames.length) {
          reject(new Error("Save-DB not found"));
          return;
        }
        const dbName = dbNames[tried++];
        // Guard so a single open attempt advances to the next DB only once
        // (abort() in onupgradeneeded also triggers onerror).
        let advanced = false;
        const next = () => {
          if (advanced) return;
          advanced = true;
          tryNextDB();
        };
        try {
          const openReq = indexedDB.open(dbName);
          openReq.onerror = () => next();
          openReq.onupgradeneeded = (ev) => {
            // DB did not exist. Abort the auto-created versionchange
            // transaction so we don't leave an empty "phantom" database
            // behind, then move on to the next candidate.
            try {
              ev.target.transaction.abort();
            } catch {
              /* ignore */
            }
            next();
          };
          openReq.onsuccess = (ev) => {
            const db = ev.target.result;
            const storeNames = [...db.objectStoreNames];
            const storeName = storeNames.includes("keyvaluepairs")
              ? "keyvaluepairs"
              : storeNames[0];
            if (!storeName) {
              db.close();
              next();
              return;
            }
            try {
              const tx = db.transaction(storeName, "readwrite");
              const store = tx.objectStore(storeName);
              const putReq = store.put(value, key);
              putReq.onsuccess = () => {
                db.close();
                resolve();
              };
              putReq.onerror = () => {
                db.close();
                next();
              };
            } catch {
              db.close();
              next();
            }
          };
        } catch {
          next();
        }
      }
      tryNextDB();
    });
  }

  // Message Handler
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (DEBUG && msg.cmd !== "test") {
      console.log("[js-cheater] Received message:", msg);
    }

    const handler = commandHandlers[msg.cmd];
    if (!handler) {
      sendResponse({ error: "Unknown command: " + msg.cmd });
      return;
    }

    try {
      const result = handler(msg);
      if (result && typeof result.then === "function") {
        result
          .then((res) => {
            if (DEBUG && msg.cmd !== "test") {
              console.log(`[js-cheater] ${msg.cmd} result:`, res);
            }
            sendResponse(res);
          })
          .catch((error) => {
            console.error(
              `[js-cheater] Async handler for ${msg.cmd} failed:`,
              error,
            );
            sendResponse({ error: error?.message || String(error) });
          });
        return true;
      }
      sendResponse(result);
    } catch (e) {
      console.error(`[js-cheater] Handler for ${msg.cmd} failed:`, e);
      sendResponse({ error: e.message });
    }
  });
})();
