/* global describe, test, expect, beforeEach, afterEach */
import { jest } from "@jest/globals";

// Mock dependencies before importing the module
jest.mock("../../src/popup/communication.js", () => ({
  checkScannerStatus: jest.fn(),
  send: jest.fn(),
}));

jest.mock("../../src/popup/ui.js", () => ({
  showSetupMode: jest.fn(),
  showScannerMode: jest.fn(),
  showInitialScanState: jest.fn(),
  showRefineScanState: jest.fn(),
  updateList: jest.fn(),
}));

jest.mock("../../src/popup/messages.js", () => ({
  showError: jest.fn(),
}));

import * as popup from "../../src/popup/popup.js";
const { startPolling, startConnectionMonitor, stopConnectionMonitor } = popup;
import { checkScannerStatus } from "../../src/popup/communication.js";
import { showScannerMode, showSetupMode } from "../../src/popup/ui.js";
import { showError } from "../../src/popup/messages.js";

describe("startPolling", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="instructions" style="display:none"></div><ul id="hits"></ul>';
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("shows error when scanner never loads", async () => {
    checkScannerStatus.mockResolvedValue(false);
    startPolling();

    // fast-forward 30s
    jest.advanceTimersByTime(30000);
    // allow any pending promises to resolve
    await Promise.resolve();

    expect(showError).toHaveBeenCalledWith(
      "Scanner nicht gefunden – Code korrekt eingefügt?"
    );
    expect(showScannerMode).not.toHaveBeenCalled();
    expect(document.getElementById("instructions").style.display).toBe("block");
  });

  test("scanner found quickly", async () => {
    checkScannerStatus.mockResolvedValue(true);
    const monitorSpy = jest.spyOn(popup, "startConnectionMonitor");
    startPolling();

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(showScannerMode).toHaveBeenCalledTimes(1);
    expect(monitorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("connection monitoring", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    stopConnectionMonitor();
    jest.useRealTimers();
  });

  test("fallback to setup mode after repeated failures", async () => {
    checkScannerStatus.mockResolvedValue(false);
    startConnectionMonitor();

    jest.advanceTimersByTime(15000);
    await Promise.resolve();

    expect(showError).toHaveBeenCalledWith(
      "Scanner-Verbindung verloren – bitte Code erneut einfügen"
    );
    expect(showSetupMode).toHaveBeenCalled();
  });
});
