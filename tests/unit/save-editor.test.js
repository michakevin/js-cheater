import {
  detectSaveSlots,
  decodeSaveData,
  encodeSaveData,
  parseSaveFileName,
  arrayBufferToSaveRaw,
  extractMzGameId,
  extractSavefileIdFromKey,
  buildSavefileInfoFromContents,
  extractActorIdsFromParty,
  mergeSavefileInfo,
  normalizeSavefileInfoStrings,
  setGlobalInfoEntry,
  prepareUpdatedGlobalRaw,
  resolveImportTarget,
  resolveGlobalTarget,
  resolveAuxiliaryImportTarget,
  isFileSlotKey,
  rebuildGlobalInfoFromSlots,
} from "../../src/popup/save-editor.js";
import { compressToBase64, decompressFromBase64 } from "../../src/popup/lz-string.js";

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

describe("parseSaveFileName", () => {
  test("parses MV save slot filenames", () => {
    expect(parseSaveFileName("file6.rpgsave")).toEqual({
      kind: "file",
      index: 6,
      extension: "rpgsave",
    });
    expect(parseSaveFileName("C:\\Downloads\\file1.rpgsave")).toEqual({
      kind: "file",
      index: 1,
      extension: "rpgsave",
    });
  });

  test("parses MZ save slot filenames", () => {
    expect(parseSaveFileName("file0.rmmzsave")).toEqual({
      kind: "file",
      index: 0,
      extension: "rmmzsave",
    });
    expect(parseSaveFileName("global.rmmzsave")).toEqual({
      kind: "global",
      index: null,
      extension: "rmmzsave",
    });
    expect(parseSaveFileName("config.rmmzsave")).toEqual({
      kind: "config",
      index: null,
      extension: "rmmzsave",
    });
    expect(parseSaveFileName("achievements.rpgsave")).toEqual({
      kind: "achievements",
      index: null,
      extension: "rpgsave",
    });
    expect(parseSaveFileName("locale.rpgsave")).toEqual({
      kind: "locale",
      index: null,
      extension: "rpgsave",
    });
  });

  test("returns unknown for unrelated filenames", () => {
    expect(parseSaveFileName("backup.txt")).toEqual({
      kind: "unknown",
      index: null,
      extension: null,
    });
  });
});

describe("arrayBufferToSaveRaw", () => {
  test("reads MV saves as trimmed UTF-8 text", () => {
    const bytes = Uint8Array.from([32, 32, 115, 97, 118, 101, 45, 100, 97, 116, 97, 32, 32]);
    const raw = arrayBufferToSaveRaw(bytes.buffer);
    expect(raw).toBe("save-data");
  });

  test("reads MZ saves as binary strings", () => {
    const bytes = new Uint8Array([0x78, 0x01, 0x03, 0x04]);
    const raw = arrayBufferToSaveRaw(bytes.buffer);
    expect(raw).toBe("\x78\x01\x03\x04");
  });
});

describe("resolveImportTarget", () => {
  const mzSlots = [
    { key: "rmmzsave.12345.file0", source: "indexedDB", encoding: "string" },
    { key: "rmmzsave.12345.config", source: "indexedDB", encoding: "string" },
  ];

  test("maps MV filenames to localStorage keys", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("file6.rpgsave"),
        [],
        "lzstring",
      ),
    ).toEqual({
      key: "RPG File6",
      source: "localStorage",
    });
  });

  test("maps MZ filenames to indexedDB keys using existing game id", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("file2.rmmzsave"),
        mzSlots,
        "zlib",
      ),
    ).toEqual({
      key: "rmmzsave.12345.file2",
      source: "indexedDB",
      encoding: "string",
    });
  });

  test("uses the selected slot when provided for file imports", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("file6.rpgsave"),
        [{ key: "RPG File3", source: "localStorage", raw: "" }],
        "lzstring",
        "RPG File3",
      ),
    ).toEqual({
      key: "RPG File3",
      source: "localStorage",
    });
  });

  test("keeps global/config targets based on filename even if another slot is selected", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("global.rpgsave"),
        [{ key: "RPG File3", source: "localStorage", raw: "" }],
        "lzstring",
        "RPG File3",
      ),
    ).toEqual({
      key: "RPG Global",
      source: "localStorage",
    });

    expect(
      resolveImportTarget(
        parseSaveFileName("config.rpgsave"),
        [],
        "lzstring",
        "RPG File3",
      ),
    ).toEqual({
      key: "RPG Config",
      source: "localStorage",
    });
  });

  test("maps MV config filenames to RPG Config", () => {
    expect(parseSaveFileName("config.rpgsave")).toEqual({
      kind: "config",
      index: null,
      extension: "rpgsave",
    });
  });

  test("maps achievements.rpgsave to an existing plugin storage key", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("achievements.rpgsave"),
        [{ key: "Achievement: Game", source: "localStorage", raw: "" }],
        "lzstring",
      ),
    ).toEqual({
      key: "Achievement: Game",
      source: "localStorage",
    });
  });

  test("falls back to the default achievement storage key when none exists", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("achievements.rpgsave"),
        [],
        "lzstring",
      ),
    ).toEqual({
      key: "Achievement-Game",
      source: "localStorage",
      guessed: true,
    });
  });

  test("allows selecting a custom auxiliary target key for achievements", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("achievements.rpgsave"),
        [],
        "lzstring",
        "My Achievement Key",
      ),
    ).toEqual({
      key: "My Achievement Key",
      source: "localStorage",
    });
  });

  test("maps achievements.rmmzsave to indexedDB when an MZ game id exists", () => {
    expect(
      resolveImportTarget(
        parseSaveFileName("achievements.rmmzsave"),
        [{ key: "rmmzsave.12345.file0", source: "indexedDB", raw: "" }],
        "zlib",
      ),
    ).toEqual({
      key: "rmmzsave.12345.achievements",
      source: "indexedDB",
      encoding: "string",
    });
  });

  test("identifies file slot keys", () => {
    expect(isFileSlotKey("RPG File6")).toBe(true);
    expect(isFileSlotKey("Achievement-Game")).toBe(false);
  });

  test("extracts MZ game id from slot keys", () => {
    expect(extractMzGameId(mzSlots)).toBe("12345");
  });
});

describe("global save index helpers", () => {
  test("builds savefile info from imported save contents", () => {
    const info = buildSavefileInfoFromContents({
      party: { _actors: [1, 2] },
      actors: {
        1: {
          _characterName: "Actor1",
          _characterIndex: 3,
          _faceName: "People1",
          _faceIndex: 1,
        },
        2: {
          _characterName: "Actor2",
          _characterIndex: 0,
          _faceName: "People2",
          _faceIndex: 4,
        },
      },
      system: { _framesOnSave: 3660, _gameTitle: "Demo" },
    });

    expect(info.title).toBe("Demo");
    expect(info.characters).toEqual([
      ["Actor1", 3],
      ["Actor2", 0],
    ]);
    expect(info.faces).toEqual([
      ["People1", 1],
      ["People2", 4],
    ]);
    expect(info.playtime).toBe("00:01:01");
    expect(typeof info.timestamp).toBe("number");
  });

  test("extracts actor ids from JsonEx-style party objects", () => {
    expect(
      extractActorIdsFromParty({ _actors: { 0: 1, 1: 3, 2: 5 } }, null),
    ).toEqual([1, 3, 5]);
    expect(
      extractActorIdsFromParty({ _actors: { "@a": [2, 4] } }, null),
    ).toEqual([2, 4]);
  });

  test("builds savefile info when party actors are stored as objects", () => {
    const info = buildSavefileInfoFromContents({
      party: { _actors: { 0: 1, 1: 2 } },
      actors: {
        1: {
          _characterName: "Hero",
          _characterIndex: 0,
          _faceName: "Actor1",
          _faceIndex: 0,
        },
        2: {
          _characterName: "Mage",
          _characterIndex: 1,
          _faceName: "Actor2",
          _faceIndex: 2,
        },
      },
      system: { _framesOnSave: 7200 },
    });

    expect(info.characters).toEqual([
      ["Hero", 0],
      ["Mage", 1],
    ]);
    expect(info.playtime).toBe("00:02:00");
  });

  test("merges rebuilt savefile info without dropping plugin fields", () => {
    const merged = mergeSavefileInfo(
      {
        mapname: "Chapter 3",
        customField: "keep-me",
        playtime: "00:00:01",
      },
      buildSavefileInfoFromContents({
        party: { _actors: [1] },
        actors: {
          1: {
            _characterName: "Hero",
            _characterIndex: 0,
            _faceName: "Actor1",
            _faceIndex: 0,
          },
        },
        system: { _framesOnSave: 3600 },
      }),
    );

    expect(merged.mapname).toBe("Chapter 3");
    expect(merged.customField).toBe("keep-me");
    expect(merged.playtime).toBe("00:01:00");
    expect(merged.characters).toEqual([["Hero", 0]]);
  });

  test("ensures mapname is always a string", () => {
    expect(normalizeSavefileInfoStrings({ mapname: null }).mapname).toBe("");
  });

  test("updates the global index entry for a save slot", async () => {
    const saveContents = {
      party: { _actors: [1] },
      actors: {
        1: {
          _characterName: "Hero",
          _characterIndex: 0,
          _faceName: "Actor1",
          _faceIndex: 0,
        },
      },
      system: { _framesOnSave: 7200 },
    };
    const existingGlobal = compressToBase64(
      JSON.stringify([null, { playtime: "00:00:01", timestamp: 1 }]),
    );

    const updatedRaw = await prepareUpdatedGlobalRaw(
      6,
      saveContents,
      existingGlobal,
      "lzstring",
    );
    const decoded = JSON.parse(decompressFromBase64(updatedRaw));

    expect(decoded[1]).toEqual({ playtime: "00:00:01", timestamp: 1 });
    expect(decoded[6]).toMatchObject({
      characters: [["Hero", 0]],
      faces: [["Actor1", 0]],
      playtime: "00:02:00",
    });
  });

  test("extracts savefile ids from storage keys", () => {
    expect(extractSavefileIdFromKey("RPG File6")).toBe(6);
    expect(extractSavefileIdFromKey("rmmzsave.99.file2")).toBe(2);
  });

  test("resolves global storage targets", () => {
    expect(resolveGlobalTarget([], "lzstring")).toEqual({
      key: "RPG Global",
      source: "localStorage",
    });
    expect(
      resolveGlobalTarget(
        [{ key: "rmmzsave.12345.file0", source: "indexedDB" }],
        "zlib",
      ),
    ).toEqual({
      key: "rmmzsave.12345.global",
      source: "indexedDB",
      encoding: "string",
    });
  });

  test("sets one global index entry without dropping others", () => {
    const updated = setGlobalInfoEntry(
      [null, { playtime: "00:01:00" }],
      6,
      { playtime: "01:00:00" },
    );
    expect(updated[1]).toEqual({ playtime: "00:01:00" });
    expect(updated[6]).toEqual({ playtime: "01:00:00" });
  });

  test("rebuilds global info from readable file slots", async () => {
    const saveContents = {
      party: { _actors: [1] },
      actors: {
        1: {
          _characterName: "Hero",
          _characterIndex: 0,
          _faceName: "Actor1",
          _faceIndex: 0,
        },
      },
      system: { _framesOnSave: 3600 },
    };
    const raw = compressToBase64(JSON.stringify(saveContents));

    const rebuild = await rebuildGlobalInfoFromSlots([
      { key: "RPG File1", raw: "broken" },
      { key: "RPG File6", raw },
      { key: "RPG Global", raw: compressToBase64(JSON.stringify([])) },
    ]);

    expect(rebuild.format).toBe("lzstring");
    expect(rebuild.registered).toEqual([6]);
    expect(rebuild.globalInfo[6]).toMatchObject({
      characters: [["Hero", 0]],
      playtime: "00:01:00",
    });
    expect(rebuild.globalInfo[1]).toBeUndefined();
  });
});
