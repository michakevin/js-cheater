import { $, tryParse, escapeHtml, safeStringify } from "./utils.js";
import {
  saveFavorite,
  loadFavorites,
  setupFavoritesEventListeners,
} from "./favorites.js";
import { setupToolsEventListeners } from "./tools.js";
import { setupStorageToolsEventListeners } from "./storage-tools.js";
import { send } from "./communication.js";
import { showError } from "./messages.js";
import { showDialog } from "./dialog.js";

let favoritesListenerAdded = false;
let toolsListenerAdded = false;
let tabsInitialized = false;

export function initTabs() {
  if (tabsInitialized) return;
  tabsInitialized = true;

  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");

  function activateTab(button) {
    const targetTab = button.getAttribute("data-tab");
    tabButtons.forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
      btn.setAttribute("tabindex", "-1");
    });
    button.classList.add("active");
    button.setAttribute("aria-selected", "true");
    button.setAttribute("tabindex", "0");
    tabPanels.forEach((panel) => panel.classList.remove("active"));
    const targetPanel = document.getElementById(targetTab + "Tab");
    if (targetPanel) targetPanel.classList.add("active");
    if (targetTab === "favorites") {
      loadFavorites();
      if (!favoritesListenerAdded) {
        setupFavoritesEventListeners();
        favoritesListenerAdded = true;
      }
    } else if (targetTab === "tools") {
      if (!toolsListenerAdded) {
        setupToolsEventListeners();
        setupStorageToolsEventListeners();
        toolsListenerAdded = true;
      }
    }
  }

  tabButtons.forEach((button, index) => {
    // Set initial tabindex: only the active tab is focusable
    button.setAttribute("tabindex", index === 0 ? "0" : "-1");

    button.addEventListener("click", () => activateTab(button));

    // Arrow-key navigation between tabs
    button.addEventListener("keydown", (e) => {
      const buttons = [...tabButtons];
      const currentIndex = buttons.indexOf(button);
      let newIndex = -1;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        newIndex = (currentIndex + 1) % buttons.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        newIndex = buttons.length - 1;
      }

      if (newIndex >= 0) {
        buttons[newIndex].focus();
        activateTab(buttons[newIndex]);
      }
    });
  });
}

export function showSetupMode() {
  $("#setupSection").style.display = "block";
  $("#scannerUI").style.display = "none";
}

export function showScannerMode() {
  $("#setupSection").style.display = "none";
  $("#scannerUI").style.display = "block";
  initTabs();
  showError("✅ Scanner erfolgreich geladen!");
  setTimeout(() => $("#value")?.focus(), 100);
  showInitialScanState();
}

export function showInitialScanState() {
  $("#initialScanGroup").style.display = "block";
  $("#refineScanGroup").classList.add("hidden");
}

export function showRefineScanState() {
  $("#initialScanGroup").style.display = "none";
  $("#refineScanGroup").classList.remove("hidden");
}

/**
 * Show a loading spinner in the hits list.
 * @param {string} [message="Scanne..."]
 */
export function showLoading(message = "Scanne...") {
  const hitsUl = $("#hits");
  hitsUl.innerHTML = "";
  const container = document.createElement("li");
  container.className = "loading-container";
  container.innerHTML = `<div class="spinner"></div><span class="loading-text">${escapeHtml(message)}</span>`;
  hitsUl.appendChild(container);
}

/**
 * Empty state placeholder – intentionally a no-op.
 * Kept as export for backward compatibility.
 */
export function showEmptyState() {
  // No-op: hint component removed by design.
}

/**
 * Disable/enable the scan action buttons during a scan.
 * @param {boolean} disabled
 */
export function setScanButtonsDisabled(disabled) {
  ["#start", "#refine", "#newSearch"].forEach((sel) => {
    const btn = $(sel);
    if (btn) btn.disabled = disabled;
  });
}

export async function updateList() {
  const list = await send("list");
  if (list !== null) {
    if (Array.isArray(list)) {
      renderHitsWithSaveButtons(list);
      if (list.length > 0) {
        showRefineScanState();
      } else {
        showInitialScanState();
      }
    } else if (list.error) {
      showError(`❌ ${list.error}`);
    } else {
      showError(`⚠️ Unerwartete Antwort: ${JSON.stringify(list)}`);
    }
  }
}

export function renderHits(list) {
  const hitsUl = $("#hits");
  hitsUl.textContent = "";
  if (!list || list.length === 0) {
    hitsUl.innerHTML = "<li class='text-secondary'>Keine Treffer gefunden</li>";
    return;
  }

  list.forEach((h, i) => {
    const li = document.createElement("li");
    const displayPath = h.path.replace(/^window\.globalThis\./, "");
    li.textContent = `[${i}] ${displayPath} = ${safeStringify(h.value)}`;
    li.onclick = async () => {
      const value = await showDialog({
        type: "prompt",
        title: "Wert ändern",
        message: `Neuer Wert für ${h.path}:`,
        defaultValue: String(h.value),
      });
      if (value !== null) {
        const success = await send("poke", { idx: i, value: tryParse(value) });
        if (success) updateList();
      }
    };
    hitsUl.appendChild(li);
  });
}

export function renderHitsWithSaveButtons(list) {
  const hitsUl = $("#hits");
  hitsUl.textContent = "";
  if (!list || list.length === 0) {
    hitsUl.innerHTML = "<li class='text-secondary'>Keine Treffer gefunden</li>";
    return;
  }

  list.forEach((h, i) => {
    const li = document.createElement("li");
    const hitInfo = document.createElement("div");
    hitInfo.className = "hit-info";
    const displayPath = h.path.replace(/^window\.globalThis\./, "");
    hitInfo.innerHTML = `[${i}] ${escapeHtml(displayPath)} = ${escapeHtml(safeStringify(h.value))}`;

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-btn";
    saveBtn.innerHTML = "💾";
    saveBtn.title = "Als Favorit speichern";
    saveBtn.setAttribute("aria-label", `${displayPath} als Favorit speichern`);
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      saveFavorite(h.path, h.value);
    };

    const freezeBtn = document.createElement("button");
    freezeBtn.className = "freeze-btn";
    freezeBtn.innerHTML = "❄️";
    freezeBtn.title = "Wert einfrieren";
    freezeBtn.setAttribute("aria-label", `${displayPath} einfrieren`);
    freezeBtn.onclick = (e) => {
      e.stopPropagation();
      if (freezeBtn.classList.toggle("active")) {
        freezeBtn.innerHTML = "🔥";
        freezeBtn.title = "Einfrieren aufheben";
        freezeBtn.setAttribute(
          "aria-label",
          `${displayPath} Einfrieren aufheben`,
        );
        send("freeze", { path: h.path, value: h.value });
      } else {
        freezeBtn.innerHTML = "❄️";
        freezeBtn.title = "Wert einfrieren";
        freezeBtn.setAttribute("aria-label", `${displayPath} einfrieren`);
        send("unfreeze", { path: h.path });
      }
    };

    hitInfo.onclick = async () => {
      const value = await showDialog({
        type: "prompt",
        title: "Wert ändern",
        message: `Neuer Wert für ${displayPath}:`,
        defaultValue: String(h.value),
      });
      if (value !== null) {
        const success = await send("poke", { idx: i, value: tryParse(value) });
        if (success) updateList();
      }
    };

    li.appendChild(hitInfo);
    li.appendChild(saveBtn);
    li.appendChild(freezeBtn);
    hitsUl.appendChild(li);
  });
}
