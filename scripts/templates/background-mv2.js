/* global chrome */

const DEBUG = __DEBUG_VALUE__;

function enableSidePanelOnClick() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) =>
        console.error("[js-cheater] Side panel setup error:", error)
      );
  }
}

async function openPanel(tabId) {
  if (chrome.sidePanel?.open) {
    return chrome.sidePanel.open({ tabId });
  }
  if (chrome.sidebarAction?.open) {
    return chrome.sidebarAction.open();
  }
}

const actionApi = chrome.action ?? chrome.browserAction;

chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  if (reason === "install") {
    if (DEBUG) console.log("[js-cheater] Extension installed 🚀");
  } else if (reason === "update") {
    if (DEBUG) console.log(`[js-cheater] Updated from ${previousVersion}`);
  }
  enableSidePanelOnClick();
});

enableSidePanelOnClick();

if (actionApi?.onClicked) {
  actionApi.onClicked.addListener(async (tab) => {
    const tabId = tab?.id;
    if (!tabId && !chrome.sidebarAction?.open) return;
    try {
      await openPanel(tabId);
      if (DEBUG) console.log("[js-cheater] Side panel opened successfully");
    } catch (error) {
      console.error("[js-cheater] Failed to open side panel:", error);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ping") sendResponse("pong");
  return false;
});
