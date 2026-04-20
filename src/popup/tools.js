import { detectAndShowPresets, getLastDetection } from "./engine-detect.js";
import { getActiveTab } from "./communication.js";

function isRpgMakerEngine() {
  const detection = getLastDetection();
  return Boolean(detection?.id && detection.id.startsWith("rpgmaker"));
}

function toggleGroupVisibility(groupId, visible) {
  const group = document.getElementById(groupId);
  if (group) group.classList.toggle("hidden", !visible);
}

function openEditorWindow(file, name, features) {
  return async () => {
    let tabId;
    try {
      const tab = await getActiveTab();
      tabId = tab?.id;
    } catch {
      /* ignore */
    }
    const url = chrome.runtime.getURL(
      `src/popup/${file}` + (tabId ? `?tabId=${tabId}` : ""),
    );
    window.open(url, name, features);
  };
}

const openSaveEditor = openEditorWindow(
  "save-editor.html",
  "saveEditor",
  "width=700,height=600",
);

const openRpgDataEditor = openEditorWindow(
  "rpgmaker-data-editor.html",
  "rpgDataEditor",
  "width=620,height=700",
);

export function setupToolsEventListeners() {
  const detectBtn = document.getElementById("detectEngine");
  if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
      detectBtn.disabled = true;
      detectBtn.textContent = "⏳ Erkenne...";
      try {
        await detectAndShowPresets("enginePresetsTools");
        updateSaveEditorVisibility();
        updateRpgDataEditorVisibility();
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

  const rpgDataEditorBtn = document.getElementById("openRpgDataEditor");
  if (rpgDataEditorBtn) {
    rpgDataEditorBtn.addEventListener("click", openRpgDataEditor);
  }

  // If engine was already detected (e.g. in search tab), show results immediately
  const alreadyDetected = getLastDetection();
  if (alreadyDetected) {
    detectAndShowPresets("enginePresetsTools");
    updateSaveEditorVisibility();
    updateRpgDataEditorVisibility();
  }
}

/**
 * Show/hide the Save-Editor button based on detected engine.
 * Only RPG Maker engines have localStorage-based save files.
 */
export function updateSaveEditorVisibility() {
  toggleGroupVisibility("saveEditorGroup", isRpgMakerEngine());
}

/**
 * Show/hide the RPG Data Editor button based on detected engine.
 * Also toggles the body class that controls whether the inline Editor
 * tab is available in wide sidebar layouts (via CSS container query).
 */
export function updateRpgDataEditorVisibility() {
  const isRpg = isRpgMakerEngine();
  toggleGroupVisibility("rpgDataEditorGroup", isRpg);
  document.body.classList.toggle("engine-rpgmaker", isRpg);
}
