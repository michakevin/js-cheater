import { showSuccess } from "./messages.js";
import { send } from "./communication.js";
import { parsePath } from "./path-utils.js";
import {
  getDomainKey,
  getFavorites,
  saveFavorites,
  getInputs,
  saveFavoriteInputValue,
  clearFavoriteInputValue,
} from "./favorites-storage.js";
import { renderFavorites, setupFavoritesEventListeners as setupUI } from "./favorites-ui.js";

export { getDomainKey } from "./favorites-storage.js";

export async function exportFavorites() {
  const favorites = await getFavorites();
  const blob = new Blob([JSON.stringify(favorites, null, 2)], {
    type: "application/json",
  });
  const domain = (await getDomainKey()).replace("cheat_favorites_", "");
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
    const data = JSON.parse(text);
    const favorites = await getFavorites();
    const items = Array.isArray(data) ? data : Object.values(data);
    items.forEach((fav) => {
      if (!fav || !fav.path) return;
      const id = Date.now().toString() + Math.random().toString(36).slice(2);
      favorites[id] = {
        id,
        name: fav.name || "favorite",
        path: fav.path,
        value: fav.value,
        savedAt: new Date().toISOString(),
      };
    });
    await saveFavorites(favorites);
    await loadFavorites();
    showSuccess("Favoriten importiert!");
  } catch (e) {
    console.error("Import failed", e);
    alert("Import fehlgeschlagen: " + e.message);
  }
}

async function deleteFavorite(id) {
  const favorites = await getFavorites();
  delete favorites[id];
  await saveFavorites(favorites);
  await clearFavoriteInputValue(id);
  await loadFavorites();
}

async function updateFavorite(id, newValue) {
  const favorites = await getFavorites();
  const favorite = favorites[id];
  if (!favorite) {
    console.error("❌ Favorite not found for ID:", id);
    alert("Fehler: Favorit nicht gefunden!");
    return;
  }

  send("poke", { path: favorite.path, value: newValue })
    .then(async (result) => {
      if (result && result.success) {
        favorite.value = newValue;
        favorites[id] = favorite;
        await saveFavorites(favorites);
        await loadFavorites();
      } else {
        const errorMsg = result?.error || result?.message || "Unbekannter Fehler";
        console.error(`❌ Fehler beim Ändern von ${favorite.name}: ${errorMsg}`);
      }
    })
    .catch((err) => {
      console.error("❌ Poke error caught:", err);
    });
}

export async function renameFavorite(id, newName) {
  const favorites = await getFavorites();
  const favorite = favorites[id];
  if (!favorite) return false;
  favorite.name = newName;
  favorites[id] = favorite;
  await saveFavorites(favorites);
  await loadFavorites();
  showSuccess(`Name geändert zu "${newName}"`);
  return true;
}

export async function saveFavorite(path, value) {
  const favorites = await getFavorites();
  const name = prompt(
    "Name für diese Variable:",
    parsePath(path).pop() || "variable"
  );
  if (!name) return;

  const id = Date.now().toString();
  favorites[id] = { id, name, path, value, savedAt: new Date().toISOString() };
  await saveFavorites(favorites);
  showSuccess(`💾 "${name}" als Favorit gespeichert!`);

  if (
    document
      .querySelector('.tab-button[data-tab="favorites"]')
      .classList.contains("active")
  ) {
    await loadFavorites();
  }
}

export async function loadFavorites() {
  const favorites = await getFavorites();
  const inputs = await getInputs();
  renderFavorites(favorites, inputs);
}

export function setupFavoritesEventListeners() {
  setupUI({
    getFavorites,
    updateFavorite,
    deleteFavorite,
    renameFavorite,
    saveFavoriteInputValue,
    exportFavorites,
    importFavoritesFromText,
  });
}

// Export additional functions for unit tests
export { updateFavorite, deleteFavorite };
