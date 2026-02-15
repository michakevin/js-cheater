/* global describe, test, expect, beforeEach, afterEach */
import { jest } from "@jest/globals";

jest.mock("../../src/popup/messages.js", () => ({
  showError: jest.fn(),
}));

describe("communication send", () => {
  beforeEach(() => {
    jest.resetModules();
    globalThis.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1 }]),
        sendMessage: jest.fn().mockResolvedValue("ok"),
      },
    };
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  test("queries tab when no id stored", async () => {
    const { send } = await import("../../src/popup/communication.js");
    await send("ping");
    expect(chrome.tabs.query).toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      { cmd: "ping" },
      expect.any(Function)
    );
  });

  test("prefers current active tab over stored tab id", async () => {
    const { send, setActiveTab } = await import("../../src/popup/communication.js");
    setActiveTab(5);
    await send("ping");
    expect(chrome.tabs.query).toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      { cmd: "ping" },
      expect.any(Function)
    );
  });

  test("falls back to stored tab id when tab query fails", async () => {
    chrome.tabs.query.mockRejectedValue(new Error("query failed"));
    const { send, setActiveTab } = await import("../../src/popup/communication.js");
    setActiveTab(5);
    await send("ping");
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      5,
      { cmd: "ping" },
      expect.any(Function)
    );
  });

  test("shows message on timeout", async () => {
    const { send } = await import("../../src/popup/communication.js");
    const { showError } = await import("../../src/popup/messages.js");
    chrome.tabs.sendMessage.mockResolvedValue({ error: "Timeout", timeout: true });
    const result = await send("start");
    expect(showError).toHaveBeenCalledWith(
      "❌ Anfrage an Content Script dauerte zu lange."
    );
    expect(result).toBeNull();
  });

  test("supports callback-style tabs.query", async () => {
    chrome.tabs.query.mockImplementation((queryInfo, callback) => {
      callback([{ id: 77 }]);
    });
    const { send } = await import("../../src/popup/communication.js");
    await send("ping");
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      77,
      { cmd: "ping" },
      expect.any(Function)
    );
  });

  test("supports callback-style tabs.sendMessage", async () => {
    chrome.tabs.sendMessage.mockImplementation((tabId, payload, callback) => {
      callback("ok");
    });
    const { send } = await import("../../src/popup/communication.js");
    const result = await send("ping");
    expect(result).toBe("ok");
  });
});

describe("checkScannerStatus", () => {
  beforeEach(() => {
    jest.resetModules();
    globalThis.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ id: 1 }]),
        sendMessage: jest.fn().mockResolvedValue({ scannerLoaded: true }),
      },
    };
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  test("returns true when scanner is loaded", async () => {
    const { checkScannerStatus } = await import("../../src/popup/communication.js");
    const result = await checkScannerStatus();
    expect(result).toBe(true);
  });

  test("returns false when scanner is not loaded", async () => {
    const { checkScannerStatus } = await import("../../src/popup/communication.js");
    chrome.tabs.sendMessage.mockResolvedValue({ scannerLoaded: false });
    const result = await checkScannerStatus();
    expect(result).toBe(false);
  });

  test("returns false on error", async () => {
    const { checkScannerStatus } = await import("../../src/popup/communication.js");
    chrome.tabs.sendMessage.mockRejectedValue(new Error("fail"));
    const result = await checkScannerStatus();
    expect(result).toBe(false);
  });
});
