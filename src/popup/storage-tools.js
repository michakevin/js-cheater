// Storage tools for managing localStorage export/import
import { send, queryTabs } from "./communication.js";
import { showSuccess } from "./messages.js";
import { showDialog } from "./dialog.js";

export async function exportLocalStorage() {
  const data = await send("getLocalStorage");
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const [tab] = await queryTabs({ active: true, currentWindow: true });
  let domain = "unknown";
  try {
    if (tab?.url) domain = new URL(tab.url).origin;
  } catch {
    // Invalid or special URL – fall back to "unknown"
  }
  const fileName = `js-cheater-localStorage-${domain.replace(/[^a-z0-9]+/gi, "_")}.json`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showSuccess("Lokaler Speicher exportiert!");
}

export async function importLocalStorageFromText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("Import failed", e);
    await showDialog({
      type: "alert",
      title: "Import fehlgeschlagen",
      message: e.message,
    });
    return;
  }

  // The export is a full snapshot, so import restores that exact state: confirm
  // first because existing entries not contained in the file are removed.
  const confirmed = await showDialog({
    type: "confirm",
    title: "Lokalen Speicher importieren",
    message:
      "Der aktuelle lokale Speicher dieser Seite wird durch den Import ersetzt. " +
      "Vorhandene Einträge, die nicht in der Datei enthalten sind, werden entfernt. Fortfahren?",
  });
  if (!confirmed) return;

  try {
    await send("setLocalStorage", { data, replace: true });
    showSuccess("Lokaler Speicher importiert!");
  } catch (e) {
    console.error("Import failed", e);
    await showDialog({
      type: "alert",
      title: "Import fehlgeschlagen",
      message: e.message,
    });
  }
}

export function setupStorageToolsEventListeners() {
  const exportBtn = document.getElementById("exportLocalStorage");
  const importBtn = document.getElementById("importLocalStorage");
  const importFile = document.getElementById("importLocalStorageFile");

  if (exportBtn) {
    exportBtn.addEventListener("click", exportLocalStorage);
  }

  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        const text = await file.text();
        await importLocalStorageFromText(text);
      }
      importFile.value = "";
    });
  }
}
