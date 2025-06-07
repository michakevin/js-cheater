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

let favoritesListenerAdded = false;
let toolsListenerAdded = false;

export function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.getAttribute("data-tab");
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
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
  setTimeout(() => {
    $("#hits").innerHTML =
      "<li style='color: #666;'>Gib einen Wert ein und klicke 'Erster Scan'</li>";
  }, 2000);
  setTimeout(() => $("#value")?.focus(), 100);
  showInitialScanState();
}

export function showInitialScanState() {
  $("#initialScanGroup").style.display = "block";
  $("#refineScanGroup").style.display = "none";
}

export function showRefineScanState() {
  $("#initialScanGroup").style.display = "none";
  $("#refineScanGroup").style.display = "block";
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
    hitsUl.innerHTML = "<li style='color: #666;'>Keine Treffer gefunden</li>";
    return;
  }

  list.forEach((h, i) => {
    const li = document.createElement("li");
    li.textContent = `[${i}] ${h.path} = ${safeStringify(h.value)}`;
    li.onclick = async () => {
      const value = prompt(`Neuer Wert für ${h.path}:`, h.value);
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
    hitsUl.innerHTML = "<li style='color: #666;'>Keine Treffer gefunden</li>";
    return;
  }

  list.forEach((h, i) => {
    const li = document.createElement("li");
    const hitInfo = document.createElement("div");
    hitInfo.className = "hit-info";
    hitInfo.innerHTML = `[${i}] ${escapeHtml(h.path)} = ${escapeHtml(safeStringify(h.value))}`;

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-btn";
    saveBtn.innerHTML = "💾";
    saveBtn.title = "Als Favorit speichern";
    saveBtn.onclick = (e) => {
      e.stopPropagation();
      saveFavorite(h.path, h.value);
    };

    const freezeBtn = document.createElement("button");
    freezeBtn.className = "freeze-btn";
    freezeBtn.innerHTML = "❄️";
    freezeBtn.title = "Wert einfrieren";
    freezeBtn.onclick = (e) => {
      e.stopPropagation();
      if (freezeBtn.classList.toggle("active")) {
        send("freeze", { path: h.path, value: h.value });
      } else {
        send("unfreeze", { path: h.path });
      }
    };

    hitInfo.onclick = async () => {
      const value = prompt(`Neuer Wert für ${h.path}:`, h.value);
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
