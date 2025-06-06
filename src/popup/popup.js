import { $, tryParse } from "./utils.js";
import { send, checkScannerStatus } from "./communication.js";
import {
  showSetupMode,
  showScannerMode,
  showInitialScanState,
  showRefineScanState,
  updateList,
} from "./ui.js";
import { showError } from "./messages.js";
import { SCANNER_CODE } from "./scanner-code.js";

export function startPolling() {
  $("#instructions").style.display = "block";
  let scannerFound = false;
  const checkInterval = setInterval(async () => {
    const isLoaded = await checkScannerStatus();
    if (isLoaded) {
      scannerFound = true;
      clearInterval(checkInterval);
      showScannerMode();
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

  async function onInject() {
    try {
      await navigator.clipboard.writeText(SCANNER_CODE);
      startPolling();
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
        startPolling();
      } catch (err) {
        console.error("Fallback copy failed:", err);
        alert("❌ Kopieren fehlgeschlagen - Bitte manuell kopieren");
      }
    }
  }

  async function onStart() {
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

  async function onRefine() {
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

  async function onNewSearch() {
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
        "<li style='color: #666;'>Gib einen Wert ein und klicke 'Erster Scan'</li>";
      valueInput.focus();
    }
  }

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
    await updateList();
  } else {
    showSetupMode();
  }
});
