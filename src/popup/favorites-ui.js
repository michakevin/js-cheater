import { escapeHtml } from "./utils.js";
import { send } from "./communication.js";

export function renderFavorites(favorites, inputs) {
  const favoritesContent = document.getElementById("favoritesContent");
  if (!favoritesContent) return;

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
          <td class="favorite-name" data-id="${fav.id}" title="${escapeHtml(
            fav.path
          )}" style="max-width: 80px; overflow: hidden; text-overflow: ellipsis; cursor: pointer;">${escapeHtml(
            fav.name
          )}</td>
          <td style="font-weight: bold;">${escapeHtml(
            JSON.stringify(fav.value)
          )}</td>
          <td><input type="text" id="newValue_${fav.id}" placeholder="Neuer Wert..." value="${
            inputs[fav.id] || ""
          }" /></td>
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

export function setupFavoritesEventListeners({
  getFavorites,
  updateFavorite,
  deleteFavorite,
  renameFavorite,
  saveFavoriteInputValue,
  exportFavorites,
  importFavoritesFromText,
}) {
  const favoritesContent = document.getElementById("favoritesContent");

  async function handleUpdateFavorite(id) {
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
