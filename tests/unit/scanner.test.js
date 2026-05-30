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

  test("freezes value without window. prefix", () => {
    window.__cheatScanner__.freezeByPath("gameScore", 7);
    window.gameScore = 1;
    jest.advanceTimersByTime(120);
    expect(window.gameScore).toBe(7);
    window.__cheatScanner__.unfreezeByPath("gameScore");
    window.gameScore = 3;
    jest.advanceTimersByTime(120);
    expect(window.gameScore).toBe(3);
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

describe("scanByNameAndValue", () => {
  beforeEach(() => {
    window.playerHp = 100;
    window.enemyHp = 100;
    window.playerScore = 100;
    delete window.__cheatScanner__;

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  afterEach(() => {
    delete window.playerHp;
    delete window.enemyHp;
    delete window.playerScore;
  });

  test("finds hits matching both name and value", () => {
    const count = window.__cheatScanner__.scanByNameAndValue("hp", 100);
    expect(count).toBeGreaterThan(0);
    const paths = window.__cheatScanner__.list().map((h) => h.path);
    expect(paths.some((p) => p.includes("Hp") || p.includes("hp"))).toBe(true);
    expect(paths.some((p) => p.includes("playerScore"))).toBe(false);
  });

  test("returns 0 when name matches but value does not", () => {
    const count = window.__cheatScanner__.scanByNameAndValue("hp", 9999);
    expect(count).toBe(0);
  });
});

describe("refineByNameAndValue", () => {
  beforeEach(() => {
    window.playerHp = 100;
    window.enemyHp = 100;
    delete window.__cheatScanner__;

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  afterEach(() => {
    delete window.playerHp;
    delete window.enemyHp;
  });

  test("filters hits by name and value", () => {
    const initial = window.__cheatScanner__.scanByNameAndValue("hp", 100);
    expect(initial).toBeGreaterThan(0);
    window.enemyHp = 50;
    const refined = window.__cheatScanner__.refineByNameAndValue("hp", 100);
    expect(refined).toBeLessThan(initial);
    expect(refined).toBeGreaterThan(0);
    const paths = window.__cheatScanner__.list().map((h) => h.path);
    expect(paths.some((p) => p.includes("playerHp"))).toBe(true);
  });
});

describe("getter fallback scan", () => {
  beforeEach(() => {
    delete window.__cheatScanner__;

    Object.defineProperty(window, "gameStateGetter", {
      configurable: true,
      enumerable: true,
      get() {
        return { gold: 6100, gems: 42 };
      },
    });

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  afterEach(() => {
    delete window.gameStateGetter;
  });

  test("finds value behind getter object", () => {
    const scanner = window.__cheatScanner__;
    const originalCollectKeys = scanner.collectKeys;
    const originalShouldAvoid = scanner.shouldAvoidGetterEvaluation;
    scanner.shouldAvoidGetterEvaluation = () => false;
    scanner.collectKeys = function (root, opts) {
      if (root === window) return ["gameStateGetter"];
      return originalCollectKeys.call(this, root, opts);
    };

    const count = window.__cheatScanner__.scan(6100);
    scanner.collectKeys = originalCollectKeys;
    scanner.shouldAvoidGetterEvaluation = originalShouldAvoid;

    expect(count).toBeGreaterThan(0);
    const paths = window.__cheatScanner__.list().map((entry) => entry.path);
    expect(paths.some((p) => p.toLowerCase().includes("gold"))).toBe(true);
  });

  test("finds name behind getter object", () => {
    const scanner = window.__cheatScanner__;
    const originalCollectKeys = scanner.collectKeys;
    const originalShouldAvoid = scanner.shouldAvoidGetterEvaluation;
    scanner.shouldAvoidGetterEvaluation = () => false;
    scanner.collectKeys = function (root, opts) {
      if (root === window) return ["gameStateGetter"];
      return originalCollectKeys.call(this, root, opts);
    };

    const count = window.__cheatScanner__.scanByName("gold");
    scanner.collectKeys = originalCollectKeys;
    scanner.shouldAvoidGetterEvaluation = originalShouldAvoid;

    expect(count).toBeGreaterThan(0);
  });
});

describe("numeric string fallback scan", () => {
  beforeEach(() => {
    delete window.__cheatScanner__;
    window.hpTextValue = "987654321";

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  afterEach(() => {
    delete window.hpTextValue;
  });

  test("finds numeric values stored as strings", () => {
    const scanner = window.__cheatScanner__;
    const originalCollectKeys = scanner.collectKeys;
    const originalShouldAvoid = scanner.shouldAvoidGetterEvaluation;
    scanner.shouldAvoidGetterEvaluation = () => false;
    scanner.collectKeys = function (root, opts) {
      if (root === window) return ["hpTextValue"];
      return originalCollectKeys.call(this, root, opts);
    };

    const count = window.__cheatScanner__.scan(987654321);
    scanner.collectKeys = originalCollectKeys;
    scanner.shouldAvoidGetterEvaluation = originalShouldAvoid;

    expect(count).toBeGreaterThan(0);
    const paths = window.__cheatScanner__.list().map((entry) => entry.path);
    expect(paths.some((p) => p.includes("hpTextValue"))).toBe(true);
  });

  test("refine keeps numeric values stored as strings", () => {
    const scanner = window.__cheatScanner__;
    const originalCollectKeys = scanner.collectKeys;
    const originalShouldAvoid = scanner.shouldAvoidGetterEvaluation;
    scanner.shouldAvoidGetterEvaluation = () => false;
    scanner.collectKeys = function (root, opts) {
      if (root === window) return ["hpTextValue"];
      return originalCollectKeys.call(this, root, opts);
    };

    scanner.scan(987654321);
    // refine() must apply the same looseness as scan(): the string-stored value
    // is still the correct hit and must not be discarded.
    const refined = scanner.refine(987654321);
    scanner.collectKeys = originalCollectKeys;
    scanner.shouldAvoidGetterEvaluation = originalShouldAvoid;

    expect(refined).toBeGreaterThan(0);
    const paths = scanner.list().map((entry) => entry.path);
    expect(paths.some((p) => p.includes("hpTextValue"))).toBe(true);
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

  test("pokeByPath works without window. prefix", () => {
    const res = window.__cheatScanner__.pokeByPath("nestedObj.val", 55);
    expect(res.success).toBe(true);
    expect(window.nestedObj.val).toBe(55);
  });

  test("pokeByPath works for top-level var without window. prefix", () => {
    const res = window.__cheatScanner__.pokeByPath("pokeVar", 66);
    expect(res.success).toBe(true);
    expect(window.pokeVar).toBe(66);
  });
});

describe("list and helpers", () => {
  beforeEach(() => {
    window.listVar = 55;
    delete window.__cheatScanner__;

    window.__jsCheaterDebug__ = true;

    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  afterEach(() => {
    delete window.__jsCheaterDebug__;
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

describe("findAll robustness", () => {
  beforeEach(() => {
    delete window.__cheatScanner__;
    const originalConsoleLog = console.log;
    console.log = jest.fn();
    eval(SCANNER_CODE);
    console.log = originalConsoleLog;
  });

  test("does not throw on a root with a throwing constructor getter", () => {
    const scanner = window.__cheatScanner__;
    const evil = { hp: 100 };
    Object.defineProperty(evil, "constructor", {
      get() {
        throw new Error("boom");
      },
    });

    // The previously unguarded constructor/prototype access threw here,
    // aborting the whole scan pass. It must now bail this branch gracefully.
    let out;
    expect(() => {
      out = scanner.findAll(evil, (v) => v === 100);
    }).not.toThrow();
    expect(Array.isArray(out)).toBe(true);
  });
});
