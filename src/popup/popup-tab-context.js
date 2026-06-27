import {
  checkScannerStatus,
  queryTabs,
  setActiveTab,
} from "./communication.js";
import {
  showSetupMode,
  showScannerMode,
  syncEditorFrameWithTabId,
  updateList,
} from "./ui.js";
import { detectAndShowPresets } from "./engine-detect.js";

export function createTabContextController({
  startConnectionMonitor,
  stopConnectionMonitor,
  isConnectionMonitorRunning,
}) {
  let activeTabSignature = "";
  let tabContextRefreshInFlight = false;
  let queuedTabContextRefresh = null;

  function queueTabContextRefresh(force) {
    if (queuedTabContextRefresh === null) {
      queuedTabContextRefresh = force;
    } else if (force) {
      queuedTabContextRefresh = true;
    }
  }

  async function refreshVisibleTabContext({ force = false } = {}) {
    if (tabContextRefreshInFlight) {
      queueTabContextRefresh(force);
      return;
    }

    tabContextRefreshInFlight = true;

    try {
      const [tab] = await queryTabs({ active: true, currentWindow: true });
      const tabId = tab?.id;
      if (tabId === undefined || tabId === null) {
        showSetupMode();
        stopConnectionMonitor();
        return;
      }

      setActiveTab(tab);

      const tabSignature = `${tabId}|${tab?.url || ""}`;
      const tabChanged = tabSignature !== activeTabSignature;

      if (tabChanged) {
        syncEditorFrameWithTabId(tabId);
      }

      const scannerReady = await checkScannerStatus();

      if (!scannerReady) {
        activeTabSignature = tabSignature;
        showSetupMode();
        stopConnectionMonitor();
        return;
      }

      const scannerUI = document.getElementById("scannerUI");
      if (scannerUI?.style.display === "none") {
        showScannerMode();
      }

      if (tabChanged || !isConnectionMonitorRunning()) {
        startConnectionMonitor();
      }

      detectAndShowPresets();

      if (force || tabChanged) {
        await updateList();

        const favoritesTabButton = document.querySelector(
          '.tab-button[data-tab="favorites"]',
        );
        if (favoritesTabButton?.classList.contains("active")) {
          const { loadFavorites } = await import("./favorites.js");
          await loadFavorites();
        }
      }

      activeTabSignature = tabSignature;
    } catch (error) {
      console.error("Aktiven Tab konnte nicht synchronisiert werden:", error);
    } finally {
      tabContextRefreshInFlight = false;
      if (queuedTabContextRefresh !== null) {
        const forceQueued = queuedTabContextRefresh;
        queuedTabContextRefresh = null;
        void refreshVisibleTabContext({ force: forceQueued });
      }
    }
  }

  function scheduleTabContextRefresh(options = {}) {
    const force = options.force === true;
    if (tabContextRefreshInFlight) {
      queueTabContextRefresh(force);
      return;
    }
    void refreshVisibleTabContext({ force });
  }

  function attachListeners() {
    if (chrome?.tabs?.onActivated?.addListener) {
      chrome.tabs.onActivated.addListener(() => {
        scheduleTabContextRefresh();
      });
    }

    if (chrome?.tabs?.onUpdated?.addListener) {
      chrome.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
        if (!changeInfo?.url && changeInfo?.status !== "complete") {
          return;
        }
        if (typeof updatedTabId !== "number") {
          return;
        }
        scheduleTabContextRefresh();
      });
    }

    if (chrome?.windows?.onFocusChanged?.addListener) {
      chrome.windows.onFocusChanged.addListener(() => {
        scheduleTabContextRefresh();
      });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleTabContextRefresh();
      }
    });
  }

  return {
    refreshVisibleTabContext,
    scheduleTabContextRefresh,
    attachListeners,
  };
}
