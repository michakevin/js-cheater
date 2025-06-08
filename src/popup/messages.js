import { $, escapeHtml } from "./utils.js";
import { DEBUG } from "../debug.js";

export function showError(message) {
  const hitsUl = $("#hits");
  hitsUl.innerHTML = `<li style='color: #e74c3c;'>${escapeHtml(message)}</li>`;
}

export function showSuccess(message) {
  const hitsUl = $("#hits");
  const activeTab = document.querySelector(".tab-panel.active");
  if (activeTab && activeTab.id === "searchTab") {
    hitsUl.innerHTML = `<li style='color: #27ae60;'>${escapeHtml(message)}</li>`;
  } else {
    if (DEBUG) console.log("✅", message);
  }
}
