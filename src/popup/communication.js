import { $ } from "./utils.js";
import { showError } from "./messages.js";
import { DEBUG } from "../debug.js";

let activeTabId;

function isConnectionErrorMessage(message) {
  return (
    message.includes("Could not establish connection") ||
    message.includes("Receiving end does not exist")
  );
}

export function setActiveTab(tabId) {
  activeTabId = tabId;
}

export async function queryTabs(queryInfo) {
  if (!chrome?.tabs?.query) {
    return [];
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error, tabs = []) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve(Array.isArray(tabs) ? tabs : []);
      }
    };

    const callback = (tabs) => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError) {
        settle(new Error(runtimeError.message || String(runtimeError)));
        return;
      }
      settle(null, tabs);
    };

    try {
      const maybePromise = chrome.tabs.query(queryInfo, callback);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then((tabs) => settle(null, tabs)).catch((error) => settle(error));
      }
    } catch (error) {
      settle(error);
    }
  });
}

export async function sendTabMessage(tabId, message) {
  if (!chrome?.tabs?.sendMessage) {
    throw new Error("tabs.sendMessage ist nicht verfügbar");
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error, response) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    };

    const callback = (response) => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError) {
        settle(new Error(runtimeError.message || String(runtimeError)));
        return;
      }
      settle(null, response);
    };

    try {
      const maybePromise = chrome.tabs.sendMessage(tabId, message, callback);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((response) => settle(null, response))
          .catch((error) => settle(error));
      }
    } catch (error) {
      settle(error);
    }
  });
}

export async function send(cmd, extra = {}, options = {}) {
  const {
    suppressConnectionError = false,
    suppressTimeoutError = false,
  } = options;

  try {
    let tabId = activeTabId;
    if (!tabId) {
      const [tab] = await queryTabs({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        throw new Error("Kein aktiver Tab gefunden");
      }
      tabId = tab.id;
    }
    if (DEBUG) console.log("Sending message:", { cmd, ...extra });
    const response = await sendTabMessage(tabId, { cmd, ...extra });
    if (DEBUG) console.log("Received response:", response);
    if (response && response.timeout) {
      if (!suppressTimeoutError) {
        showError("❌ Anfrage an Content Script dauerte zu lange.");
      }
      return null;
    }
    return response;
  } catch (error) {
    const message = error?.message || String(error);
    const isConnectionError = isConnectionErrorMessage(message);
    const suppressError = suppressConnectionError && isConnectionError;

    if (!suppressError) {
      console.error("Kommunikationsfehler:", error);
    }

    const scannerUI = $("#scannerUI");
    if (!suppressError && scannerUI && scannerUI.style.display !== "none") {
      if (isConnectionError) {
        showError("❌ Content Script nicht verfügbar. Seite neu laden!");
      } else {
        showError("❌ Fehler: " + message);
      }
    }
    return null;
  }
}

export async function checkScannerStatus() {
  try {
    const result = await send("test", {}, {
      suppressConnectionError: true,
      suppressTimeoutError: true,
    });
    if (result && result.scannerLoaded) {
      return true;
    }
  } catch {
    // Scanner nicht verfügbar
  }
  return false;
}
