import { $ } from "./utils.js";
import { showError } from "./messages.js";
import { DEBUG } from "../debug.js";

let activeTabId;
let activeTabUrl = null;

function isConnectionErrorMessage(message) {
  return (
    message.includes("Could not establish connection") ||
    message.includes("Receiving end does not exist")
  );
}

export function setActiveTab(tabOrId, tabUrl = null) {
  if (typeof tabOrId === "object" && tabOrId !== null) {
    rememberActiveTab(tabOrId);
    return;
  }

  activeTabId = tabOrId;
  if (typeof tabUrl === "string" && tabUrl) {
    activeTabUrl = tabUrl;
  }
}

function rememberActiveTab(tab) {
  if (tab && tab.id !== undefined && tab.id !== null) {
    activeTabId = tab.id;
    if (typeof tab.url === "string" && tab.url) {
      activeTabUrl = tab.url;
    }
  }
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
        maybePromise
          .then((tabs) => settle(null, tabs))
          .catch((error) => settle(error));
      }
    } catch (error) {
      settle(error);
    }
  });
}

export async function getActiveTab() {
  let queryError;
  try {
    const [tab] = await queryTabs({
      active: true,
      currentWindow: true,
    });
    if (tab) {
      rememberActiveTab(tab);
      return tab;
    }
  } catch (error) {
    queryError = error;
  }

  if (activeTabId !== undefined && activeTabId !== null) {
    return { id: activeTabId, url: activeTabUrl };
  }

  if (queryError) {
    throw queryError;
  }
  throw new Error("Kein aktiver Tab gefunden");
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
  const { suppressConnectionError = false, suppressTimeoutError = false } =
    options;

  try {
    const tab = await getActiveTab();
    const tabId = tab?.id;
    if (tabId === undefined || tabId === null) {
      throw new Error("Kein aktiver Tab gefunden");
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
    const result = await send(
      "test",
      {},
      {
        suppressConnectionError: true,
        suppressTimeoutError: true,
      },
    );
    if (result && result.scannerLoaded) {
      return true;
    }
  } catch {
    // Scanner nicht verfügbar
  }
  return false;
}
