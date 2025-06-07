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

import { startPolling } from "../../src/popup/popup.js";
import { checkScannerStatus } from "../../src/popup/communication.js";
import { showScannerMode } from "../../src/popup/ui.js";
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
});
