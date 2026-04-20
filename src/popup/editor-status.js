/**
 * Status banner helpers for standalone editor windows
 * (save-editor, rpgmaker-data-editor). These pages render a
 * `#statusMessage` element with `status-info/success/error` variants,
 * unlike the main popup which uses `#statusBar` via `messages.js`.
 */
import { $ } from "./utils.js";

export function showStatus(message, type = "info") {
  const el = $("#statusMessage");
  if (!el) return;
  el.textContent = message;
  el.className = `status-message status-${type}`;
  el.classList.remove("hidden");
  if (type === "success") {
    setTimeout(() => el.classList.add("hidden"), 3000);
  }
}

export function hideStatus() {
  const el = $("#statusMessage");
  if (el) el.classList.add("hidden");
}
