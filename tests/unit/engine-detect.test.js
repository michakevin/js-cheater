/* global describe, test, expect, beforeEach, afterEach, jest */
import { SCANNER_CODE } from "../../src/popup/scanner-code.js";
import {
  ENGINE_PRESETS,
  getPresetsForEngine,
} from "../../src/popup/engine-presets.js";

function loadScanner() {
  const originalConsoleLog = console.log;
  console.log = jest.fn();
  eval(SCANNER_CODE);
  console.log = originalConsoleLog;
}

describe("detectEngine", () => {
  beforeEach(() => {
    delete window.__cheatScanner__;
    // Clean up engine globals
    delete window.$gameParty;
    delete window.$gameActors;
    delete window.SceneManager;
    delete window.$dataSystem;
    delete window.effekseer;
    delete window.Phaser;
    delete window.PIXI;
    delete window.SugarCube;
    delete window.State;
    delete window.renpy;
    delete window.bitsy;
    delete window.C3;
    delete window.cr_getC2Runtime;
    delete window.c3_runtimeInterface;
    delete window.unityInstance;
    delete window.UnityLoader;
    delete window.createUnityInstance;
    delete window.gameScore;
    delete window.playerLives;
    delete window.playerGold;
    delete window.gameState;
  });

  afterEach(() => {
    delete window.__cheatScanner__;
    delete window.$gameParty;
    delete window.$gameActors;
    delete window.SceneManager;
    delete window.$dataSystem;
    delete window.effekseer;
    delete window.Phaser;
    delete window.PIXI;
    delete window.SugarCube;
    delete window.State;
    delete window.renpy;
    delete window.bitsy;
    delete window.C3;
    delete window.cr_getC2Runtime;
    delete window.c3_runtimeInterface;
    delete window.unityInstance;
    delete window.UnityLoader;
    delete window.createUnityInstance;
    delete window.gameScore;
    delete window.playerLives;
    delete window.playerGold;
    delete window.gameState;
  });

  test("returns null when no engine detected", () => {
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).toBeNull();
  });

  test("detects RPG Maker MV/MZ", () => {
    window.$gameParty = { _gold: 500 };
    window.$gameActors = { _data: [] };
    window.SceneManager = {};
    window.$dataSystem = {};
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("rpgmaker-mv-mz");
    expect(result.name).toContain("RPG Maker");
  });

  test("detects RPG Maker MZ with Effekseer", () => {
    window.$gameParty = { _gold: 100 };
    window.$gameActors = { _data: [] };
    window.SceneManager = {};
    window.$dataSystem = {};
    window.effekseer = {};
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("rpgmaker-mz-effekseer");
  });

  test("detects Phaser", () => {
    window.Phaser = { VERSION: "3.60.0", Game: function () {} };
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("phaser");
    expect(result.name).toBe("Phaser");
  });

  test("detects PixiJS", () => {
    window.PIXI = { VERSION: "7.0.0" };
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("pixi");
  });

  test("detects Construct 2", () => {
    window.cr_getC2Runtime = function () {};
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("construct");
  });

  test("detects Construct 3", () => {
    window.C3 = {};
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("construct");
  });

  test("detects Twine/SugarCube", () => {
    window.SugarCube = {};
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("twine");
  });

  test("detects Unity WebGL", () => {
    window.createUnityInstance = function () {};
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("unity");
  });

  test("detects Bitsy", () => {
    window.bitsy = {};
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("bitsy");
  });

  test("RPG Maker takes priority over PixiJS", () => {
    // RPG Maker MV/MZ uses PixiJS internally, so RPG Maker should be detected first
    window.$gameParty = { _gold: 0 };
    window.$gameActors = { _data: [] };
    window.SceneManager = {};
    window.$dataSystem = {};
    window.PIXI = { VERSION: "5.3.12" };
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("rpgmaker-mv-mz");
  });

  test("detects JS-Cheater test page", () => {
    window.gameScore = 1337;
    window.playerLives = 3;
    window.playerGold = 999;
    window.gameState = {
      player: { stats: { score: 1337 }, inventory: {} },
      level: 5,
    };
    loadScanner();
    const result = window.__cheatScanner__.detectEngine();
    expect(result).not.toBeNull();
    expect(result.id).toBe("js-cheater-testpage");
    expect(result.name).toContain("Testseite");
  });
});

describe("readPath", () => {
  beforeEach(() => {
    delete window.__cheatScanner__;
    window.testObj = { nested: { value: 42 } };
    loadScanner();
  });

  afterEach(() => {
    delete window.__cheatScanner__;
    delete window.testObj;
  });

  test("reads a nested path value", () => {
    const result = window.__cheatScanner__.readPath("testObj.nested.value");
    expect(result).toEqual({ value: 42 });
  });

  test("returns error for invalid path", () => {
    const result = window.__cheatScanner__.readPath("nonExistent.foo.bar");
    expect(result.error).toBeDefined();
  });
});

describe("engine-presets", () => {
  test("ENGINE_PRESETS is a non-empty array", () => {
    expect(Array.isArray(ENGINE_PRESETS)).toBe(true);
    expect(ENGINE_PRESETS.length).toBeGreaterThan(0);
  });

  test("each preset has required fields", () => {
    for (const engine of ENGINE_PRESETS) {
      expect(engine.id).toBeDefined();
      expect(engine.name).toBeDefined();
      expect(engine.icon).toBeDefined();
      expect(engine.description).toBeDefined();
      expect(Array.isArray(engine.presets)).toBe(true);
      expect(engine.presets.length).toBeGreaterThan(0);
    }
  });

  test("each preset item has label and category", () => {
    for (const engine of ENGINE_PRESETS) {
      for (const preset of engine.presets) {
        expect(preset.label).toBeDefined();
        expect(preset.category).toBeDefined();
        // Must have either path or searchName
        const hasAction = preset.path || preset.searchName;
        expect(hasAction).toBeTruthy();
      }
    }
  });

  test("getPresetsForEngine finds correct engine", () => {
    const rpg = getPresetsForEngine("rpgmaker-mv-mz");
    expect(rpg).toBeDefined();
    expect(rpg.name).toContain("RPG Maker");
  });

  test("getPresetsForEngine returns undefined for unknown id", () => {
    const result = getPresetsForEngine("nonexistent-engine");
    expect(result).toBeUndefined();
  });

  test("RPG Maker preset has gold path", () => {
    const rpg = getPresetsForEngine("rpgmaker-mv-mz");
    const goldPreset = rpg.presets.find((p) => p.path === "$gameParty._gold");
    expect(goldPreset).toBeDefined();
    expect(goldPreset.label).toContain("Gold");
  });
});
