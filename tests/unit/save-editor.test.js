/* global describe, test, expect */

import {
  detectSaveSlots,
  decodeSaveData,
  encodeSaveData,
} from "../../src/popup/save-editor.js";
import { compressToBase64 } from "../../src/popup/lz-string.js";

describe("detectSaveSlots", () => {
  test("detects RPG Maker MV save keys from legacy localStorage object", () => {
    const storageData = {
      "RPG File1": "data1",
      "RPG File2": "data2",
      "RPG Global": "globaldata",
      someOtherKey: "value",
      anotherKey: "value",
    };
    const slots = detectSaveSlots(storageData);
    expect(slots.map((s) => s.key)).toEqual([
      "RPG Global",
      "RPG File1",
      "RPG File2",
    ]);
    expect(slots[0].source).toBe("localStorage");
  });

  test("detects slots from new format with slots array", () => {
    const result = {
      slots: [
        { key: "rmmzsave.12345.file1", source: "indexedDB", raw: "data1" },
        { key: "rmmzsave.12345.config", source: "indexedDB", raw: "cfg" },
        { key: "rmmzsave.12345.file0", source: "indexedDB", raw: "data0" },
      ],
    };
    const slots = detectSaveSlots(result);
    // config first (global-like), then file0, file1
    expect(slots[0].key).toBe("rmmzsave.12345.config");
    expect(slots[0].source).toBe("indexedDB");
    expect(slots.length).toBe(3);
  });

  test("returns empty array for no RPG Maker keys", () => {
    const storageData = { foo: "bar", baz: "qux" };
    expect(detectSaveSlots(storageData)).toEqual([]);
  });

  test("returns empty array for null/undefined input", () => {
    expect(detectSaveSlots(null)).toEqual([]);
    expect(detectSaveSlots(undefined)).toEqual([]);
  });

  test("sorts numerically (legacy format)", () => {
    const storageData = {
      "RPG File10": "data",
      "RPG File2": "data",
      "RPG File1": "data",
    };
    const slots = detectSaveSlots(storageData);
    expect(slots.map((s) => s.key)).toEqual([
      "RPG File1",
      "RPG File2",
      "RPG File10",
    ]);
  });
});

describe("decodeSaveData", () => {
  test("decodes LZString-compressed JSON", async () => {
    const original = { gold: 1000, hp: 500 };
    const compressed = compressToBase64(JSON.stringify(original));
    const result = await decodeSaveData(compressed);
    expect(result).not.toBeNull();
    expect(result.data).toEqual(original);
    expect(result.format).toBe("lzstring");
  });

  test("decodes plain JSON", async () => {
    const original = { gold: 1000, hp: 500 };
    const json = JSON.stringify(original);
    const result = await decodeSaveData(json);
    expect(result).not.toBeNull();
    expect(result.data).toEqual(original);
    expect(result.json).toBe(json);
    expect(result.format).toBe("json");
  });

  test("returns null for invalid data", async () => {
    expect(await decodeSaveData("not-valid-at-all!!!")).toBeNull();
    expect(await decodeSaveData("")).toBeNull();
    expect(await decodeSaveData(null)).toBeNull();
  });
});

describe("encodeSaveData", () => {
  test("encodes with lzstring compression", async () => {
    const data = { gold: 1000 };
    const encoded = await encodeSaveData(data, "lzstring");
    expect(typeof encoded).toBe("string");
    // Should be decodeable
    const decoded = await decodeSaveData(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded.data).toEqual(data);
  });

  test("encodes as plain JSON", async () => {
    const data = { gold: 1000 };
    const encoded = await encodeSaveData(data, "json");
    expect(encoded).toBe(JSON.stringify(data));
  });
});
