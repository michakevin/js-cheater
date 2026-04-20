import {
  loadFromStorage,
  saveToStorage,
} from "../../src/popup/storage-utils.js";

describe("storage utils", () => {
  const key = "_test_key_";

  beforeEach(() => {
    localStorage.clear();
  });

  test("loadFromStorage parses stored JSON", () => {
    localStorage.setItem(key, '{"a":1}');
    expect(loadFromStorage(key)).toEqual({ a: 1 });
  });

  test("loadFromStorage returns empty object for invalid JSON", () => {
    localStorage.setItem(key, "not-json");
    expect(loadFromStorage(key)).toEqual({});
  });

  test("saveToStorage stores stringified value", () => {
    const result = saveToStorage(key, { b: 2 });
    expect(localStorage.getItem(key)).toBe('{"b":2}');
    expect(result).toEqual({ success: true });
  });

  test("saveToStorage reports errors when setItem throws", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      const err = new Error("quota");
      err.name = "QuotaExceededError";
      throw err;
    });
    try {
      const result = saveToStorage(key, { b: 2 });
      expect(result).toEqual({
        success: false,
        error: "QuotaExceededError",
        message: "quota",
      });
    } finally {
      Storage.prototype.setItem = original;
      errorSpy.mockRestore();
    }
  });
});
