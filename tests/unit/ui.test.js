import { jest } from "@jest/globals";

jest.mock("../../src/popup/communication.js", () => ({
  send: jest.fn(),
}));

jest.mock("../../src/popup/favorites.js", () => ({
  saveFavorite: jest.fn(),
}));

jest.mock("../../src/popup/messages.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  clearStatus: jest.fn(),
}));

jest.mock("../../src/popup/dialog.js", () => ({
  showDialog: jest.fn(),
}));

import {
  renderHitsWithSaveButtons,
  updateList,
  showLoading,
  setScanButtonsDisabled,
  showInitialScanState,
  showRefineScanState,
} from "../../src/popup/ui.js";
import { send } from "../../src/popup/communication.js";
import { saveFavorite } from "../../src/popup/favorites.js";
import { showError } from "../../src/popup/messages.js";

describe("ui rendering", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="initialScanGroup" style="display:none"></div>
      <div id="refineScanGroup" class="hidden"></div>
      <div id="statusBar" class="status-bar hidden"></div>
      <ul id="hits"></ul>
      <button id="start"></button>
      <button id="refine"></button>
      <button id="newSearch"></button>
    `;
    jest.clearAllMocks();
  });

  test("renderHitsWithSaveButtons creates buttons and classes", () => {
    const list = [{ path: "foo", value: 42 }];
    renderHitsWithSaveButtons(list);
    const li = document.querySelector("#hits li");
    const info = li.querySelector(".hit-info");
    const saveBtn = li.querySelector("button.save-btn");
    const freezeBtn = li.querySelector("button.freeze-btn");
    expect(info.innerHTML).toBe("[0] foo = 42");
    expect(saveBtn).not.toBeNull();
    expect(freezeBtn).not.toBeNull();

    saveBtn.click();
    expect(saveFavorite).toHaveBeenCalledWith("foo", 42);

    send.mockClear();
    freezeBtn.click();
    expect(freezeBtn.classList.contains("active")).toBe(true);
    expect(send).toHaveBeenCalledWith("freeze", { path: "foo", value: 42 });
    freezeBtn.click();
    expect(freezeBtn.classList.contains("active")).toBe(false);
    expect(send).toHaveBeenCalledWith("unfreeze", { path: "foo" });
  });

  test("renderHitsWithSaveButtons trims window.globalThis prefix", () => {
    const list = [{ path: "window.globalThis.bar", value: 2 }];
    renderHitsWithSaveButtons(list);
    const info = document.querySelector("#hits .hit-info");
    expect(info.innerHTML).toBe("[0] bar = 2");
  });

  test("updateList fetches and displays hits with refine state", async () => {
    send.mockResolvedValue([{ path: "p", value: 1 }]);
    await updateList();
    expect(send).toHaveBeenCalledWith("list");
    const info = document.querySelector("#hits .hit-info");
    expect(info.innerHTML).toBe("[0] p = 1");
    expect(document.getElementById("initialScanGroup").style.display).toBe(
      "none",
    );
    expect(
      document.getElementById("refineScanGroup").classList.contains("hidden"),
    ).toBe(false);
  });

  test("updateList shows initial state when list empty", async () => {
    send.mockResolvedValue([]);
    await updateList();
    expect(document.getElementById("initialScanGroup").style.display).toBe(
      "block",
    );
    expect(
      document.getElementById("refineScanGroup").classList.contains("hidden"),
    ).toBe(true);
  });

  test("updateList handles error object", async () => {
    send.mockResolvedValue({ error: "bad" });
    await updateList();
    expect(showError).toHaveBeenCalledWith("❌ bad");
  });

  test("updateList handles unexpected response", async () => {
    send.mockResolvedValue({ foo: 1 });
    await updateList();
    expect(showError).toHaveBeenCalledWith('⚠️ Unerwartete Antwort: {"foo":1}');
  });

  test("showLoading renders spinner in hits list", () => {
    showLoading("Scanning...");
    const container = document.querySelector("#hits .loading-container");
    expect(container).not.toBeNull();
    expect(container.querySelector(".spinner")).not.toBeNull();
    expect(container.querySelector(".loading-text").textContent).toBe(
      "Scanning...",
    );
  });

  test("setScanButtonsDisabled disables scan buttons", () => {
    setScanButtonsDisabled(true);
    expect(document.getElementById("start").disabled).toBe(true);
    expect(document.getElementById("refine").disabled).toBe(true);
    expect(document.getElementById("newSearch").disabled).toBe(true);

    setScanButtonsDisabled(false);
    expect(document.getElementById("start").disabled).toBe(false);
    expect(document.getElementById("refine").disabled).toBe(false);
    expect(document.getElementById("newSearch").disabled).toBe(false);
  });

  test("freeze button toggles icon and active class", () => {
    const list = [{ path: "foo", value: 42 }];
    renderHitsWithSaveButtons(list);
    const freezeBtn = document.querySelector(".freeze-btn");

    // Activate freeze
    freezeBtn.click();
    expect(freezeBtn.classList.contains("active")).toBe(true);
    expect(freezeBtn.innerHTML).toBe("🔥");
    expect(send).toHaveBeenCalledWith("freeze", { path: "foo", value: 42 });

    // Deactivate freeze
    send.mockClear();
    freezeBtn.click();
    expect(freezeBtn.classList.contains("active")).toBe(false);
    expect(freezeBtn.innerHTML).toBe("❄️");
    expect(send).toHaveBeenCalledWith("unfreeze", { path: "foo" });
  });

  test("showRefineScanState and showInitialScanState toggle correctly", () => {
    showRefineScanState();
    expect(document.getElementById("initialScanGroup").style.display).toBe(
      "none",
    );
    expect(
      document.getElementById("refineScanGroup").classList.contains("hidden"),
    ).toBe(false);

    showInitialScanState();
    expect(document.getElementById("initialScanGroup").style.display).toBe(
      "block",
    );
    expect(
      document.getElementById("refineScanGroup").classList.contains("hidden"),
    ).toBe(true);
  });
});
