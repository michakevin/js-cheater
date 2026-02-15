import {
  compressToBase64,
  decompressFromBase64,
} from "../../src/popup/lz-string.js";

describe("lz-string base64 round-trip", () => {
  test("compress and decompress simple string", () => {
    const input = "Hello, World!";
    const compressed = compressToBase64(input);
    expect(typeof compressed).toBe("string");
    expect(compressed.length).toBeGreaterThan(0);
    expect(compressed).not.toBe(input);
    const decompressed = decompressFromBase64(compressed);
    expect(decompressed).toBe(input);
  });

  test("compress and decompress JSON string", () => {
    const obj = { gold: 1000, hp: 500, name: "Hero" };
    const json = JSON.stringify(obj);
    const compressed = compressToBase64(json);
    const decompressed = decompressFromBase64(compressed);
    expect(decompressed).toBe(json);
    expect(JSON.parse(decompressed)).toEqual(obj);
  });

  test("compress and decompress large JSON (RPG Maker-like)", () => {
    const saveData = {
      $gameParty: { _gold: 9999, _items: { 1: 5, 2: 3 } },
      $gameActors: {
        _data: [
          null,
          { _hp: 500, _mp: 200, _level: 10, _name: "Held" },
          { _hp: 300, _mp: 150, _level: 8, _name: "Magier" },
        ],
      },
      $gameSystem: { _saveCount: 3, _versionId: 1 },
    };
    const json = JSON.stringify(saveData);
    const compressed = compressToBase64(json);
    const decompressed = decompressFromBase64(compressed);
    expect(decompressed).toBe(json);
    expect(JSON.parse(decompressed)).toEqual(saveData);
  });

  test("empty string returns expected values", () => {
    expect(compressToBase64("")).toBeTruthy();
    const result = decompressFromBase64(compressToBase64(""));
    expect(result).toBe("");
  });

  test("null input returns empty string", () => {
    expect(compressToBase64(null)).toBe("");
    expect(decompressFromBase64(null)).toBe("");
  });

  test("decompressFromBase64 empty string returns null", () => {
    expect(decompressFromBase64("")).toBeNull();
  });

  test("handles unicode characters", () => {
    const input = '{"name":"日本語テスト","emoji":"🎮"}';
    const compressed = compressToBase64(input);
    const decompressed = decompressFromBase64(compressed);
    expect(decompressed).toBe(input);
  });
});
