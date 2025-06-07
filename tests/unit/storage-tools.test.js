/* global describe, test, expect, beforeEach */
import { jest } from "@jest/globals";

// Mock all dependencies
jest.mock("../../src/popup/communication.js", () => ({
  send: jest.fn(),
}));

jest.mock("../../src/popup/messages.js", () => ({
  showSuccess: jest.fn(),
}));

// chrome API will be mocked in beforeEach

// Mock URL and Blob APIs
globalThis.URL = class {
  constructor() {
    this.origin = "https://example.com";
  }
};
globalThis.URL.createObjectURL = jest.fn();
globalThis.URL.revokeObjectURL = jest.fn();

globalThis.Blob = jest.fn();

// Mock DOM APIs
globalThis.document = {
  createElement: jest.fn(),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  },
};

import {
  exportLocalStorage,
  importLocalStorageFromText,
} from "../../src/popup/storage-tools.js";
import { send } from "../../src/popup/communication.js";

describe("storage tools export/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.chrome = {
      tabs: {
        query: jest.fn().mockResolvedValue([
          { url: "https://example.com" },
        ]),
      },
    };
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  test("exportLocalStorage triggers download", async () => {
    send.mockResolvedValue({ foo: "bar" });

    const mockElement = {
      href: "",
      download: "",
      click: jest.fn(),
    };

    // Mock document.createElement to return our mock element
    const originalCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = jest.fn().mockReturnValue(mockElement);

    // Mock document.body methods to not use real DOM
    globalThis.document.body.appendChild = jest.fn();
    globalThis.document.body.removeChild = jest.fn();

    globalThis.URL.createObjectURL.mockReturnValue("blob:url");
    globalThis.Blob.mockImplementation((content, options) => ({
      content,
      options,
    }));

    await exportLocalStorage();

    expect(send).toHaveBeenCalledWith("getLocalStorage");
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    expect(mockElement.click).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:url");
    expect(globalThis.document.body.appendChild).toHaveBeenCalledWith(
      mockElement
    );
    expect(globalThis.document.body.removeChild).toHaveBeenCalledWith(
      mockElement
    );

    // Restore original
    globalThis.document.createElement = originalCreateElement;
  });

  test("importLocalStorageFromText sends data", async () => {
    await importLocalStorageFromText('{"a":1}');
    expect(send).toHaveBeenCalledWith("setLocalStorage", { data: { a: 1 } });
  });
});
