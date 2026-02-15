import { $ } from "./utils.js";
import { checkScannerStatus } from "./communication.js";
import { showSetupMode, showScannerMode } from "./ui.js";
import { showError } from "./messages.js";
import { detectAndShowPresets } from "./engine-detect.js";
import {
  configureSetupMode,
  createInjectHandler,
  shouldInjectScannerDirectly,
} from "./popup-injection.js";
import { createSearchHandlers, setupSearchTypeUI } from "./popup-search.js";
import { createTabContextController } from "./popup-tab-context.js";
import * as popupSelf from "./popup.js";

let statusInterval;
let statusFailures = 0;
let directScannerInjection = false;

// Handlers are exported for unit testing. They are assigned once the
// DOMContentLoaded handler runs and all required DOM elements exist.
export let onInject;
export let onStart;
export let onRefine;
export let onNewSearch;

export let startConnectionMonitor = function startConnectionMonitor() {
  clearInterval(statusInterval);
  statusFailures = 0;
  statusInterval = setInterval(async () => {
    const ok = await checkScannerStatus();
    if (ok) {
      statusFailures = 0;
    } else if (++statusFailures >= 3) {
      showError("Scanner-Verbindung verloren – bitte Code erneut einfügen");
      showSetupMode();
      stopConnectionMonitor();
    }
  }, 5000);
};

export function stopConnectionMonitor() {
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }
  statusFailures = 0;
}

export function startPolling(options = {}) {
  const {
    showInstructions = true,
    timeoutMessage = "Scanner nicht gefunden – Code korrekt eingefügt?",
  } = options;

  const instructionsEl = $("#instructions");
  if (instructionsEl) {
    instructionsEl.classList.toggle("hidden", !showInstructions);
  }

  let scannerFound = false;
  let checkInFlight = false;
  const checkInterval = setInterval(async () => {
    if (checkInFlight) return;
    checkInFlight = true;
    try {
      const isLoaded = await checkScannerStatus();
      if (isLoaded) {
        scannerFound = true;
        clearInterval(checkInterval);
        showScannerMode();
        popupSelf.startConnectionMonitor();
        detectAndShowPresets();
      }
    } finally {
      checkInFlight = false;
    }
  }, 500);

  setTimeout(() => {
    clearInterval(checkInterval);
    if (!scannerFound) {
      showError(timeoutMessage);
    }
  }, 30000);
}

document.addEventListener("DOMContentLoaded", async () => {
  const valueInput = $("#value");
  const searchTypeSelect = $("#searchType");
  const nameInputGroup = $("#nameInputGroup");
  const nameInput = $("#nameInput");

  if (!valueInput || !searchTypeSelect || !nameInputGroup || !nameInput) {
    console.error("Popup initialization failed: missing required controls.");
    return;
  }

  directScannerInjection = shouldInjectScannerDirectly();
  configureSetupMode({ directScannerInjection });
  setupSearchTypeUI({
    searchTypeSelect,
    nameInputGroup,
    valueInput,
  });

  const tabContextController = createTabContextController({
    startConnectionMonitor: () => popupSelf.startConnectionMonitor(),
    stopConnectionMonitor,
    isConnectionMonitorRunning: () => Boolean(statusInterval),
  });
  tabContextController.attachListeners();

  onInject = createInjectHandler({
    directScannerInjection,
    startPolling,
  });

  const searchHandlers = createSearchHandlers({
    searchTypeSelect,
    valueInput,
    nameInput,
  });
  onStart = searchHandlers.onStart;
  onRefine = searchHandlers.onRefine;
  onNewSearch = searchHandlers.onNewSearch;

  valueInput.addEventListener("keydown", searchHandlers.handleEnterKey);
  nameInput.addEventListener("keydown", searchHandlers.handleEnterKey);

  // ensure old listeners are removed before adding new ones
  $("#inject").removeEventListener("click", onInject);
  $("#inject").addEventListener("click", onInject);

  $("#start").removeEventListener("click", onStart);
  $("#start").addEventListener("click", onStart);

  $("#refine").removeEventListener("click", onRefine);
  $("#refine").addEventListener("click", onRefine);

  $("#newSearch").removeEventListener("click", onNewSearch);
  $("#newSearch").addEventListener("click", onNewSearch);

  await tabContextController.refreshVisibleTabContext({ force: true });
});
