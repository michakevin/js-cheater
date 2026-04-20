import { showError, showInfo, showSuccess } from "./messages.js";
import { send } from "./communication.js";
import { parsePath } from "../parse-path.js";
import {
  getDomainKey,
  getDomainFromKey,
  listStoredFavoriteDomains,
  getFavorites,
  saveFavorites,
  getInputs,
  saveFavoriteInputValue,
  clearFavoriteInputValue,
} from "./favorites-storage.js";
import {
  renderFavorites,
  setupFavoritesEventListeners as setupUI,
} from "./favorites-ui.js";
import { showDialog } from "./dialog.js";

export { getDomainKey } from "./favorites-storage.js";

const DOMAIN_SELECT_ID = "favoritesDomainSelect";
const IMPORT_BUTTON_ID = "adoptFavoritesForCurrentDomain";
const UNKNOWN_DOMAIN = "unknown";

/**
 * Small FSM-ish store that groups the mutable domain state used by the
 * favorites tab. `current` is the domain derived from the active tab and
 * `selected` is whatever the user chose in the domain picker. Once
 * `pinned` is true, `selected` sticks even if the current tab changes.
 */
const domainStore = {
  current: UNKNOWN_DOMAIN,
  selected: null,
  pinned: false,
  getActive() {
    return this.selected || this.current;
  },
  setCurrent(domain) {
    this.current = domain;
    if (!this.selected || !this.pinned) {
      this.selected = domain;
    }
  },
  pin(domain) {
    this.selected = domain;
    this.pinned = domain !== this.current;
  },
  unpin() {
    this.selected = this.current;
    this.pinned = false;
  },
};

let domainSelectListenerAdded = false;
let importButtonListenerAdded = false;

function createFavoriteId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

function getActiveFavoritesDomain() {
  return domainStore.getActive();
}

async function refreshDomainContext() {
  domainStore.setCurrent(getDomainFromKey(await getDomainKey()));
}

function getVisibleDomains() {
  const domains = new Set(listStoredFavoriteDomains());
  domains.add(domainStore.current);
  domains.add(domainStore.getActive());

  const sortedOthers = [...domains]
    .filter((domain) => domain && domain !== domainStore.current)
    .sort((a, b) => a.localeCompare(b));

  return [domainStore.current, ...sortedOthers];
}

function renderDomainControls() {
  const domainSelect = document.getElementById(DOMAIN_SELECT_ID);
  const importButton = document.getElementById(IMPORT_BUTTON_ID);
  const visibleDomains = getVisibleDomains();

  if (domainSelect) {
    domainSelect.textContent = "";
    visibleDomains.forEach((domain) => {
      const option = document.createElement("option");
      option.value = domain;
      option.textContent =
        domain === domainStore.current ? `${domain} (aktuell)` : domain;
      domainSelect.appendChild(option);
    });

    if (!visibleDomains.includes(domainStore.selected)) {
      domainStore.unpin();
    }
    domainSelect.value = domainStore.getActive();
  }

  if (importButton) {
    const foreignDomainSelected =
      domainStore.getActive() !== domainStore.current;
    importButton.classList.toggle("hidden", !foreignDomainSelected);
    importButton.disabled = !foreignDomainSelected;
  }
}

async function getFavoritesForSelectedDomain() {
  await refreshDomainContext();
  return getFavorites(getActiveFavoritesDomain());
}

async function saveFavoriteInputForSelectedDomain(id, value) {
  await refreshDomainContext();
  await saveFavoriteInputValue(id, value, getActiveFavoritesDomain());
}

export async function exportFavorites() {
  await refreshDomainContext();
  const domain = getActiveFavoritesDomain();
  const favorites = await getFavorites(domain);
  const blob = new Blob([JSON.stringify(favorites, null, 2)], {
    type: "application/json",
  });
  const fileName = `js-cheater-favorites-${domain.replace(/[^a-z0-9]+/gi, "_")}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showSuccess("Favoriten exportiert!");
}

export async function importFavoritesFromText(text) {
  try {
    await refreshDomainContext();
    const domain = getActiveFavoritesDomain();
    const data = JSON.parse(text);
    const favorites = await getFavorites(domain);
    const items = Array.isArray(data) ? data : Object.values(data);
    items.forEach((fav) => {
      if (!fav || !fav.path) return;
      const id = createFavoriteId();
      favorites[id] = {
        id,
        name: fav.name || "favorite",
        path: fav.path,
        value: fav.value,
        savedAt: new Date().toISOString(),
      };
    });
    await saveFavorites(favorites, domain);
    await loadFavorites();
    showSuccess("Favoriten importiert!");
  } catch (e) {
    console.error("Import failed", e);
    await showDialog({
      type: "alert",
      title: "Import fehlgeschlagen",
      message: e.message,
    });
  }
}

async function importFavoritesToCurrentDomain() {
  await refreshDomainContext();
  const sourceDomain = domainStore.getActive();
  if (sourceDomain === domainStore.current) {
    return;
  }

  const sourceFavorites = await getFavorites(sourceDomain);
  const sourceItems = Object.values(sourceFavorites).filter((fav) => fav?.path);
  if (sourceItems.length === 0) {
    showInfo("Keine Favoriten in der gewählten Domain gefunden.");
    return;
  }

  const targetFavorites = await getFavorites(domainStore.current);
  const existingPaths = new Set(
    Object.values(targetFavorites).map((fav) => fav.path),
  );

  let importedCount = 0;
  sourceItems.forEach((fav) => {
    if (existingPaths.has(fav.path)) {
      return;
    }
    const id = createFavoriteId();
    targetFavorites[id] = {
      id,
      name: fav.name || "favorite",
      path: fav.path,
      value: fav.value,
      savedAt: new Date().toISOString(),
    };
    existingPaths.add(fav.path);
    importedCount += 1;
  });

  if (importedCount === 0) {
    showInfo("Alle Favoriten existieren bereits in der aktuellen Domain.");
    return;
  }

  await saveFavorites(targetFavorites, domainStore.current);
  domainStore.unpin();
  await loadFavorites();
  showSuccess(`${importedCount} Favoriten für die aktuelle Domain übernommen.`);
}

async function deleteFavorite(id) {
  await refreshDomainContext();
  const domain = getActiveFavoritesDomain();
  const favorites = await getFavorites(domain);
  delete favorites[id];
  await saveFavorites(favorites, domain);
  await clearFavoriteInputValue(id, domain);
  await loadFavorites();
}

async function updateFavorite(id, newValue) {
  await refreshDomainContext();
  const domain = getActiveFavoritesDomain();
  const favorites = await getFavorites(domain);
  const favorite = favorites[id];
  if (!favorite) {
    console.error("Favorite not found for ID:", id);
    await showDialog({
      type: "alert",
      title: "Fehler",
      message: "Favorit nicht gefunden!",
    });
    return;
  }

  try {
    const result = await send("poke", {
      path: favorite.path,
      value: newValue,
    });
    if (result && result.success) {
      favorite.value = newValue;
      favorites[id] = favorite;
      await saveFavorites(favorites, domain);
      await loadFavorites();
      showSuccess(`"${favorite.name}" aktualisiert`);
    } else {
      const errorMsg =
        result?.error || result?.message || "Unbekannter Fehler";
      console.error(`Fehler beim Ändern von ${favorite.name}: ${errorMsg}`);
      showError(`"${favorite.name}" konnte nicht geändert werden: ${errorMsg}`);
    }
  } catch (err) {
    console.error("Poke error caught:", err);
    showError(
      `"${favorite.name}" konnte nicht geändert werden: ${err?.message || err}`,
    );
  }
}

export async function renameFavorite(id, newName) {
  await refreshDomainContext();
  const domain = getActiveFavoritesDomain();
  const favorites = await getFavorites(domain);
  const favorite = favorites[id];
  if (!favorite) return false;
  favorite.name = newName;
  favorites[id] = favorite;
  await saveFavorites(favorites, domain);
  await loadFavorites();
  showSuccess(`Name geändert zu "${newName}"`);
  return true;
}

export async function saveFavorite(path, value, defaultName) {
  await refreshDomainContext();
  const favorites = await getFavorites(domainStore.current);
  const name = await showDialog({
    type: "prompt",
    title: "Favorit speichern",
    message: "Name für diese Variable:",
    defaultValue: defaultName || parsePath(path).pop() || "variable",
  });
  if (!name) return;

  const id = createFavoriteId();
  favorites[id] = { id, name, path, value, savedAt: new Date().toISOString() };
  await saveFavorites(favorites, domainStore.current);
  showSuccess(`💾 "${name}" als Favorit gespeichert!`);

  if (
    document
      .querySelector('.tab-button[data-tab="favorites"]')
      ?.classList.contains("active")
  ) {
    await loadFavorites();
  }
}

function bindDomainControlEvents() {
  const domainSelect = document.getElementById(DOMAIN_SELECT_ID);
  if (domainSelect && !domainSelectListenerAdded) {
    domainSelect.addEventListener("change", async (event) => {
      const target = event.target;
      if (!target || typeof target.value !== "string") {
        return;
      }
      const next = target.value || domainStore.current;
      domainStore.pin(next);
      await loadFavorites();
    });
    domainSelectListenerAdded = true;
  }

  const importButton = document.getElementById(IMPORT_BUTTON_ID);
  if (importButton && !importButtonListenerAdded) {
    importButton.addEventListener("click", () => {
      void importFavoritesToCurrentDomain();
    });
    importButtonListenerAdded = true;
  }
}

export async function loadFavorites() {
  await refreshDomainContext();
  bindDomainControlEvents();
  renderDomainControls();
  const domain = getActiveFavoritesDomain();
  const [favorites, inputs] = await Promise.all([
    getFavorites(domain),
    getInputs(domain),
  ]);
  renderFavorites(favorites, inputs);
}

export function setupFavoritesEventListeners() {
  bindDomainControlEvents();
  setupUI({
    getFavorites: getFavoritesForSelectedDomain,
    updateFavorite,
    deleteFavorite,
    renameFavorite,
    saveFavoriteInputValue: saveFavoriteInputForSelectedDomain,
    exportFavorites,
    importFavoritesFromText,
  });
}

// Export additional functions for unit tests
export { updateFavorite, deleteFavorite };
