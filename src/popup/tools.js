import { detectAndShowPresets, getLastDetection } from "./engine-detect.js";
import { getActiveTab } from "./communication.js";

export function setupToolsEventListeners() {
  const detectBtn = document.getElementById("detectEngine");
  if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
      detectBtn.disabled = true;
      detectBtn.textContent = "⏳ Erkenne...";
      try {
        await detectAndShowPresets("enginePresetsTools");
        updateSaveEditorVisibility();
      } finally {
        detectBtn.disabled = false;
        detectBtn.textContent = "🔍 Engine erkennen";
      }
    });
  }

  const saveEditorBtn = document.getElementById("openSaveEditor");
  if (saveEditorBtn) {
    saveEditorBtn.addEventListener("click", openSaveEditor);
  }

  // If engine was already detected (e.g. in search tab), show results immediately
  const alreadyDetected = getLastDetection();
  if (alreadyDetected) {
    detectAndShowPresets("enginePresetsTools");
    updateSaveEditorVisibility();
  }
}

/**
 * Show/hide the Save-Editor button based on detected engine.
 * Only RPG Maker engines have localStorage-based save files.
 */
export function updateSaveEditorVisibility() {
  const group = document.getElementById("saveEditorGroup");
  if (!group) return;

  const detection = getLastDetection();
  const isRpgMaker =
    detection?.id &&
    (detection.id.startsWith("rpgmaker") ||
      detection.id.includes("rpg-maker") ||
      detection.id.includes("rpgmaker"));

  group.classList.toggle("hidden", !isRpgMaker);
}

/**
 * Open the Save-Game-Editor in a new popup window.
 */
async function openSaveEditor() {
  let tabId;
  try {
    const tab = await getActiveTab();
    tabId = tab?.id;
  } catch {
    /* ignore */
  }

  const editorUrl = chrome.runtime.getURL(
    "src/popup/save-editor.html" + (tabId ? "?tabId=" + tabId : ""),
  );

  window.open(editorUrl, "saveEditor", "width=700,height=600");
}
