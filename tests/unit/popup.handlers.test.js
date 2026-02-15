/* global describe, test, expect, beforeEach, afterEach */
import { jest } from "@jest/globals";

// Mock dependencies used by popup handlers
jest.mock("../../src/popup/communication.js", () => ({
  send: jest.fn(),
  checkScannerStatus: jest.fn(),
  setActiveTab: jest.fn(),
  queryTabs: jest.fn(),
}));

jest.mock("../../src/popup/ui.js", () => ({
  showSetupMode: jest.fn(),
  showScannerMode: jest.fn(),
  showInitialScanState: jest.fn(),
  showRefineScanState: jest.fn(),
  showLoading: jest.fn(),
  showEmptyState: jest.fn(),
  setScanButtonsDisabled: jest.fn(),
  updateList: jest.fn(),
}));

jest.mock("../../src/popup/messages.js", () => ({
  showError: jest.fn(),
}));

jest.mock("../../src/popup/dialog.js", () => ({
  showDialog: jest.fn(),
}));

let send,
  queryTabs,
  checkScannerStatus,
  showError,
  showRefineScanState,
  showInitialScanState,
  updateList,
  showLoading,
  setScanButtonsDisabled,
  showEmptyState,
  showDialog;

let onInject, onStart, onRefine, onNewSearch;

async function initializePopup({ firefoxMode = false } = {}) {
  jest.resetModules();

  ({ send, queryTabs, checkScannerStatus } = await import(
    "../../src/popup/communication.js"
  ));
  ({ showError } = await import("../../src/popup/messages.js"));
  ({
    showRefineScanState,
    showInitialScanState,
    updateList,
    showLoading,
    setScanButtonsDisabled,
    showEmptyState,
  } = await import("../../src/popup/ui.js"));
  ({ showDialog } = await import("../../src/popup/dialog.js"));

  document.body.innerHTML = `
    <input id="value" />
    <select id="searchType"><option value="value">value</option><option value="name">name</option><option value="nameAndValue">nameAndValue</option></select>
    <div id="nameInputGroup" class="hidden"><input id="nameInput" /></div>
    <div id="initialScanGroup"></div>
    <div id="refineScanGroup" class="hidden"></div>
    <div id="statusBar" class="status-bar hidden"></div>
    <ul id="hits"></ul>
    <p class="setup-description"></p>
    <button id="inject">📋 Scanner-Code kopieren</button>
    <button id="start"></button>
    <button id="refine"></button>
    <button id="newSearch"></button>
    <div id="instructions" class="hidden"></div>
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
  };

  if (!firefoxMode) {
    globalThis.chrome.scripting = {
      executeScript: jest.fn().mockResolvedValue(),
    };
  }

  const popup = await import("../../src/popup/popup.js");
  queryTabs.mockResolvedValue([{ id: 1 }]);
  checkScannerStatus.mockResolvedValue(false);

  await document.dispatchEvent(new Event("DOMContentLoaded"));
  await Promise.resolve();
  ({ onInject, onStart, onRefine, onNewSearch } = popup);
}

afterEach(() => {
  jest.clearAllMocks();
  delete globalThis.chrome;
  delete global.navigator.clipboard;
  delete document.execCommand;
});

describe("popup handlers (Chrome mode)", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await initializePopup();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("onInject copies code", async () => {
    await onInject();
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(globalThis.chrome.scripting.executeScript).toHaveBeenCalled();
    // Should show copy feedback
    expect(document.getElementById("inject").textContent).toBe("✅ Kopiert!");
  });

  test("onInject falls back to tabs.executeScript", async () => {
    globalThis.chrome.scripting.executeScript = undefined;

    await onInject();
    expect(globalThis.chrome.tabs.executeScript).toHaveBeenCalledWith(
      1,
      {
        file: "/src/content.js",
        allFrames: true,
        matchAboutBlank: true,
      },
      expect.any(Function),
    );
  });

  test("onInject falls back to execCommand when clipboard API fails", async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
    document.execCommand.mockReturnValue(true);

    await onInject();
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(global.alert).not.toHaveBeenCalled();
  });

  test("onInject shows dialog when all clipboard paths fail", async () => {
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
    document.execCommand.mockReturnValue(false);
    showDialog.mockResolvedValue(true);

    await onInject();
    expect(showDialog).toHaveBeenCalledWith(
      expect.objectContaining({ type: "alert" }),
    );
  });

  test("onStart sends start command and switches state", async () => {
    document.getElementById("value").value = "42";
    document.getElementById("searchType").value = "value";
    send.mockResolvedValue(3);

    await onStart();
    expect(send).toHaveBeenCalledWith("start", { value: 42 });
    expect(showLoading).toHaveBeenCalledWith("Scanne...");
    expect(setScanButtonsDisabled).toHaveBeenCalledWith(true);
    await Promise.resolve();
    expect(showError).toHaveBeenCalledWith("✅ 3 Treffer gefunden");
    expect(setScanButtonsDisabled).toHaveBeenCalledWith(false);
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
    expect(showEmptyState).toHaveBeenCalled();
  });

  test("onStart ohne Eingabe", async () => {
    document.getElementById("value").value = "";
    document.getElementById("searchType").value = "value";

    await onStart();
    expect(showError).toHaveBeenCalledWith("Bitte einen Wert eingeben");
    expect(send).not.toHaveBeenCalled();
  });

  test("onStart with nameAndValue sends combined command", async () => {
    document.getElementById("value").value = "100";
    document.getElementById("searchType").value = "nameAndValue";
    document.getElementById("nameInput").value = "hp";
    send.mockResolvedValue(2);

    await onStart();
    expect(send).toHaveBeenCalledWith("scanByNameAndValue", {
      value: 100,
      name: "hp",
    });
    expect(showLoading).toHaveBeenCalledWith("Scanne...");
    await Promise.resolve();
    expect(showError).toHaveBeenCalledWith("✅ 2 Treffer gefunden");
    expect(showRefineScanState).toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(updateList).toHaveBeenCalled();
  });

  test("onStart with nameAndValue shows error when name is empty", async () => {
    document.getElementById("value").value = "100";
    document.getElementById("searchType").value = "nameAndValue";
    document.getElementById("nameInput").value = "";

    await onStart();
    expect(showError).toHaveBeenCalledWith("Bitte Wert und Name eingeben");
    expect(send).not.toHaveBeenCalled();
  });

  test("onRefine with nameAndValue sends combined refine command", async () => {
    document.getElementById("value").value = "100";
    document.getElementById("searchType").value = "nameAndValue";
    document.getElementById("nameInput").value = "hp";
    send.mockResolvedValue(1);

    await onRefine();
    expect(send).toHaveBeenCalledWith("refineByNameAndValue", {
      value: 100,
      name: "hp",
    });
    await Promise.resolve();
    expect(showError).toHaveBeenCalledWith("🔬 1 Treffer nach Verfeinerung");
    jest.runOnlyPendingTimers();
    expect(updateList).toHaveBeenCalled();
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

describe("popup handlers (Firefox mode)", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await initializePopup({ firefoxMode: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("onInject loads scanner directly without clipboard", async () => {
    expect(document.getElementById("inject").textContent).toBe(
      "⚡ Scanner direkt laden",
    );

    const checkCallsBeforeInject = checkScannerStatus.mock.calls.length;
    await onInject();
    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(globalThis.chrome.tabs.executeScript).toHaveBeenCalledWith(
      1,
      {
        file: "/src/content.js",
        allFrames: true,
        matchAboutBlank: true,
      },
      expect.any(Function),
    );
    expect(globalThis.chrome.tabs.executeScript).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        code: expect.any(String),
        allFrames: false,
        matchAboutBlank: true,
      }),
      expect.any(Function),
    );
    expect(document.getElementById("inject").textContent).toBe(
      "✅ Direkt geladen!",
    );
    expect(checkScannerStatus.mock.calls.length).toBeGreaterThan(
      checkCallsBeforeInject,
    );
    expect(
      document.getElementById("instructions").classList.contains("hidden"),
    ).toBe(true);
  });
});
