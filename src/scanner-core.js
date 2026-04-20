import { parsePath } from "./parse-path.js";

// Path parsing utility function

// Keyword lists used to prioritize game-like property names during scans.
const GAME_KEYWORDS_CORE = Object.freeze([
  "game",
  "player",
  "party",
  "actor",
  "character",
  "unit",
  "hero",
  "hp",
  "sp",
  "mp",
  "health",
  "mana",
  "stamina",
  "state",
  "stats",
  "data",
]);
const GAME_KEYWORDS_VALUE = Object.freeze([
  ...GAME_KEYWORDS_CORE,
  "gold",
  "coin",
  "score",
]);

export function createScanner(DEBUG = false) {
  return {
    hits: [],

    _avoidGetterCache: null,

    shouldAvoidGetterEvaluation: function () {
      if (this._avoidGetterCache !== null) return this._avoidGetterCache;
      let result = false;
      try {
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.userAgent === "string" &&
          /jsdom/i.test(navigator.userAgent)
        ) {
          result = true;
        }
      } catch {
        // Ignore environment detection errors.
      }

      if (!result) {
        try {
          if (
            typeof window !== "undefined" &&
            Object.prototype.hasOwnProperty.call(window, "_globalObject")
          ) {
            result = true;
          }
        } catch {
          // Ignore environment detection errors.
        }
      }

      this._avoidGetterCache = result;
      return result;
    },

    collectKeys: function (root, opts = {}) {
      const includeNonEnumerableKeys = opts.includeNonEnumerableKeys === true;
      const maxKeysPerObject = opts.maxKeysPerObject || 0;
      const keyHint =
        typeof opts.keyHint === "string" ? opts.keyHint.toLowerCase() : "";
      const priorityPatterns = Array.isArray(opts.priorityPatterns)
        ? opts.priorityPatterns
            .filter(
              (pattern) => typeof pattern === "string" && pattern.trim() !== "",
            )
            .map((pattern) => pattern.toLowerCase())
        : [];

      const keySet = new Set();
      if (includeNonEnumerableKeys) {
        try {
          Object.getOwnPropertyNames(root).forEach((key) => keySet.add(key));
        } catch {
          // Ignore errors (e.g., non-configurable properties)
        }
      }

      try {
        Object.keys(root).forEach((key) => keySet.add(key));
      } catch {
        // Ignore errors (e.g., non-configurable properties)
      }

      try {
        for (const key in root) {
          keySet.add(key);
        }
      } catch {
        // Ignore errors (e.g., non-configurable properties)
      }

      const preferred = [];
      const normal = [];
      for (const key of keySet) {
        const keyString = String(key);
        const lowerKey = keyString.toLowerCase();
        const matchesHint = keyHint && lowerKey.includes(keyHint);
        const matchesPriority =
          !matchesHint &&
          priorityPatterns.some((pattern) => lowerKey.includes(pattern));

        if (matchesHint || matchesPriority) {
          preferred.push(keyString);
        } else {
          normal.push(keyString);
        }
      }

      const ordered = preferred.concat(normal);
      if (maxKeysPerObject > 0 && ordered.length > maxKeysPerObject) {
        return ordered.slice(0, maxKeysPerObject);
      }
      return ordered;
    },

    findAll: function (
      root,
      predicate,
      seen = new WeakSet(),
      path = "window",
      maxDepth = 5,
      opts = {},
    ) {
      let out = [];
      if (maxDepth <= 0) return out;
      if (!root || (typeof root !== "object" && typeof root !== "function")) {
        return out;
      }
      if (seen.has(root)) return out;
      seen.add(root);

      // Skip prototype objects to avoid triggering illegal invocation errors
      if (
        typeof root === "object" &&
        root.constructor &&
        root.constructor.prototype === root
      ) {
        return out;
      }

      if (!opts.startTime) opts.startTime = performance.now();
      const start = opts.startTime;
      const maxTime = opts.maxTime || 3000;
      const allowGetters =
        opts.allowGetters && !this.shouldAvoidGetterEvaluation();
      if (!opts.traversalState) {
        opts.traversalState = { hitCount: 0 };
      }
      const maxHits = opts.maxHits || 0;
      if (performance.now() - start > maxTime) return out;
      if (maxHits > 0 && opts.traversalState.hitCount >= maxHits) return out;

      const keys = this.collectKeys(root, opts);

      for (const key of keys) {
        if (performance.now() - start > maxTime) break;
        let val;
        try {
          if (allowGetters) {
            val = root[key];
          } else {
            const desc = Object.getOwnPropertyDescriptor(root, key);
            if (desc && typeof desc.get === "function" && !("value" in desc)) {
              continue; // avoid invoking getters unless explicitly requested
            }
            val = root[key];
          }
        } catch {
          continue;
        }

        const cur = `${path}.${key}`;

        try {
          if (predicate(val, key)) {
            out.push({ obj: root, key, path: cur });
            opts.traversalState.hitCount += 1;
            if (maxHits > 0 && opts.traversalState.hitCount >= maxHits) {
              break;
            }
          }
        } catch {
          continue;
        }

        const type = typeof val;
        if (
          val !== null &&
          (type === "object" || type === "function") &&
          maxDepth > 1
        ) {
          if (maxHits > 0 && opts.traversalState.hitCount >= maxHits) {
            break;
          }
          try {
            out = out.concat(
              this.findAll(val, predicate, seen, cur, maxDepth - 1, opts),
            );
          } catch {
            continue;
          }
        }
      }
      return out;
    },
    scan: function (value) {
      if (DEBUG) console.log("🔍 Scanning for:", value, "type:", typeof value);
      const priorityPatterns = GAME_KEYWORDS_VALUE;
      const exactMatch = (v) => v === value;
      const isNumericTarget =
        typeof value === "number" && Number.isFinite(value);
      const isStringTarget = typeof value === "string";
      const conservativeMode = this.shouldAvoidGetterEvaluation();
      const looseNumericMatch = (v) => {
        if (v === value) return true;
        if (!isNumericTarget) return false;
        if (typeof v === "string" && v.trim() !== "" && Number(v) === value) {
          return true;
        }
        if (typeof v === "bigint") {
          return Number(v) === value;
        }
        return false;
      };

      const passes = [
        {
          predicate: exactMatch,
          depth: isNumericTarget ? 5 : 4,
          opts: {
            maxTime: isNumericTarget ? 1600 : 900,
            allowGetters: false,
            includeNonEnumerableKeys: false,
            maxKeysPerObject: isNumericTarget ? 450 : 320,
            maxHits: isNumericTarget ? 1200 : 450,
            priorityPatterns,
          },
        },
        {
          predicate: exactMatch,
          depth: isNumericTarget ? 8 : 6,
          opts: {
            maxTime: isNumericTarget ? 3600 : 1500,
            allowGetters: isNumericTarget && !isStringTarget,
            includeNonEnumerableKeys: false,
            maxKeysPerObject: isNumericTarget ? 900 : 500,
            maxHits: isNumericTarget ? 1500 : 600,
            priorityPatterns,
          },
        },
      ];

      if (isNumericTarget && !conservativeMode) {
        passes.push({
          predicate: exactMatch,
          depth: 10,
          opts: {
            maxTime: 5000,
            allowGetters: true,
            includeNonEnumerableKeys: true,
            maxKeysPerObject: 1200,
            maxHits: 1800,
            priorityPatterns,
          },
        });
      }

      if (isNumericTarget && !conservativeMode) {
        passes.push({
          predicate: looseNumericMatch,
          depth: 9,
          opts: {
            maxTime: 3200,
            allowGetters: true,
            includeNonEnumerableKeys: true,
            maxKeysPerObject: 1000,
            maxHits: 1000,
            priorityPatterns,
          },
        });
      }

      this.hits = [];
      for (const pass of passes) {
        this.hits = this.findAll(
          window,
          pass.predicate,
          new WeakSet(),
          "window",
          pass.depth,
          pass.opts,
        );
        if (this.hits.length > 0) {
          break;
        }
      }
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
      if (DEBUG)
        console.log(`🔬 Refined from ${oldCount} to ${this.hits.length} hits`);
      return this.hits.length;
    },
    scanByName: function (name) {
      if (DEBUG) console.log("🔍 Scanning by name:", name);
      const loweredName = name.toLowerCase();
      const conservativeMode = this.shouldAvoidGetterEvaluation();
      const priorityPatterns = [loweredName, ...GAME_KEYWORDS_CORE];
      const matchByName = (val, k) => {
        const matches = k.toLowerCase().includes(loweredName);
        const isPrimitive =
          val === null ||
          (typeof val !== "object" && typeof val !== "function");
        return matches && isPrimitive;
      };

      const passes = [
        {
          depth: 5,
          opts: {
            maxTime: 1200,
            allowGetters: false,
            includeNonEnumerableKeys: false,
            maxKeysPerObject: 350,
            maxHits: 800,
            keyHint: loweredName,
            priorityPatterns,
          },
        },
        {
          depth: 8,
          opts: {
            maxTime: 2800,
            allowGetters: true,
            includeNonEnumerableKeys: false,
            maxKeysPerObject: 700,
            maxHits: 1200,
            keyHint: loweredName,
            priorityPatterns,
          },
        },
      ];

      if (!conservativeMode) {
        passes.push({
          depth: 10,
          opts: {
            maxTime: 3500,
            allowGetters: true,
            includeNonEnumerableKeys: true,
            maxKeysPerObject: 1000,
            maxHits: 1500,
            keyHint: loweredName,
            priorityPatterns,
          },
        });
      }

      this.hits = [];
      for (const pass of passes) {
        this.hits = this.findAll(
          window,
          matchByName,
          new WeakSet(),
          "window",
          pass.depth,
          pass.opts,
        );
        if (this.hits.length > 0) {
          break;
        }
      }
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
          `🔬 Refined by name from ${oldCount} to ${this.hits.length} hits`,
        );
      return this.hits.length;
    },

    scanByNameAndValue: function (name, value) {
      if (DEBUG) console.log("🔍 Scanning by name+value:", name, value);
      const loweredName = name.toLowerCase();
      const conservativeMode = this.shouldAvoidGetterEvaluation();
      const priorityPatterns = [loweredName, ...GAME_KEYWORDS_CORE];
      const matchByNameAndValue = (val, k) => {
        const nameMatches = k.toLowerCase().includes(loweredName);
        return nameMatches && val === value;
      };

      const isNumericTarget =
        typeof value === "number" && Number.isFinite(value);
      const looseMatchByNameAndValue = (val, k) => {
        const nameMatches = k.toLowerCase().includes(loweredName);
        if (!nameMatches) return false;
        if (val === value) return true;
        if (!isNumericTarget) return false;
        if (
          typeof val === "string" &&
          val.trim() !== "" &&
          Number(val) === value
        ) {
          return true;
        }
        if (typeof val === "bigint") {
          return Number(val) === value;
        }
        return false;
      };

      const passes = [
        {
          predicate: matchByNameAndValue,
          depth: 5,
          opts: {
            maxTime: 1200,
            allowGetters: false,
            includeNonEnumerableKeys: false,
            maxKeysPerObject: 350,
            maxHits: 800,
            keyHint: loweredName,
            priorityPatterns,
          },
        },
        {
          predicate: matchByNameAndValue,
          depth: 8,
          opts: {
            maxTime: 2800,
            allowGetters: true,
            includeNonEnumerableKeys: false,
            maxKeysPerObject: 700,
            maxHits: 1200,
            keyHint: loweredName,
            priorityPatterns,
          },
        },
      ];

      if (!conservativeMode) {
        passes.push({
          predicate: matchByNameAndValue,
          depth: 10,
          opts: {
            maxTime: 3500,
            allowGetters: true,
            includeNonEnumerableKeys: true,
            maxKeysPerObject: 1000,
            maxHits: 1500,
            keyHint: loweredName,
            priorityPatterns,
          },
        });
      }

      if (isNumericTarget && !conservativeMode) {
        passes.push({
          predicate: looseMatchByNameAndValue,
          depth: 9,
          opts: {
            maxTime: 3200,
            allowGetters: true,
            includeNonEnumerableKeys: true,
            maxKeysPerObject: 1000,
            maxHits: 1000,
            keyHint: loweredName,
            priorityPatterns,
          },
        });
      }

      this.hits = [];
      for (const pass of passes) {
        this.hits = this.findAll(
          window,
          pass.predicate,
          new WeakSet(),
          "window",
          pass.depth,
          pass.opts,
        );
        if (this.hits.length > 0) {
          break;
        }
      }
      if (DEBUG) console.log("✅ Found hits:", this.hits.length);
      if (DEBUG && this.hits.length > 0) {
        console.log("📍 First few hits:", this.hits.slice(0, 5));
      }
      return this.hits.length;
    },

    refineByNameAndValue: function (name, value) {
      const oldCount = this.hits.length;
      const loweredName = name.toLowerCase();
      this.hits = this.hits.filter(({ obj, key }) => {
        const nameMatches = key.toLowerCase().includes(loweredName);
        if (!nameMatches) return false;
        try {
          return obj[key] === value;
        } catch {
          return false;
        }
      });
      if (DEBUG)
        console.log(
          `🔬 Refined by name+value from ${oldCount} to ${this.hits.length} hits`,
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
        if (DEBUG)
          console.log("🎯 pokeByPath called with:", path, "value:", value);

        const pathParts = parsePath(path);
        if (DEBUG) console.log("🎯 Path parts:", pathParts);

        let obj = window;
        const startIdx =
          pathParts[0] === "window" || pathParts[0] === "globalThis" ? 1 : 0;

        for (let i = startIdx; i < pathParts.length - 1; i++) {
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

        if (obj === null || obj === undefined) {
          return { success: false, error: "Cannot set property on null/undefined at: " + key };
        }

        const oldVal = obj[key];
        obj[key] = value;

        if (DEBUG)
          console.log(
            "🎯 Successfully changed " + path + ": " + oldVal + " → " + value,
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
        const startIdx =
          parts[0] === "window" || parts[0] === "globalThis" ? 1 : 0;
        for (let i = startIdx; i < parts.length - 1; i++) {
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
        // Resolve the parent object fresh on every tick so re-created parents
        // (e.g. $gameActors after a scene change) keep getting the frozen value.
        const self = this;
        const timer = setInterval(() => {
          try {
            const resolved = self.pokeByPath(path, value);
            if (resolved && resolved.success === false && DEBUG) {
              console.error("Freeze error", resolved.error);
            }
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
          console.log(
            `[${i}] ${hit.path} = ${JSON.stringify(hit.obj[hit.key])}`,
          );
      });
    },

    detectEngine: function () {
      const checks = [
        {
          id: "rpgmaker-mz-effekseer",
          name: "RPG Maker MZ (Effekseer)",
          test: () =>
            typeof window.$gameParty !== "undefined" &&
            typeof window.$gameActors !== "undefined" &&
            typeof window.effekseer !== "undefined",
        },
        {
          id: "rpgmaker-mv-mz",
          name: "RPG Maker MV / MZ",
          test: () =>
            typeof window.$gameParty !== "undefined" &&
            typeof window.$gameActors !== "undefined" &&
            typeof window.SceneManager !== "undefined" &&
            typeof window.$dataSystem !== "undefined",
        },
        {
          id: "twine",
          name: "Twine / SugarCube",
          test: () =>
            typeof window.SugarCube !== "undefined" ||
            (typeof window.State !== "undefined" &&
              typeof window.State.variables === "object"),
        },
        {
          id: "renpy",
          name: "Ren'Py Web",
          test: () =>
            typeof window.renpy !== "undefined" ||
            (typeof document !== "undefined" &&
              !!document.getElementById("renpy-canvas")),
        },
        {
          id: "bitsy",
          name: "Bitsy",
          test: () => typeof window.bitsy !== "undefined",
        },
        {
          id: "godot",
          name: "Godot (HTML5)",
          test: () =>
            typeof window.Engine !== "undefined" &&
            typeof window.GODOT_CONFIG !== "undefined",
        },
        {
          id: "construct",
          name: "Construct 2/3",
          test: () =>
            typeof window.cr_getC2Runtime === "function" ||
            typeof window.C3 !== "undefined" ||
            typeof window.c3_runtimeInterface !== "undefined",
        },
        {
          id: "phaser",
          name: "Phaser",
          test: () =>
            typeof window.Phaser !== "undefined" &&
            typeof window.Phaser.VERSION === "string",
        },
        {
          id: "unity",
          name: "Unity WebGL",
          test: () =>
            typeof window.unityInstance !== "undefined" ||
            typeof window.UnityLoader !== "undefined" ||
            typeof window.createUnityInstance === "function",
        },
        {
          id: "pixi",
          name: "PixiJS",
          test: () =>
            typeof window.PIXI !== "undefined" &&
            typeof window.PIXI.VERSION === "string",
        },
        {
          id: "js-cheater-testpage",
          name: "JS-Cheater Testseite",
          test: () =>
            typeof window.gameScore === "number" &&
            typeof window.playerLives === "number" &&
            typeof window.playerGold === "number" &&
            typeof window.gameState === "object" &&
            window.gameState !== null &&
            typeof window.gameState.player === "object",
        },
      ];

      for (const check of checks) {
        try {
          if (check.test()) {
            if (DEBUG) console.log("🎮 Engine erkannt:", check.name);
            return { id: check.id, name: check.name };
          }
        } catch {
          // skip failing detection
        }
      }
      return null;
    },

    readPath: function (path) {
      try {
        const pathParts = parsePath(path);
        let obj = window;
        const startIdx =
          pathParts[0] === "window" || pathParts[0] === "globalThis" ? 1 : 0;
        for (let i = startIdx; i < pathParts.length; i++) {
          if (obj === undefined || obj === null) {
            return { error: "Path not found at: " + pathParts[i] };
          }
          obj = obj[pathParts[i]];
        }
        return { value: obj };
      } catch (error) {
        return { error: error.message };
      }
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
}
