import { parsePath } from "./parse-path.js";
// JS-Cheater Scanner - Füge diesen Code in die Browser-Konsole ein
(function () {
  const DEBUG = window.DEBUG || false;
  if (DEBUG) console.log("🎮 JS-Cheater Scanner wird geladen...");

  // Path parsing utility function

  window.__cheatScanner__ = {
    hits: [],

    findAll: function (
      root,
      predicate,
      seen = new WeakSet(),
      path = "window",
      maxDepth = 5,
      opts = {}
    ) {
      let out = [];
      if (maxDepth <= 0) return out;

      // Skip prototype objects to avoid triggering illegal invocation errors
      if (
        root &&
        typeof root === "object" &&
        root.constructor &&
        root.constructor.prototype === root
      ) {
        return out;
      }

      if (!opts.startTime) opts.startTime = performance.now();
      const start = opts.startTime;
      const maxTime = opts.maxTime || 1000;
      if (performance.now() - start > maxTime) return out;

      const keys = new Set();
      try {
        Object.getOwnPropertyNames(root).forEach((key) => keys.add(key));
      } catch (e) {
        // Ignore errors (e.g., non-configurable properties)
      }

      try {
        Object.keys(root).forEach((key) => keys.add(key));
      } catch (e) {
        // Ignore errors (e.g., non-configurable properties)
      }

      try {
        for (const key in root) {
          keys.add(key);
        }
      } catch (e) {
        // Ignore errors (e.g., non-configurable properties)
      }

      for (const key of keys) {
        let val;
        try {
          const desc = Object.getOwnPropertyDescriptor(root, key);
          if (desc && typeof desc.get === "function") {
            continue; // avoid invoking getters that may throw
          }
          val = root[key];
        } catch (e) {
          continue;
        }

        const cur = `${path}.${key}`;

        try {
          if (predicate(val, key)) {
            out.push({ obj: root, key, path: cur });
          }
        } catch (e) {
          continue;
        }

        const type = typeof val;
        if (
          val !== null &&
          (type === "object" || type === "function") &&
          !seen.has(val) &&
          maxDepth > 1
        ) {
          seen.add(val);
          try {
            out = out.concat(
              this.findAll(val, predicate, seen, cur, maxDepth - 1, opts)
            );
          } catch (e) {
            continue;
          }
        }
      }
      return out;
    },

    scan: function (value) {
      if (DEBUG) console.log("🔍 Scanning for:", value, "type:", typeof value);
      this.hits = this.findAll(window, (v) => v === value);
      if (DEBUG) console.log("✅ Found hits:", this.hits.length);
      if (DEBUG && this.hits.length > 0) {
        console.log("📍 First few hits:", this.hits.slice(0, 5));
      }
      return this.hits.length;
    },

    refine: function (value) {
      const oldCount = this.hits.length;
      this.hits = this.hits.filter(({ obj, key }) => {
        try {
          return obj[key] === value;
        } catch {
          return false;
        }
      });
      if (DEBUG) console.log(`🔬 Refined from ${oldCount} to ${this.hits.length} hits`);
      return this.hits.length;
    },

    scanByName: function (name) {
      if (DEBUG) console.log("🔍 Scanning by name:", name);
      this.hits = this.findAll(window, (val, k) => {
        // match key substring and ensure the value is primitive
        const matches = k.toLowerCase().includes(name.toLowerCase());
        const isPrimitive =
          val === null ||
          (typeof val !== "object" && typeof val !== "function");
        return matches && isPrimitive;
      });
      if (DEBUG) console.log("✅ Found hits:", this.hits.length);
      if (DEBUG && this.hits.length > 0) {
        console.log("📍 First few hits:", this.hits.slice(0, 5));
      }
      return this.hits.length;
    },

    refineByName: function (name) {
      const oldCount = this.hits.length;
      this.hits = this.hits.filter(({ obj, key }) => {
        // filter by key substring and primitive value
        const matches = key.toLowerCase().includes(name.toLowerCase());
        let val;
        try {
          val = obj[key];
        } catch {
          return false;
        }
        const isPrimitive =
          val === null ||
          (typeof val !== "object" && typeof val !== "function");
        return matches && isPrimitive;
      });
      if (DEBUG)
        console.log(
          `🔬 Refined by name from ${oldCount} to ${this.hits.length} hits`
        );
      return this.hits.length;
    },

    list: function () {
      const result = this.hits.map(({ obj, key, path }) => {
        let rawValue;
        try {
          rawValue = obj[key];
        } catch (e) {
          return { path, value: `[${e.message}]` };
        }
        const value =
          typeof rawValue === "function" ? rawValue.toString() : rawValue;
        return { path, value };
      });
      if (DEBUG) console.table(result);
      return result;
    },

    poke: function (idx, value) {
      const hit = this.hits[idx];
      if (!hit) {
        console.error("❌ Invalid index:", idx);
        return false;
      }
      const oldVal = hit.obj[hit.key];
      hit.obj[hit.key] = value;
      if (DEBUG) console.log(`🎯 Changed ${hit.path}: ${oldVal} → ${value}`);
      return true;
    },

    pokeByPath: function (path, value) {
      try {
        if (DEBUG) console.log("🎯 pokeByPath called with:", path, "value:", value);

        const pathParts = parsePath(path);
        if (DEBUG) console.log("🎯 Path parts:", pathParts);

        let obj = window;

        for (let i = 1; i < pathParts.length - 1; i++) {
          if (DEBUG) console.log("🎯 Navigating to: " + pathParts[i]);
          obj = obj[pathParts[i]];
          if (obj === undefined || obj === null) {
            console.error("❌ Path not found at:", pathParts[i]);
            return {
              success: false,
              error: "Path not found at: " + pathParts[i],
            };
          }
        }

        const key = pathParts[pathParts.length - 1];
        if (DEBUG) console.log("🎯 Final key:", key);
        if (DEBUG) console.log("🎯 Target object:", obj);
        if (DEBUG) console.log("🎯 Current value:", obj[key]);

        if (!(key in obj)) {
          console.error("❌ Property not found:", key);
          return { success: false, error: "Property not found: " + key };
        }

        const oldVal = obj[key];
        obj[key] = value;

        if (DEBUG)
          console.log(
            "🎯 Successfully changed " + path + ": " + oldVal + " → " + value
          );
        if (DEBUG) console.log("🎯 Verification - new value:", obj[key]);

        return { success: true, oldValue: oldVal, newValue: value };
      } catch (error) {
        console.error("❌ Error in pokeByPath:", error);
        return { success: false, error: error.message };
      }
    },

    frozen: new Map(),

    freezeByPath: function (path, value) {
      try {
        const parts = parsePath(path);
        let obj = window;
        for (let i = 1; i < parts.length - 1; i++) {
          obj = obj[parts[i]];
          if (obj === undefined || obj === null) {
            return { success: false, error: "Path not found at: " + parts[i] };
          }
        }
        const key = parts[parts.length - 1];
        if (!(key in obj)) {
          return { success: false, error: "Property not found: " + key };
        }

        this.unfreezeByPath(path);
        const timer = setInterval(() => {
          try {
            obj[key] = value;
          } catch (e) {
            console.error("Freeze error", e);
          }
        }, 100);

        this.frozen.set(path, { timer });
        if (DEBUG) console.log("❄️ Frozen", path, "to", value);
        return { success: true };
      } catch (error) {
        console.error("freezeByPath error", error);
        return { success: false, error: error.message };
      }
    },

    unfreezeByPath: function (path) {
      const entry = this.frozen.get(path);
      if (entry) {
        clearInterval(entry.timer);
        this.frozen.delete(path);
        if (DEBUG) console.log("🧊 Unfrozen", path);
        return { success: true };
      }
      return { success: false, error: "Not frozen" };
    },

    showHits: function () {
      if (this.hits.length === 0) {
        if (DEBUG) console.log("📭 No hits found");
        return;
      }
      if (DEBUG) console.log(`📋 ${this.hits.length} hits:`);
      this.hits.forEach((hit, i) => {
        if (DEBUG)
          console.log(`[${i}] ${hit.path} = ${JSON.stringify(hit.obj[hit.key])}`);
      });
    },

    test: function () {
      return {
        scannerLoaded: true,
        gameScore: window.gameScore || "undefined",
        hitCount: this.hits.length,
        windowVars: Object.keys(window)
          .filter((k) => !k.startsWith("__"))
          .slice(0, 10),
      };
    },
  };

  /* -------- PostMessage‑Bridge für das Content‑Script -------- */
  const REQ = "__jsCheaterRequest";
  const RES = "__jsCheaterResponse";

  window.addEventListener(
    "message",
    (ev) => {
      if (ev.source !== window || ev.data?.type !== REQ) return;
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
              data.value
            );
            break;
          case "unfreeze":
            result = window.__cheatScanner__.unfreezeByPath(data.path);
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
    false
  );

  if (DEBUG)
    console.log(
      "🎮 JS-Cheater Scanner bereit! Verwende window.__cheatScanner__.scan(wert)"
    );
})();
