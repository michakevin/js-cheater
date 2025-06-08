/* global describe, test, expect, beforeEach, afterEach, jest */
import { jest } from "@jest/globals";

describe("content message handler", () => {
  let listener;
  let originalAdd;
  let originalRemove;
  let originalPost;
  let messageListeners;

  beforeEach(async () => {
    globalThis.chrome = {
      runtime: {
        onMessage: { addListener: jest.fn() },
      },
    };

    messageListeners = [];
    originalAdd = window.addEventListener;
    originalRemove = window.removeEventListener;
    originalPost = window.postMessage;

    window.addEventListener = jest.fn((type, cb) => {
      if (type === "message") messageListeners.push(cb);
    });
    window.removeEventListener = jest.fn((type, cb) => {
      if (type === "message") {
        const idx = messageListeners.indexOf(cb);
        if (idx >= 0) messageListeners.splice(idx, 1);
      }
    });
    window.postMessage = jest.fn((msg) => {
      if (msg.type === "__jsCheaterRequest") {
        const res = {
          type: "__jsCheaterResponse",
          id: msg.id,
          result: msg.command + "-ok",
        };
        messageListeners.forEach((cb) => cb({ source: window, data: res }));
      }
    });

    jest.resetModules();
    await import("../../src/content.js");
    listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
  });

  afterEach(() => {
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
    window.postMessage = originalPost;
    delete globalThis.chrome;
    localStorage.clear();
    jest.resetModules();
  });

  test("responds to ping", () => {
    const sendResponse = jest.fn();
    const ret = listener({ cmd: "ping" }, null, sendResponse);
    expect(ret).toBeUndefined();
    expect(sendResponse).toHaveBeenCalledWith("pong");
  });

  test("start triggers scan and responds asynchronously", async () => {
    const sendResponse = jest.fn();
    const ret = listener({ cmd: "start", value: 1 }, null, sendResponse);
    expect(ret).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendResponse).toHaveBeenCalledWith("scan-ok");
  });

  test("poke triggers poke command and responds asynchronously", async () => {
    const sendResponse = jest.fn();
    const ret = listener(
      { cmd: "poke", idx: 0, value: 42 },
      null,
      sendResponse
    );
    expect(ret).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendResponse).toHaveBeenCalledWith("poke-ok");
  });

  test("pokeByPath triggers poke command and responds asynchronously", async () => {
    const sendResponse = jest.fn();
    const ret = listener(
      { cmd: "poke", path: "window.score", value: 7 },
      null,
      sendResponse
    );
    expect(ret).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendResponse).toHaveBeenCalledWith("poke-ok");
  });

  test("freeze triggers freeze command and responds asynchronously", async () => {
    const sendResponse = jest.fn();
    const ret = listener(
      { cmd: "freeze", path: "window.score", value: 99 },
      null,
      sendResponse
    );
    expect(ret).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendResponse).toHaveBeenCalledWith("freeze-ok");
  });

  test("unfreeze triggers unfreeze command and responds asynchronously", async () => {
    const sendResponse = jest.fn();
    const ret = listener({ cmd: "unfreeze", path: "window.score" }, null, sendResponse);
    expect(ret).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(sendResponse).toHaveBeenCalledWith("unfreeze-ok");
  });

  test("getLocalStorage returns stored values", () => {
    localStorage.setItem("a", "1");
    localStorage.setItem("b", "2");
    const sendResponse = jest.fn();
    const ret = listener({ cmd: "getLocalStorage" }, null, sendResponse);
    expect(ret).toBeUndefined();
    expect(sendResponse).toHaveBeenCalledWith({ a: "1", b: "2" });
  });

  test("unknown command returns error", () => {
    const sendResponse = jest.fn();
    listener({ cmd: "nope" }, null, sendResponse);
    expect(sendResponse).toHaveBeenCalledWith({ error: "Unknown command: nope" });
  });

  test("sendCommand timeout returns indicator", async () => {
    jest.useFakeTimers();
    window.postMessage = jest.fn();
    const sendResponse = jest.fn();
    const ret = listener({ cmd: "start", value: 1 }, null, sendResponse);
    expect(ret).toBe(true);
    jest.advanceTimersByTime(10000);
    await jest.runOnlyPendingTimersAsync();
    expect(sendResponse).toHaveBeenCalledWith({ error: "Timeout", timeout: true });
    jest.useRealTimers();
  });
});
