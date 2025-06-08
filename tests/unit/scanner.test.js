/* global describe, test, expect, beforeEach, afterEach, jest */
import { SCANNER_CODE } from "../../src/popup/scanner-code.js";

describe("scanByName", () => {
  beforeEach(() => {
    window.gameScore = 1337;
    delete window.__cheatScanner__;

    // Temporarily silence console for scanner loading
    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  test("finds hits by variable name", () => {
    const count = window.__cheatScanner__.scanByName("gameScore");
    expect(count).toBeGreaterThan(0);
    const hits = window.__cheatScanner__.list();
    expect(hits[0].path).toContain("gameScore");
  });
});

describe("freezeByPath", () => {
  beforeEach(() => {
    window.gameScore = 10;
    delete window.__cheatScanner__;
    jest.useFakeTimers();

    // Temporarily silence console for scanner loading
    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("freezes and unfreezes value", () => {
    window.__cheatScanner__.freezeByPath("window.gameScore", 5);
    window.gameScore = 1;
    jest.advanceTimersByTime(120);
    expect(window.gameScore).toBe(5);
    window.__cheatScanner__.unfreezeByPath("window.gameScore");
    window.gameScore = 2;
    jest.advanceTimersByTime(120);
    expect(window.gameScore).toBe(2);
  });
});

describe("scan and refine", () => {
  beforeEach(() => {
    window.varA = 9999;
    window.varB = 9999;
    delete window.__cheatScanner__;

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  test("refine reduces hit count", () => {
    const initial = window.__cheatScanner__.scan(9999);
    window.varB = 1;
    const refined = window.__cheatScanner__.refine(9999);
    expect(refined).toBeLessThan(initial);
    expect(refined).toBeGreaterThan(0);
  });
});

describe("refineByName", () => {
  beforeEach(() => {
    window.fooScore = 1;
    window.barScore = 2;
    delete window.__cheatScanner__;

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  test("filters hits by name", () => {
    const count = window.__cheatScanner__.scanByName("score");
    const refined = window.__cheatScanner__.refineByName("foo");
    expect(refined).toBeLessThan(count);
    const paths = window.__cheatScanner__.list().map((h) => h.path);
    const match = paths.find((p) => p.includes("fooScore"));
    expect(match).toBeDefined();
  });
});

describe("poke and pokeByPath", () => {
  beforeEach(() => {
    window.pokeVar = 11;
    window.nestedObj = { val: 22 };
    delete window.__cheatScanner__;

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  test("poke changes value via index", () => {
    window.__cheatScanner__.scanByName("pokeVar");
    const ok = window.__cheatScanner__.poke(0, 33);
    expect(ok).toBe(true);
    expect(window.pokeVar).toBe(33);
  });

  test("pokeByPath changes nested value", () => {
    const res = window.__cheatScanner__.pokeByPath("window.nestedObj.val", 44);
    expect(res.success).toBe(true);
    expect(window.nestedObj.val).toBe(44);
  });
});

describe("list and helpers", () => {
  beforeEach(() => {
    window.listVar = 55;
    delete window.__cheatScanner__;

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  test("list returns path/value pairs", () => {
    window.__cheatScanner__.scanByName("listVar");
    const list = window.__cheatScanner__.list();
    const item = list.find((e) => e.path.includes("listVar"));
    expect(item).toBeDefined();
    expect(item.value).toBe(55);
  });

  test("showHits reports when empty", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    window.__cheatScanner__.hits = [];
    window.__cheatScanner__.showHits();
    expect(logSpy).toHaveBeenCalledWith("📭 No hits found");
    logSpy.mockRestore();
  });

  test("test returns scanner info", () => {
    const info = window.__cheatScanner__.test();
    expect(info.scannerLoaded).toBe(true);
    expect(info.hitCount).toBe(0);
  });
});
