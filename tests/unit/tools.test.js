/* global describe, test, expect, beforeEach */
import { jest } from "@jest/globals";

jest.mock("../../src/popup/communication.js", () => ({
  send: jest.fn(),
}));

import {
  exportLocalStorage,
  importLocalStorageFromText,
} from "../../src/popup/storage-tools.js";
import { send } from "../../src/popup/communication.js";

describe("tools export/import", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
    globalThis.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ url: "https://example.com" }]),
      },
    };
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  test("exportLocalStorage triggers download", async () => {
    send.mockResolvedValue({ foo: "bar" });

    let createUrlMock;
    if (URL.createObjectURL) {
      createUrlMock = jest
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:url");
    } else {
      URL.createObjectURL = jest.fn(() => "blob:url");
      createUrlMock = URL.createObjectURL;
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = jest.fn();
    } else {
      jest.spyOn(URL, "revokeObjectURL");
    }

    const clickMock = jest.fn();
    const origCreate = document.createElement;
    document.createElement = jest.fn((tag) => {
      const el = origCreate.call(document, tag);
      if (tag === "a") {
        el.click = clickMock;
      }
      return el;
    });

    await exportLocalStorage();

    expect(send).toHaveBeenCalledWith("getLocalStorage");
    expect(createUrlMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();

    if (createUrlMock.mockRestore) createUrlMock.mockRestore();
    if (URL.revokeObjectURL.mockRestore) URL.revokeObjectURL.mockRestore();
    document.createElement = origCreate;
  });

  test("importLocalStorageFromText sends data", async () => {
    await importLocalStorageFromText('{"a":1}');
    expect(send).toHaveBeenCalledWith("setLocalStorage", { data: { a: 1 } });
  });
});
