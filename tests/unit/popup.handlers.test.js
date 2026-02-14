/* global describe, test, expect, beforeEach, afterEach */
import { jest } from "@jest/globals";

// Mock dependencies used by popup handlers
jest.mock("../../src/popup/communication.js", () => ({
  send: jest.fn(),
  checkScannerStatus: jest.fn(),
  setActiveTab: jest.fn(),
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

let send, showError, showRefineScanState, showInitialScanState, updateList;

let onInject, onStart, onRefine, onNewSearch, startPolling;

beforeEach(async () => {
  jest.useFakeTimers();
  jest.resetModules();
  ({ send } = await import("../../src/popup/communication.js"));
  ({ showError } = await import("../../src/popup/messages.js"));
  ({ showRefineScanState, showInitialScanState, updateList } = await import("../../src/popup/ui.js"));
  document.body.innerHTML = `
    <input id="value" />
    <select id="searchType"><option value="value">value</option><option value="name">name</option></select>
    <div id="initialScanGroup"></div>
    <div id="refineScanGroup"></div>
    <ul id="hits"></ul>
    <button id="inject"></button>
    <button id="start"></button>
    <button id="refine"></button>
    <button id="newSearch"></button>
    <div id="instructions"></div>
    <div id="scannerUI"></div>
    <div id="setupSection"></div>
  `;

  global.navigator.clipboard = { writeText: jest.fn().mockResolvedValue() };
  document.execCommand = jest.fn();
  global.alert = jest.fn();
  globalThis.chrome = {
    tabs: {
      query: jest.fn().mockResolvedValue([{ id: 1 }]),
      executeScript: jest.fn().mockResolvedValue(),
    },
    scripting: { executeScript: jest.fn().mockResolvedValue() },
  };

  const popup = await import("../../src/popup/popup.js");
  jest.spyOn(popup, "startPolling").mockImplementation(jest.fn());
  startPolling = popup.startPolling;

  const { checkScannerStatus } = await import("../../src/popup/communication.js");
  checkScannerStatus.mockResolvedValue(false);

  await document.dispatchEvent(new Event("DOMContentLoaded"));
  await Promise.resolve();
  ({ onInject, onStart, onRefine, onNewSearch } = popup);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  delete globalThis.chrome;
  delete global.navigator.clipboard;
  delete document.execCommand;
});

describe("popup handlers", () => {
  test("onInject copies code", async () => {
    await onInject();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(globalThis.chrome.scripting.executeScript).toHaveBeenCalled();
  });

  test("onInject falls back to tabs.executeScript", async () => {
    globalThis.chrome.scripting.executeScript = undefined;

    await onInject();
    expect(globalThis.chrome.tabs.executeScript).toHaveBeenCalledWith(1, {
      file: "src/content.js",
    });
  });

  test("onStart sends start command and switches state", async () => {
    document.getElementById("value").value = "42";
    document.getElementById("searchType").value = "value";
    send.mockResolvedValue(3);

    await onStart();
    expect(send).toHaveBeenCalledWith("start", { value: 42 });
    expect(showError).toHaveBeenCalledWith("Scanne...");
    await Promise.resolve();
    expect(showError).toHaveBeenCalledWith("✅ 3 Treffer gefunden");
    expect(showRefineScanState).toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(updateList).toHaveBeenCalled();
  });

  test("onRefine sends refine command", async () => {
    document.getElementById("value").value = "21";
    document.getElementById("searchType").value = "value";
    send.mockResolvedValue(1);

    await onRefine();
    expect(send).toHaveBeenCalledWith("refine", { value: 21 });
    await Promise.resolve();
    expect(showError).toHaveBeenCalledWith("🔬 1 Treffer nach Verfeinerung");
    jest.runOnlyPendingTimers();
    expect(updateList).toHaveBeenCalled();
  });

  test("onNewSearch resets when input empty", async () => {
    document.getElementById("value").value = "";
    document.getElementById("searchType").value = "value";

    await onNewSearch();
    expect(send.mock.calls[0][0]).toBe("start");
    expect(send.mock.calls[0][1].value).toMatch(/^__RESET_SCAN__/);
    expect(showInitialScanState).toHaveBeenCalled();
    expect(document.getElementById("hits").innerHTML).toContain("Erster Scan");
  });

  test("onStart ohne Eingabe", async () => {
    document.getElementById("value").value = "";
    document.getElementById("searchType").value = "value";

    await onStart();
    expect(showError).toHaveBeenCalledWith("Bitte einen Wert eingeben");
    expect(send).not.toHaveBeenCalled();
  });

  test("onRefine mit Fehlerantwort", async () => {
    document.getElementById("value").value = "7";
    document.getElementById("searchType").value = "value";
    send.mockResolvedValue({ error: "fail" });

    await onRefine();
    await Promise.resolve();
    expect(showError).toHaveBeenCalledWith("❌ fail");
    expect(updateList).not.toHaveBeenCalled();
  });
});
