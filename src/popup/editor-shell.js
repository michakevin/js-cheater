/**
 * Shared helpers for the standalone editor windows
 * (save-editor, rpgmaker-data-editor). Both pages receive the target
 * tab id through a `tabId` URL query parameter and communicate with
 * the content script via `sendTabMessage`.
 */
import { sendTabMessage } from "./communication.js";

/**
 * Read a numeric `tabId` from the current URL's query string.
 * Returns `null` if not present or invalid.
 * @returns {number|null}
 */
export function readTabIdFromLocation() {
  try {
    const params = new URLSearchParams(location.search);
    const raw = params.get("tabId");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Create a `send(cmd, extra)` helper bound to the given tabId getter.
 * Rejects if no tab is available.
 * @param {() => number|null} getTabId
 * @param {string} [missingTabMessage]
 */
export function createTabSender(
  getTabId,
  missingTabMessage = "Kein aktiver Tab gefunden",
) {
  return async function send(cmd, extra = {}) {
    const tabId = getTabId();
    if (!tabId) throw new Error(missingTabMessage);
    return sendTabMessage(tabId, { cmd, ...extra });
  };
}
