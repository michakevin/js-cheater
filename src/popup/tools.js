import { detectAndShowPresets } from "./engine-detect.js";

export function setupToolsEventListeners() {
  const detectBtn = document.getElementById("detectEngine");
  if (detectBtn) {
    detectBtn.addEventListener("click", async () => {
      detectBtn.disabled = true;
      detectBtn.textContent = "⏳ Erkenne...";
      try {
        await detectAndShowPresets("enginePresetsTools");
      } finally {
        detectBtn.disabled = false;
        detectBtn.textContent = "🔍 Engine erkennen";
      }
    });
  }
}
