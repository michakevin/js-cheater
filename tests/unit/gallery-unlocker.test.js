import {
  analyzeGallery,
  unlockGallery,
  previewGallery,
  __testing__,
} from "../../src/gallery-unlocker.js";

const { isGalleryName, matchesNameFilter, unlockVariableValue } = __testing__;

function makeWin(overrides = {}) {
  return {
    $gameSwitches: { _data: [] },
    $gameVariables: { _data: [] },
    $dataSystem: null,
    ...overrides,
  };
}

describe("gallery-unlocker · isGalleryName heuristic", () => {
  test("matches typical gallery/CG keywords", () => {
    const positives = [
      "CG 1 Held",
      "Gallery freigeschaltet",
      "Galerie #2",
      "Recall Scene 04",
      "Picture Memory 05",
      "Replay Boss Fight",
      "Erinnerung an Tag 1",
      "H-Scene unlock",
      "Event CG: Strand",
      "回想シーン 1",
      "ギャラリー 01",
    ];
    for (const name of positives) {
      expect(isGalleryName(name)).toBe(true);
    }
  });

  test("rejects unrelated names", () => {
    const negatives = [
      "Player HP",
      "Quest 5 abgeschlossen",
      "Boss besiegt",
      "Map 12",
      "",
      null,
      undefined,
    ];
    for (const name of negatives) {
      expect(isGalleryName(name)).toBe(false);
    }
  });

  test("rejects false-positive scene keywords", () => {
    expect(isGalleryName("SceneManager loaded")).toBe(false);
    expect(isGalleryName("Title Scene shown")).toBe(false);
    expect(isGalleryName("Opening Scene done")).toBe(false);
  });
});

describe("gallery-unlocker · analyzeGallery", () => {
  test("flags missing $gameSwitches via warning", () => {
    const result = analyzeGallery({ win: {} });
    expect(result.scannerEngineDetected).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("reports tier2 switch hits with sample and id range", () => {
    const win = makeWin();
    const systemData = {
      switches: [
        null,
        "Quest 1",
        "CG 01: Strand",
        "Gallery unlock",
        "Quest 2",
        "Recall Scene 1",
      ],
    };
    const result = analyzeGallery({ win, systemData });
    expect(result.tier2.available).toBe(true);
    expect(result.tier2.switchCount).toBe(3);
    expect(result.tier2.idRange).toEqual({ min: 2, max: 5 });
    expect(result.tier2.sampleNames.length).toBeGreaterThan(0);
  });

  test("uses $dataSystem as fallback when systemData missing", () => {
    const win = makeWin({
      $dataSystem: {
        switches: [null, "CG 01", "Map 1"],
        variables: [null, "HP"],
      },
    });
    const result = analyzeGallery({ win });
    expect(result.tier2.switchCount).toBe(1);
    expect(result.tier2.idRange).toEqual({ min: 1, max: 1 });
  });

  test("reports tier1 adapters when a known plugin is present", () => {
    const win = makeWin({
      $cgmzTemp: {
        discoverPictureGalleryPicture: () => {},
        _pictureGallery: [{ _id: "intro" }, { _id: "boss" }],
      },
      $cgmz: {},
    });
    const result = analyzeGallery({ win });
    expect(result.tier1.available).toBe(true);
    expect(result.tier1.adapters.map((a) => a.id)).toContain(
      "cgmz-picture-gallery",
    );
  });

  test("suggests a sensible tier3 range when no tier2 hits", () => {
    const win = makeWin({
      $gameSwitches: { _data: new Array(50).fill(false) },
    });
    const systemData = { switches: new Array(50).fill("Map flag") };
    const result = analyzeGallery({ win, systemData });
    expect(result.tier2.available).toBe(false);
    expect(result.tier3.available).toBe(true);
    expect(result.tier3.suggestedRange.min).toBeGreaterThanOrEqual(1);
    expect(result.tier3.suggestedRange.max).toBeLessThanOrEqual(50);
  });
});

describe("gallery-unlocker · unlockGallery tier=plugin", () => {
  test("CGMZ adapter discovers all enumerated picture ids", () => {
    const calls = [];
    const win = makeWin({
      $cgmzTemp: {
        discoverPictureGalleryPicture: (id, force) => {
          calls.push({ id, force });
        },
        _pictureGallery: [
          { _id: "intro" },
          { _id: "boss" },
          { _id: "ending" },
        ],
      },
      $cgmz: {},
    });
    const result = unlockGallery({ win }, { tier: "plugin" });
    expect(result.applied).toBe(3);
    expect(result.needsMenuRefresh).toBe(true);
    expect(calls.map((c) => c.id)).toEqual(["intro", "boss", "ending"]);
    expect(calls.every((c) => c.force === true)).toBe(true);
  });

  test("VisuStella adapter flips ConfigManager unlock arrays", () => {
    const cm = {
      CGGalleryUnlocks: [false, false, false],
      otherSetting: 1,
    };
    cm.save = jest.fn();
    const win = makeWin({ ConfigManager: cm });
    const result = unlockGallery({ win }, { tier: "plugin" });
    expect(result.applied).toBeGreaterThan(0);
    expect(cm.CGGalleryUnlocks.every((v) => v === true)).toBe(true);
    expect(cm.save).toHaveBeenCalled();
  });

  test("generic *Gallery object: calls unlockAll()", () => {
    const unlockAll = jest.fn();
    const win = makeWin({ CGViewer: { unlockAll } });
    const result = unlockGallery({ win }, { tier: "plugin" });
    expect(unlockAll).toHaveBeenCalledTimes(1);
    expect(result.applied).toBe(1);
  });

  test("reports skipped=0 and applied=0 when no plugin present", () => {
    const win = makeWin();
    const result = unlockGallery({ win }, { tier: "plugin" });
    expect(result.applied).toBe(0);
    expect(result.total).toBe(0);
    expect(result.needsMenuRefresh).toBe(false);
  });

  test("collects errors from plugin throws without crashing", () => {
    const win = makeWin({
      $cgmzTemp: {
        discoverPictureGalleryPicture: () => {
          throw new Error("boom");
        },
        _pictureGallery: [{ _id: "intro" }],
      },
      $cgmz: {},
    });
    const result = unlockGallery({ win }, { tier: "plugin" });
    expect(result.applied).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].error).toMatch(/boom/);
  });
});

describe("gallery-unlocker · unlockGallery tier=switches", () => {
  test("sets only matched switches to true and skips already-on", () => {
    const win = makeWin({
      $gameSwitches: { _data: [null, false, false, true, false, false] },
    });
    const systemData = {
      switches: [
        null,
        "Quest 1",
        "CG 01: Strand",
        "Gallery unlock",
        "Quest 2",
        "Recall Scene 1",
      ],
    };
    const result = unlockGallery({ win, systemData }, { tier: "switches" });
    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(3);
    expect(win.$gameSwitches._data[2]).toBe(true);
    expect(win.$gameSwitches._data[3]).toBe(true);
    expect(win.$gameSwitches._data[5]).toBe(true);
    expect(win.$gameSwitches._data[1]).toBe(false);
    expect(win.$gameSwitches._data[4]).toBe(false);
  });

  test("returns explanatory error when no names match", () => {
    const win = makeWin({
      $gameSwitches: { _data: [null, false] },
    });
    const result = unlockGallery(
      { win, systemData: { switches: [null, "Quest 1"] } },
      { tier: "switches" },
    );
    expect(result.applied).toBe(0);
    expect(result.errors[0].error).toMatch(/keine passenden/i);
  });

  test("returns error when $gameSwitches missing", () => {
    const win = { $gameVariables: { _data: [] } };
    const result = unlockGallery(
      {
        win,
        systemData: { switches: [null, "CG 01"] },
      },
      { tier: "switches" },
    );
    expect(result.applied).toBe(0);
    expect(result.errors[0].error).toMatch(/\$gameSwitches/);
  });
});

describe("gallery-unlocker · unlockGallery tier=range", () => {
  test("flips every switch in the inclusive range", () => {
    const data = [null, false, false, false, false, false, false];
    const win = makeWin({ $gameSwitches: { _data: data } });
    const result = unlockGallery(
      { win },
      { tier: "range", range: { from: 2, to: 5 } },
    );
    expect(result.applied).toBe(4);
    expect(result.total).toBe(4);
    expect(data[1]).toBe(false);
    expect(data[2]).toBe(true);
    expect(data[3]).toBe(true);
    expect(data[4]).toBe(true);
    expect(data[5]).toBe(true);
    expect(data[6]).toBe(false);
  });

  test("rejects inverted or non-numeric ranges", () => {
    const win = makeWin();
    const r1 = unlockGallery(
      { win },
      { tier: "range", range: { from: 10, to: 5 } },
    );
    expect(r1.applied).toBe(0);
    expect(r1.errors[0].error).toMatch(/ung[üu]ltig/i);

    const r2 = unlockGallery(
      { win },
      { tier: "range", range: { from: "x", to: 5 } },
    );
    expect(r2.applied).toBe(0);
  });
});

describe("gallery-unlocker · previewGallery", () => {
  test("range preview counts inclusive span", () => {
    const result = previewGallery({}, { type: "range", range: { from: 10, to: 15 } });
    expect(result.switchCount).toBe(6);
    expect(result.from).toBe(10);
    expect(result.to).toBe(15);
  });

  test("filter preview lists matching switches and variables", () => {
    const systemData = {
      switches: [null, "Quest", "CG Strand", "Map"],
      variables: [null, "Gold", "Galerie Counter"],
    };
    const result = previewGallery(
      { systemData },
      { type: "filter", nameFilter: "Galerie", targets: ["switches", "variables"] },
    );
    expect(result.variableCount).toBe(1);
    expect(result.switchCount).toBe(0);
  });
});

describe("gallery-unlocker · unlockGallery tier=filter", () => {
  test("unlocks switches and variables matching custom filter", () => {
    const win = makeWin({
      $gameSwitches: { _data: [null, false, false, false] },
      $gameVariables: { _data: [null, 0, 0, 0] },
    });
    const systemData = {
      switches: [null, "Quest", "CG 01", "Other"],
      variables: [null, "HP", "CG unlock var", "MP"],
    };
    const result = unlockGallery(
      { win, systemData },
      { tier: "filter", nameFilter: "CG", targets: ["switches", "variables"] },
    );
    expect(result.applied).toBe(2);
    expect(win.$gameSwitches._data[2]).toBe(true);
    expect(win.$gameVariables._data[2]).toBe(1);
    expect(win.$gameVariables._data[1]).toBe(0);
  });

  test("skips variables already unlocked", () => {
    const win = makeWin({
      $gameVariables: { _data: [null, 1, true] },
    });
    const systemData = { variables: [null, "Gallery A", "Gallery B"] };
    const result = unlockGallery(
      { win, systemData },
      { tier: "filter", nameFilter: "Gallery", targets: ["variables"] },
    );
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(2);
  });
});

describe("gallery-unlocker · matchesNameFilter", () => {
  test("matches substring in name case-insensitively", () => {
    expect(matchesNameFilter("CG Strand", 5, "strand")).toBe(true);
    expect(matchesNameFilter("Quest", 1, "cg")).toBe(false);
  });
});

describe("gallery-unlocker · unlockVariableValue", () => {
  test("returns 1 for zero and null for already unlocked", () => {
    expect(unlockVariableValue(0)).toBe(1);
    expect(unlockVariableValue(1)).toBe(null);
    expect(unlockVariableValue(true)).toBe(null);
    expect(unlockVariableValue(false)).toBe(true);
  });
});

describe("gallery-unlocker · unlockGallery edge cases", () => {
  test("missing win returns error", () => {
    const result = unlockGallery({}, { tier: "switches" });
    expect(result.applied).toBe(0);
    expect(result.errors[0].error).toMatch(/window/i);
  });

  test("unknown tier returns explanatory error", () => {
    const result = unlockGallery({ win: makeWin() }, { tier: "bogus" });
    expect(result.applied).toBe(0);
    expect(result.errors[0].error).toMatch(/bogus/);
  });
});
