import { jest } from "@jest/globals";

jest.mock("../../src/popup/communication.js", () => ({
  send: jest.fn(),
}));

import { send } from "../../src/popup/communication.js";
import {
  setupGalleryUnlockerListeners,
  updateGalleryUnlockerVisibility,
} from "../../src/popup/gallery-unlocker-ui.js";

describe("gallery-unlocker-ui", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="galleryUnlockerGroup">
        <button id="analyzeGalleryBtn">Analysieren</button>
        <div id="galleryUnlockerStatus" class="gallery-unlocker-status hidden"></div>
        <div id="galleryUnlockerResult" class="gallery-unlocker-result hidden"></div>
      </div>
    `;
    jest.clearAllMocks();
  });

  test("shows local status after successful tier-2 unlock", async () => {
    send
      .mockResolvedValueOnce({
        scannerEngineDetected: true,
        tier1: { available: false, adapters: [] },
        tier2: {
          available: true,
          switchCount: 3,
          totalSwitches: 10,
          sampleNames: ["2: CG 01"],
          idRange: { min: 2, max: 5 },
        },
        tier3: {
          available: true,
          totalSwitches: 10,
          suggestedRange: { min: 1, max: 10 },
        },
        warnings: [],
      })
      .mockResolvedValueOnce({
        tier: "switches",
        applied: 2,
        skipped: 1,
        total: 3,
        errors: [],
        needsMenuRefresh: true,
      })
      .mockResolvedValueOnce({
        scannerEngineDetected: true,
        tier1: { available: false, adapters: [] },
        tier2: {
          available: true,
          switchCount: 3,
          totalSwitches: 10,
          sampleNames: ["2: CG 01"],
          idRange: { min: 2, max: 5 },
        },
        tier3: {
          available: true,
          totalSwitches: 10,
          suggestedRange: { min: 1, max: 10 },
        },
        warnings: [],
      });

    setupGalleryUnlockerListeners();
    document.getElementById("analyzeGalleryBtn").click();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    document.querySelector('[data-tier="switches"] button').click();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    const status = document.getElementById("galleryUnlockerStatus");
    expect(status.classList.contains("hidden")).toBe(false);
    expect(status.classList.contains("status-success")).toBe(true);
    expect(status.textContent).toMatch(/2 freigeschaltet/);
  });

  test("renders risk checkbox and label as adjacent flex row", async () => {
    send.mockResolvedValue({
      scannerEngineDetected: true,
      tier1: { available: false, adapters: [] },
      tier2: { available: false, switchCount: 0, totalSwitches: 5, sampleNames: [], idRange: null },
      tier3: {
        available: true,
        totalSwitches: 5,
        suggestedRange: { min: 1, max: 5 },
      },
      warnings: [],
    });

    setupGalleryUnlockerListeners();
    document.getElementById("analyzeGalleryBtn").click();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    const risk = document.querySelector(".gallery-tier-risk");
    expect(risk).toBeTruthy();
    expect(risk.querySelector("#galleryRangeAck")).toBeTruthy();
    expect(risk.querySelector(".gallery-tier-risk-text")?.textContent).toMatch(
      /Risiko/,
    );
  });

  test("hides gallery group and clears status for non-rpgmaker", () => {
    document.getElementById("galleryUnlockerStatus").textContent = "Test";
    document.getElementById("galleryUnlockerStatus").classList.remove("hidden");
    updateGalleryUnlockerVisibility(false);
    expect(document.getElementById("galleryUnlockerGroup").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("galleryUnlockerStatus").classList.contains("hidden")).toBe(true);
  });

  test("renders name filter card and range preview", async () => {
    send.mockResolvedValue({
      scannerEngineDetected: true,
      tier1: { available: false, adapters: [] },
      tier2: {
        available: true,
        switchCount: 2,
        totalSwitches: 100,
        sampleNames: ["2: CG"],
        idRange: { min: 50, max: 60 },
      },
      tier3: {
        available: true,
        totalSwitches: 100,
        suggestedRange: { min: 40, max: 70 },
      },
      warnings: [],
    });

    setupGalleryUnlockerListeners();
    document.getElementById("analyzeGalleryBtn").click();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(document.querySelector('[data-tier="filter"]')).toBeTruthy();
    expect(document.getElementById("galleryNameFilter")).toBeTruthy();
    expect(document.getElementById("galleryRangePreview")?.textContent).toMatch(
      /Schalter/,
    );
  });
});
