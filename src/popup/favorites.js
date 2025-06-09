import { showSuccess } from "./messages.js";
import { send } from "./communication.js";
import { escapeHtml } from "./utils.js";
import { parsePath } from "./path-utils.js";
import { loadFromStorage, saveToStorage } from "./storage-utils.js";

let domainKeyPromise;
export async function getDomainKey() {
  if (!domainKeyPromise) {
    domainKeyPromise = chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const url = tabs[0]?.url || "";
        return "cheat_favorites_" + new URL(url).origin;
      })
      .catch(() => "cheat_favorites_unknown");
  }
  return domainKeyPromise;
}

async function getFavoritesKey() {
  return getDomainKey();
}

async function getInputsKey() {
  const key = await getDomainKey();
  return key + "_inputs";
}

async function getFavorites() {
  const key = await getFavoritesKey();
  return loadFromStorage(key);
}

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
    const key = await getFavoritesKey();
    saveToStorage(key, favorites);
    loadFavorites();
    showSuccess("Favoriten importiert!");
  } catch (e) {
    console.error("Import failed", e);
    alert("Import fehlgeschlagen: " + e.message);
  }
}

async function saveFavoriteInputValue(id, value) {
  try {
    const key = await getInputsKey();
    const inputs = loadFromStorage(key);
    inputs[id] = value;
    saveToStorage(key, inputs);
  } catch (e) {
    console.error("Failed to save favorite input value:", e);
  }
}

async function clearFavoriteInputValue(id) {
  try {
    const key = await getInputsKey();
    const inputs = loadFromStorage(key);
    delete inputs[id];
    saveToStorage(key, inputs);
  } catch (e) {
    console.error("Failed to clear favorite input value:", e);
  }
}

async function deleteFavorite(id) {
  const favorites = await getFavorites();
  delete favorites[id];
  const key = await getFavoritesKey();
  saveToStorage(key, favorites);
  await clearFavoriteInputValue(id);
  loadFavorites();
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
        const key = await getFavoritesKey();
        saveToStorage(key, favorites);
        loadFavorites();
      } else {
        const errorMsg =
          result?.error || result?.message || "Unbekannter Fehler";
        console.error(
          `❌ Fehler beim Ändern von ${favorite.name}: ${errorMsg}`
        );
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
  const key = await getFavoritesKey();
  saveToStorage(key, favorites);
  loadFavorites();
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
  const key = await getFavoritesKey();
  saveToStorage(key, favorites);
  showSuccess(`💾 "${name}" als Favorit gespeichert!`);

  if (
    document
      .querySelector('.tab-button[data-tab="favorites"]')
      .classList.contains("active")
  ) {
    loadFavorites();
  }
}

export async function loadFavorites() {
  const favorites = await getFavorites();
  const inputs = loadFromStorage(await getInputsKey());
  const favoritesContent = document.getElementById("favoritesContent");

  if (Object.keys(favorites).length === 0) {
    favoritesContent.innerHTML = `
      <div class="no-favorites">
        📝 Keine Favoriten gespeichert.<br />
        <small>Speichere Variablen im Such-Tab mit dem 💾 Button.</small>
      </div>
    `;
    return;
  }

  const table = document.createElement("table");
  table.className = "favorites-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Name</th>
        <th>Wert</th>
        <th>Neu</th>
        <th>Aktionen</th>
      </tr>
    </thead>
    <tbody>
      ${Object.values(favorites)
        .map(
          (fav) => `
        <tr>
          <td class="favorite-name" data-id="${fav.id}" title="${escapeHtml(fav.path)}" style="max-width: 80px; overflow: hidden; text-overflow: ellipsis; cursor: pointer;">${escapeHtml(fav.name)}</td>
          <td style="font-weight: bold;">${escapeHtml(JSON.stringify(fav.value))}</td>
          <td><input type="text" id="newValue_${fav.id}" placeholder="Neuer Wert..." value="${inputs[fav.id] || ""}" /></td>
          <td>
            <div class="action-buttons">
              <button class="freeze-btn" data-id="${fav.id}" title="Einfrieren">❄️</button>
              <button class="update-btn" data-id="${fav.id}" title="Wert ändern">✏️</button>
              <button class="delete-btn" data-id="${fav.id}" title="Favorit löschen">🗑️</button>
            </div>
          </td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  `;

  favoritesContent.innerHTML = "";
  favoritesContent.appendChild(table);
}

function handleUpdateFavorite(id) {
  const input = document.getElementById(`newValue_${id}`);
  if (!input) return;
  const inputValue = input.value.trim();
  if (!inputValue) return;
  let newValue = inputValue;
  if (!isNaN(inputValue) && inputValue !== "") {
    newValue = parseFloat(inputValue);
  } else if (inputValue === "true" || inputValue === "false") {
    newValue = inputValue === "true";
  }
  updateFavorite(id, newValue);
}

async function handleDeleteFavorite(id) {
  const favorites = await getFavorites();
  const favorite = favorites[id];
  if (!favorite) return;
  if (confirm(`Favorit "${favorite.name}" wirklich löschen?`)) {
    deleteFavorite(id);
  }
}

async function handleFavoritesClick(e) {
  const target = e.target;
  const id = target.getAttribute("data-id");
  if (!id) return;
  if (target.classList.contains("update-btn")) {
    e.preventDefault();
    e.stopPropagation();
    handleUpdateFavorite(id);
  } else if (target.classList.contains("delete-btn")) {
    e.preventDefault();
    e.stopPropagation();
    handleDeleteFavorite(id);
  } else if (target.classList.contains("freeze-btn")) {
    e.preventDefault();
    e.stopPropagation();
    const favorites = await getFavorites();
    const fav = favorites[id];
    if (!fav) return;
    if (target.classList.toggle("active")) {
      send("freeze", { path: fav.path, value: fav.value });
    } else {
      send("unfreeze", { path: fav.path });
    }
  } else if (target.classList.contains("favorite-name")) {
    e.preventDefault();
    e.stopPropagation();
    const favorites = await getFavorites();
    const fav = favorites[id];
    if (!fav) return;
    const newName = prompt("Neuer Name:", fav.name);
    if (newName && newName.trim()) {
      renameFavorite(id, newName.trim());
    }
  }
}

function handleFavoritesKeydown(e) {
  const target = e.target;
  if (
    e.key === "Enter" &&
    target.tagName === "INPUT" &&
    target.id.startsWith("newValue_")
  ) {
    e.preventDefault();
    e.stopPropagation();
    const id = target.id.replace("newValue_", "");
    if (id) handleUpdateFavorite(id);
  }
}

function handleFavoritesInput(e) {
  const target = e.target;
  if (target.tagName === "INPUT" && target.id.startsWith("newValue_")) {
    const id = target.id.replace("newValue_", "");
    const value = target.value;
    saveFavoriteInputValue(id, value);
  }
}

export function setupFavoritesEventListeners() {
  const favoritesContent = document.getElementById("favoritesContent");
  if (favoritesContent) {
    favoritesContent.addEventListener("click", handleFavoritesClick);
    favoritesContent.addEventListener("keydown", handleFavoritesKeydown);
    favoritesContent.addEventListener("input", handleFavoritesInput);
  }

  const exportBtn = document.getElementById("exportFavorites");
  const importBtn = document.getElementById("importFavorites");
  const importFile = document.getElementById("importFavoritesFile");

  if (exportBtn) {
    exportBtn.addEventListener("click", exportFavorites);
  }

  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        const text = await file.text();
        await importFavoritesFromText(text);
      }
      importFile.value = "";
    });
  }
}

// Export additional functions for unit tests
export { updateFavorite, deleteFavorite };
