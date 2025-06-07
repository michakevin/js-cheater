// Storage tools for managing localStorage export/import
import { send } from "./communication.js";
import { showSuccess } from "./messages.js";

export async function exportLocalStorage() {
  const data = await send("getLocalStorage");
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = tab ? new URL(tab.url).origin : "unknown";
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
  try {
    const data = JSON.parse(text);
    await send("setLocalStorage", { data });
    showSuccess("Lokaler Speicher importiert!");
  } catch (e) {
    console.error("Import failed", e);
    alert("Import fehlgeschlagen: " + e.message);
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
