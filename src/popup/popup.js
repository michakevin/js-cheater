import { $, tryParse } from "./utils.js";
import { send, checkScannerStatus, setActiveTab } from "./communication.js";
import {
  showSetupMode,
  showScannerMode,
  showInitialScanState,
  showRefineScanState,
  updateList,
} from "./ui.js";
import { showError } from "./messages.js";
import { SCANNER_CODE } from "./scanner-code.js";
import * as popupSelf from "./popup.js";

let statusInterval;
let statusFailures = 0;

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

export function startPolling() {
  $("#instructions").style.display = "block";
  let scannerFound = false;
  const checkInterval = setInterval(async () => {
    const isLoaded = await checkScannerStatus();
    if (isLoaded) {
      scannerFound = true;
      clearInterval(checkInterval);
      showScannerMode();
      popupSelf.startConnectionMonitor();
    }
  }, 500);
  setTimeout(() => {
    clearInterval(checkInterval);
    if (!scannerFound) {
      showError("Scanner nicht gefunden – Code korrekt eingefügt?");
    }
  }, 30000);
}

document.addEventListener("DOMContentLoaded", async () => {
  const valueInput = $("#value");
  const searchTypeSelect = $("#searchType");
  const hitsUl = $("#hits");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) setActiveTab(tab.id);

  async function onInjectHandler() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(SCANNER_CODE);
      copied = true;
    } catch (error) {
      console.error("Copy failed:", error);
      try {
        // Fallback for insecure contexts or denied permissions
        const textarea = document.createElement("textarea");
        textarea.value = SCANNER_CODE;
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        copied = true;
      } catch (err) {
        console.error("Fallback copy failed:", err);
        alert("❌ Kopieren fehlgeschlagen - Bitte manuell kopieren");
      }
    }
    try {
      const [currTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (currTab) {
        await chrome.scripting.executeScript({
          target: { tabId: currTab.id },
          files: ["src/content.js"],
        });
      }
    } catch (err) {
      console.error("Content-script injection failed", err);
    }
    if (copied) {
      startPolling();
    }
  }
  onInject = onInjectHandler;

  async function onStartHandler() {
    const type = searchTypeSelect.value;
    const raw = valueInput.value;
    const val = type === "value" ? tryParse(raw) : raw.trim();
    if (val === "") {
      showError("Bitte einen Wert eingeben");
      return;
    }
    showError("Scanne...");
    const cmd = type === "value" ? "start" : "scanByName";
    const result = await send(cmd, { value: val });
    if (result !== null) {
      if (typeof result === "object") {
        if (result.error) {
          showError(`❌ ${result.error}`);
        } else {
          showError(`⚠️ Unerwartete Antwort: ${JSON.stringify(result)}`);
        }
      } else {
        showError(`✅ ${result} Treffer gefunden`);
        showRefineScanState();
        setTimeout(updateList, 100);
      }
    }
  }
  onStart = onStartHandler;

  async function onRefineHandler() {
    const type = searchTypeSelect.value;
    const raw = valueInput.value;
    const val = type === "value" ? tryParse(raw) : raw.trim();
    if (val === "") {
      showError("Bitte einen Wert eingeben");
      return;
    }
    showError("Verfeinere...");
    const cmd = type === "value" ? "refine" : "refineByName";
    const result = await send(cmd, { value: val });
    if (result !== null) {
      if (typeof result === "object") {
        if (result.error) {
          showError(`❌ ${result.error}`);
        } else {
          showError(`⚠️ Unerwartete Antwort: ${JSON.stringify(result)}`);
        }
      } else {
        showError(`🔬 ${result} Treffer nach Verfeinerung`);
        setTimeout(updateList, 100);
      }
    }
  }
  onRefine = onRefineHandler;

  async function onNewSearchHandler() {
    const type = searchTypeSelect.value;
    const raw = valueInput.value;
    const currentValue = type === "value" ? tryParse(raw) : raw.trim();
    if (currentValue !== "") {
      showError("Neue Suche wird gestartet...");
      const cmd = type === "value" ? "start" : "scanByName";
      const result = await send(cmd, { value: currentValue });
      if (result !== null) {
        if (typeof result === "object") {
          if (result.error) {
            showError(`❌ ${result.error}`);
          } else {
            showError(`⚠️ Unerwartete Antwort: ${JSON.stringify(result)}`);
          }
        } else {
          showError(`✅ ${result} Treffer gefunden`);
          showRefineScanState();
          setTimeout(updateList, 100);
        }
      }
    } else {
      await send("start", { value: "__RESET_SCAN__" + Math.random() });
      showInitialScanState();
      hitsUl.innerHTML =
        "<li class='text-secondary'>Gib einen Wert ein und klicke 'Erster Scan'</li>";
      valueInput.focus();
    }
  }
  onNewSearch = onNewSearchHandler;

  // ensure old listeners are removed before adding new ones
  $("#inject").removeEventListener("click", onInject);
  $("#inject").addEventListener("click", onInject);

  $("#start").removeEventListener("click", onStart);
  $("#start").addEventListener("click", onStart);

  $("#refine").removeEventListener("click", onRefine);
  $("#refine").addEventListener("click", onRefine);

  $("#newSearch").removeEventListener("click", onNewSearch);
  $("#newSearch").addEventListener("click", onNewSearch);

  const scannerReady = await checkScannerStatus();
  if (scannerReady) {
    showScannerMode();
    popupSelf.startConnectionMonitor();
    await updateList();
  } else {
    showSetupMode();
    stopConnectionMonitor();
  }
});
