import { $ } from "./utils.js";
import { showError } from "./messages.js";

let activeTabId;

export function setActiveTab(tabId) {
  activeTabId = tabId;
}

export async function send(cmd, extra = {}) {
  try {
    let tabId = activeTabId;
    if (!tabId) {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (!tab) {
        throw new Error("Kein aktiver Tab gefunden");
      }
      tabId = tab.id;
    }
    console.log("Sending message:", { cmd, ...extra });
    const response = await chrome.tabs.sendMessage(tabId, { cmd, ...extra });
    console.log("Received response:", response);
    if (response && response.timeout) {
      showError("❌ Anfrage an Content Script dauerte zu lange.");
      return null;
    }
    return response;
  } catch (error) {
    console.error("Kommunikationsfehler:", error);
    if ($("#scannerUI").style.display !== "none") {
      if (error.message.includes("Could not establish connection")) {
        showError("❌ Content Script nicht verfügbar. Seite neu laden!");
      } else {
        showError("❌ Fehler: " + error.message);
      }
    }
    return null;
  }
}

export async function checkScannerStatus() {
  try {
    const result = await send("test");
    if (result && result.scannerLoaded) {
      return true;
    }
  } catch (e) {
    // Scanner nicht verfügbar
  }
  return false;
}
