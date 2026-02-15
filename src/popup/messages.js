import { $ } from "./utils.js";

let statusTimeout = null;

/**
 * Show an error/warning message in the status bar (does NOT overwrite hits).
 */
export function showError(message) {
  showStatus(message, "error");
}

/**
 * Show a success message in the status bar.
 */
export function showSuccess(message) {
  showStatus(message, "success");
}

/**
 * Show an informational status message (e.g. scan in progress).
 */
export function showInfo(message) {
  showStatus(message, "info", false);
}

/**
 * Clear the status bar.
 */
export function clearStatus() {
  const bar = $("#statusBar");
  if (!bar) return;
  bar.classList.add("hidden");
  bar.classList.remove("status-success", "status-error", "status-info");
  bar.textContent = "";
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }
}

/**
 * Internal helper – render a status message into #statusBar.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 * @param {boolean} autoHide – auto-hide after 5s (default true)
 */
function showStatus(message, type, autoHide = true) {
  const bar = $("#statusBar");
  if (!bar) return;

  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  bar.classList.remove(
    "hidden",
    "status-success",
    "status-error",
    "status-info",
  );
  bar.classList.add(`status-${type}`);
  bar.textContent = message;

  if (autoHide) {
    statusTimeout = setTimeout(() => clearStatus(), 5000);
  }
}
