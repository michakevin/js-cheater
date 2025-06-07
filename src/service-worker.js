// src/service-worker.js
// js-cheater – Background Service-Worker (Manifest V3)

// Sets the side panel to open automatically when clicking the action icon.
// Firefox does not support this API, so we guard it.
function enableSidePanelOnClick() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) =>
        console.error("[js-cheater] Side panel setup error:", error)
      );
  }
}

// Opens the extension UI in Chrome's side panel or Firefox's sidebar
async function openPanel(tabId) {
  if (chrome.sidePanel?.open) {
    return chrome.sidePanel.open({ tabId });
  }
  if (chrome.sidebarAction?.open) {
    return chrome.sidebarAction.open();
  }
}

// Called when the extension is first installed or updated
chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  if (reason === "install") {
    console.log("[js-cheater] Extension installed 🚀");
  } else if (reason === "update") {
    console.log(`[js-cheater] Updated from ${previousVersion}`);
  }
  enableSidePanelOnClick();
});

// Ensure side panel behavior is set when the service worker starts (e.g. reload)
enableSidePanelOnClick();

// Action icon click handler - requests permission and injects script
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await openPanel(tab.id);
    console.log("[js-cheater] Side panel opened successfully");
  } catch (error) {
    console.error("[js-cheater] Failed to open side panel:", error);
  }
});

// Message router (optional; currently just a placeholder)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Here you can later provide central functions,
  // e.g., saving hits in chrome.storage or triggering global hotkeys.
  if (msg.type === "ping") sendResponse("pong");
  // Important: return true if the response is sent asynchronously
  return false;
});
