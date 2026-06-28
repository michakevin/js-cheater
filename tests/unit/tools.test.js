import { jest } from "@jest/globals";

jest.mock("../../src/popup/engine-detect.js", () => ({
  detectAndShowPresets: jest.fn().mockResolvedValue(undefined),
  getLastDetection: jest.fn(),
}));

jest.mock("../../src/popup/communication.js", () => ({
  getActiveTab: jest.fn().mockResolvedValue({ id: 1 }),
  send: jest.fn().mockResolvedValue(null),
}));

import {
  setupToolsEventListeners,
  updateSaveEditorVisibility,
  updateRpgDataEditorVisibility,
} from "../../src/popup/tools.js";
import { getLastDetection } from "../../src/popup/engine-detect.js";

describe("tools – save editor visibility", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="detectEngine">🔍 Engine erkennen</button>
      <div id="openSaveEditor"></div>
      <div id="saveEditorGroup" class="hidden"></div>
      <div id="rpgDataEditorGroup" class="hidden"></div>
      <div id="galleryUnlockerGroup" class="hidden">
        <button id="analyzeGalleryBtn"></button>
        <div id="galleryUnlockerResult" class="hidden"></div>
      </div>
    `;
    jest.clearAllMocks();
    globalThis.chrome = {
      runtime: { getURL: jest.fn((p) => "chrome-extension://id/" + p) },
    };
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  test("shows save editor group for rpgmaker engine", () => {
    getLastDetection.mockReturnValue({
      id: "rpgmaker-mv-mz",
      name: "RPG Maker MV/MZ",
    });
    updateSaveEditorVisibility();
    const group = document.getElementById("saveEditorGroup");
    expect(group.classList.contains("hidden")).toBe(false);
  });

  test("hides save editor group for non-rpgmaker engine", () => {
    getLastDetection.mockReturnValue({ id: "phaser", name: "Phaser" });
    updateSaveEditorVisibility();
    const group = document.getElementById("saveEditorGroup");
    expect(group.classList.contains("hidden")).toBe(true);
  });

  test("hides save editor group when no engine detected", () => {
    getLastDetection.mockReturnValue(null);
    updateSaveEditorVisibility();
    const group = document.getElementById("saveEditorGroup");
    expect(group.classList.contains("hidden")).toBe(true);
  });

  test("setupToolsEventListeners wires detectEngine button", () => {
    setupToolsEventListeners();
    const btn = document.getElementById("detectEngine");
    expect(btn).toBeTruthy();
    // Click the button to ensure no errors; the mock prevents real work
    btn.click();
  });

  test("shows gallery-unlocker group for rpgmaker engine", () => {
    getLastDetection.mockReturnValue({
      id: "rpgmaker-mv-mz",
      name: "RPG Maker MV/MZ",
    });
    updateRpgDataEditorVisibility();
    const group = document.getElementById("galleryUnlockerGroup");
    expect(group.classList.contains("hidden")).toBe(false);
  });

  test("hides gallery-unlocker group for non-rpgmaker engine", () => {
    getLastDetection.mockReturnValue({ id: "phaser", name: "Phaser" });
    updateRpgDataEditorVisibility();
    const group = document.getElementById("galleryUnlockerGroup");
    expect(group.classList.contains("hidden")).toBe(true);
  });
});
