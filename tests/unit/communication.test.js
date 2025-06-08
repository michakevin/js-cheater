/* global describe, test, expect, beforeEach, afterEach */
import { jest } from "@jest/globals";

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
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { cmd: "ping" });
  });

  test("uses stored tab id when set", async () => {
    const { send, setActiveTab } = await import("../../src/popup/communication.js");
    setActiveTab(5);
    await send("ping");
    expect(chrome.tabs.query).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(5, { cmd: "ping" });
  });
});
