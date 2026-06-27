import { jest } from "@jest/globals";

jest.mock("../../src/popup/communication.js", () => ({
  checkScannerStatus: jest.fn(),
  queryTabs: jest.fn(),
  setActiveTab: jest.fn(),
}));

jest.mock("../../src/popup/ui.js", () => ({
  showSetupMode: jest.fn(),
  showScannerMode: jest.fn(),
  syncEditorFrameWithTabId: jest.fn(),
  updateList: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/popup/engine-detect.js", () => ({
  detectAndShowPresets: jest.fn(),
}));

import {
  checkScannerStatus,
  queryTabs,
  setActiveTab,
} from "../../src/popup/communication.js";
import { createTabContextController } from "../../src/popup/popup-tab-context.js";

describe("createTabContextController", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="scannerUI" style="display:none"></div>`;
    jest.clearAllMocks();
  });

  test("refreshVisibleTabContext caches both tab id and url", async () => {
    queryTabs.mockResolvedValue([
      { id: 42, url: "https://example.com/game" },
    ]);
    checkScannerStatus.mockResolvedValue(false);

    const controller = createTabContextController({
      startConnectionMonitor: jest.fn(),
      stopConnectionMonitor: jest.fn(),
      isConnectionMonitorRunning: () => false,
    });

    await controller.refreshVisibleTabContext();

    expect(setActiveTab).toHaveBeenCalledWith({
      id: 42,
      url: "https://example.com/game",
    });
  });

  test("setup mode is shown when no active tab exists", async () => {
    queryTabs.mockResolvedValue([]);

    const stopMonitor = jest.fn();
    const controller = createTabContextController({
      startConnectionMonitor: jest.fn(),
      stopConnectionMonitor: stopMonitor,
      isConnectionMonitorRunning: () => false,
    });

    await controller.refreshVisibleTabContext();

    expect(setActiveTab).not.toHaveBeenCalled();
    expect(stopMonitor).toHaveBeenCalled();
  });
});
