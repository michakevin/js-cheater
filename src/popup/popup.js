import { $, tryParse } from "./utils.js";
import {
  send,
  checkScannerStatus,
  setActiveTab,
  queryTabs,
} from "./communication.js";
import {
  showSetupMode,
  showScannerMode,
  showInitialScanState,
  showRefineScanState,
  showLoading,
  setScanButtonsDisabled,
  updateList,
} from "./ui.js";
import { showError } from "./messages.js";
import { showDialog } from "./dialog.js";
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
  $("#instructions").classList.remove("hidden");
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
      }
    } finally {
      checkInFlight = false;
    }
  }, 500);
  setTimeout(() => {
    clearInterval(checkInterval);
    if (!scannerFound) {
      showError("Scanner nicht gefunden – Code korrekt eingefügt?");
    }
  }, 30000);
}

async function runSearch({ cmd, value }) {
  const result = await send(cmd, { value });
  if (result !== null) {
    if (typeof result === "object") {
      if (result.error) {
        showError(`❌ ${result.error}`);
      } else {
        showError(`⚠️ Unerwartete Antwort: ${JSON.stringify(result)}`);
      }
      return null;
    }
    return result;
  }
  return null;
}

function fallbackCopyText(text) {
  if (typeof document.execCommand !== "function") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy") === true;
  } catch (error) {
    console.error("Fallback copy failed:", error);
    return false;
  } finally {
    textarea.remove();
  }
}

async function copyScannerCode(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  return fallbackCopyText(text);
}

document.addEventListener("DOMContentLoaded", async () => {
  const valueInput = $("#value");
  const searchTypeSelect = $("#searchType");

  const [tab] = await queryTabs({ active: true, currentWindow: true });
  if (tab) setActiveTab(tab.id);

  async function onInjectHandler() {
    const injectBtn = $("#inject");
    const copied = await copyScannerCode(SCANNER_CODE);
    if (!copied) {
      await showDialog({
        type: "alert",
        title: "Kopieren fehlgeschlagen",
        message: "Bitte manuell kopieren.",
      });
    } else {
      // Visual copy feedback
      const originalText = injectBtn.textContent;
      injectBtn.textContent = "✅ Kopiert!";
      injectBtn.classList.add("copied");
      setTimeout(() => {
        injectBtn.textContent = originalText;
        injectBtn.classList.remove("copied");
      }, 2000);
    }
    let contentScriptReady = true;
    try {
      const [currTab] = await queryTabs({
        active: true,
        currentWindow: true,
      });
      if (currTab) {
        setActiveTab(currTab.id);
        if (chrome.scripting?.executeScript) {
          await chrome.scripting.executeScript({
            target: { tabId: currTab.id, allFrames: true },
            files: ["src/content.js"],
          });
        } else if (chrome.tabs?.executeScript) {
          await new Promise((resolve, reject) => {
            let settled = false;
            const settle = (error = null) => {
              if (settled) return;
              settled = true;
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            };

            try {
              const maybePromise = chrome.tabs.executeScript(
                currTab.id,
                {
                  file: "/src/content.js",
                  allFrames: true,
                  matchAboutBlank: true,
                },
                () => settle(chrome.runtime?.lastError ?? null),
              );
              if (maybePromise && typeof maybePromise.then === "function") {
                maybePromise
                  .then(() => settle())
                  .catch((error) => settle(error));
              }
            } catch (error) {
              settle(error);
            }
          });
        }
      } else {
        contentScriptReady = false;
      }
    } catch (err) {
      contentScriptReady = false;
      console.error("Content-script injection failed", err);
    }
    if (copied && contentScriptReady) {
      startPolling();
    } else if (copied && !contentScriptReady) {
      await showDialog({
        type: "alert",
        title: "Fehler",
        message:
          "Content Script konnte nicht geladen werden. Seite neu laden und erneut versuchen.",
      });
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
    showLoading("Scanne...");
    setScanButtonsDisabled(true);
    const cmd = type === "value" ? "start" : "scanByName";
    const result = await runSearch({ cmd, value: val });
    setScanButtonsDisabled(false);
    if (result !== null) {
      showError(`✅ ${result} Treffer gefunden`);
      showRefineScanState();
      setTimeout(updateList, 100);
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
    showLoading("Verfeinere...");
    setScanButtonsDisabled(true);
    const cmd = type === "value" ? "refine" : "refineByName";
    const result = await runSearch({ cmd, value: val });
    setScanButtonsDisabled(false);
    if (result !== null) {
      showError(`🔬 ${result} Treffer nach Verfeinerung`);
      setTimeout(updateList, 100);
    }
  }
  onRefine = onRefineHandler;

  async function onNewSearchHandler() {
    const type = searchTypeSelect.value;
    const raw = valueInput.value;
    const currentValue = type === "value" ? tryParse(raw) : raw.trim();
    if (currentValue !== "") {
      showLoading("Neue Suche...");
      setScanButtonsDisabled(true);
      const cmd = type === "value" ? "start" : "scanByName";
      const result = await runSearch({ cmd, value: currentValue });
      setScanButtonsDisabled(false);
      if (result !== null) {
        showError(`✅ ${result} Treffer gefunden`);
        showRefineScanState();
        setTimeout(updateList, 100);
      }
    } else {
      await send("start", { value: "__RESET_SCAN__" + Math.random() });
      showInitialScanState();
      const { showEmptyState } = await import("./ui.js");
      showEmptyState();
      valueInput.focus();
    }
  }
  onNewSearch = onNewSearchHandler;

  // Enter-key triggers the active scan action
  valueInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // If refineScanGroup is visible, refine; otherwise start
      const refineGroup = $("#refineScanGroup");
      if (refineGroup && !refineGroup.classList.contains("hidden")) {
        onRefineHandler();
      } else {
        onStartHandler();
      }
    }
  });

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
