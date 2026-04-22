import { $, tryParse, escapeHtml, safeStringify } from "./utils.js";
import {
  saveFavorite,
  loadFavorites,
  setupFavoritesEventListeners,
} from "./favorites.js";
import { setupToolsEventListeners } from "./tools.js";
import { setupStorageToolsEventListeners } from "./storage-tools.js";
import { send, getActiveTab } from "./communication.js";
import { showError, showSuccess } from "./messages.js";
import { showDialog } from "./dialog.js";

let favoritesListenerAdded = false;
let toolsListenerAdded = false;
let tabsInitialized = false;
let editorFrameLoaded = false;
let editorFrameTabId = null;
let hitsInteractionContainer = null;
let currentHits = [];

function getEditorFrameBaseUrl() {
  const runtime = globalThis.chrome?.runtime;
  return runtime?.getURL
    ? runtime.getURL("src/popup/rpgmaker-data-editor.html")
    : "rpgmaker-data-editor.html";
}

function setEditorFrameSource(frame, tabId) {
  const normalizedTabId = tabId == null ? null : tabId;
  const base = getEditorFrameBaseUrl();
  frame.src =
    normalizedTabId == null ? base : `${base}?tabId=${normalizedTabId}`;
  editorFrameLoaded = true;
  editorFrameTabId = normalizedTabId;
}

export function syncEditorFrameWithTabId(tabId) {
  const frame = document.getElementById("editorFrame");
  if (!frame) return;
  const normalizedTabId = tabId == null ? null : tabId;
  if (editorFrameLoaded && editorFrameTabId === normalizedTabId) {
    return;
  }
  setEditorFrameSource(frame, normalizedTabId);
}

async function ensureEditorFrameLoaded() {
  if (editorFrameLoaded) return;
  const frame = document.getElementById("editorFrame");
  if (!frame) return;
  let tabId;
  try {
    const tab = await getActiveTab();
    tabId = tab?.id;
  } catch {
    /* ignore */
  }
  setEditorFrameSource(frame, tabId);
}

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
    } else if (targetTab === "editor") {
      ensureEditorFrameLoaded();
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

  // If the popup gets resized so narrow that the editor tab is no longer
  // visible, fall back to the search tab so no empty panel is shown.
  if (typeof ResizeObserver !== "undefined") {
    const editorBtn = document.getElementById("tab-editor");
    const searchBtn = document.querySelector('.tab-button[data-tab="search"]');
    if (editorBtn && searchBtn) {
      const ro = new ResizeObserver(() => {
        const visible = editorBtn.offsetParent !== null;
        if (!visible && editorBtn.classList.contains("active")) {
          activateTab(searchBtn);
        }
      });
      ro.observe(document.body);
    }
  }
}

export function showSetupMode() {
  $("#setupSection").style.display = "block";
  $("#scannerUI").style.display = "none";
}

export function showScannerMode() {
  $("#setupSection").style.display = "none";
  $("#scannerUI").style.display = "block";
  initTabs();
  showSuccess("✅ Scanner erfolgreich geladen!");
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

export function renderHitsWithSaveButtons(list) {
  const hitsUl = $("#hits");
  currentHits = Array.isArray(list) ? list : [];
  ensureHitsInteractionBound(hitsUl);
  hitsUl.textContent = "";
  if (!list || list.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "text-secondary";
    emptyLi.textContent = "Keine Treffer gefunden";
    hitsUl.appendChild(emptyLi);
    return;
  }

  list.forEach((h, i) => {
    const li = document.createElement("li");
    const hitInfo = document.createElement("div");
    hitInfo.className = "hit-info";
    const displayPath = h.path.replace(/^window\.globalThis\./, "");
    hitInfo.textContent = `[${i}] ${displayPath} = ${safeStringify(h.value)}`;

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-btn";
    saveBtn.textContent = "💾";
    saveBtn.dataset.action = "save";
    saveBtn.dataset.idx = String(i);
    saveBtn.title = "Als Favorit speichern";
    saveBtn.setAttribute("aria-label", `${displayPath} als Favorit speichern`);

    const freezeBtn = document.createElement("button");
    freezeBtn.className = "freeze-btn";
    freezeBtn.textContent = "❄️";
    freezeBtn.dataset.action = "freeze";
    freezeBtn.dataset.idx = String(i);
    freezeBtn.title = "Wert einfrieren";
    freezeBtn.setAttribute("aria-label", `${displayPath} einfrieren`);
    freezeBtn.dataset.path = h.path;

    hitInfo.dataset.action = "edit";
    hitInfo.dataset.idx = String(i);

    li.appendChild(hitInfo);
    li.appendChild(saveBtn);
    li.appendChild(freezeBtn);
    hitsUl.appendChild(li);
  });
}

function ensureHitsInteractionBound(hitsUl) {
  if (!hitsUl || hitsInteractionContainer === hitsUl) return;
  hitsInteractionContainer = hitsUl;

  hitsUl.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest("[data-action]");
    if (!(actionEl instanceof Element)) return;
    const idx = Number(actionEl.getAttribute("data-idx"));
    if (!Number.isFinite(idx)) return;
    const hit = currentHits[idx];
    if (!hit) return;
    const displayPath = hit.path.replace(/^window\.globalThis\./, "");
    const action = actionEl.getAttribute("data-action");

    if (action === "save") {
      event.stopPropagation();
      saveFavorite(hit.path, hit.value);
      return;
    }

    if (action === "freeze") {
      event.stopPropagation();
      if (actionEl.classList.toggle("active")) {
        actionEl.textContent = "🔥";
        actionEl.setAttribute("title", "Einfrieren aufheben");
        actionEl.setAttribute(
          "aria-label",
          `${displayPath} Einfrieren aufheben`,
        );
        send("freeze", { path: hit.path, value: hit.value });
      } else {
        actionEl.textContent = "❄️";
        actionEl.setAttribute("title", "Wert einfrieren");
        actionEl.setAttribute("aria-label", `${displayPath} einfrieren`);
        send("unfreeze", { path: hit.path });
      }
      return;
    }

    if (action === "edit") {
      const value = await showDialog({
        type: "prompt",
        title: "Wert ändern",
        message: `Neuer Wert für ${displayPath}:`,
        defaultValue: String(hit.value),
      });
      if (value !== null) {
        const success = await send("poke", { idx, value: tryParse(value) });
        if (success) updateList();
      }
    }
  });
}
