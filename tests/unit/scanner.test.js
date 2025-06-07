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
