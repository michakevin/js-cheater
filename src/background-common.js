// Shared background bootstrap logic for MV3 service worker and MV2 background scripts.
function enableSidePanelOnClick(chromeApi) {
  if (chromeApi?.sidePanel?.setPanelBehavior) {
    chromeApi.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) =>
        console.error("[js-cheater] Side panel setup error:", error),
      );
  }
}

async function openPanel(chromeApi, tabId) {
  if (chromeApi?.sidePanel?.open) {
    return chromeApi.sidePanel.open({ tabId });
  }
  if (chromeApi?.sidebarAction?.open) {
    return chromeApi.sidebarAction.open();
  }
}

function registerActionHandler(chromeApi, actionApi, debugEnabled) {
  if (!actionApi?.onClicked?.addListener) return;
  actionApi.onClicked.addListener(async (tab) => {
    if (!tab?.id) return;
    try {
      await openPanel(chromeApi, tab.id);
      if (debugEnabled) {
        console.log("[js-cheater] Side panel opened successfully");
      }
    } catch (error) {
      console.error("[js-cheater] Failed to open side panel:", error);
    }
  });
}

function registerMessageRouter(chromeApi) {
  chromeApi?.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
    if (msg.type === "ping") sendResponse("pong");
    return false;
  });
}

function registerInstallHandler(chromeApi, debugEnabled) {
  chromeApi?.runtime?.onInstalled?.addListener(({ reason, previousVersion }) => {
    if (reason === "install") {
      if (debugEnabled) console.log("[js-cheater] Extension installed 🚀");
    } else if (reason === "update") {
      if (debugEnabled) {
        console.log(`[js-cheater] Updated from ${previousVersion}`);
      }
    }
    enableSidePanelOnClick(chromeApi);
  });
}

function initBackgroundRuntime({
  debugEnabled = false,
  chromeApi = globalThis.chrome,
  actionApi = chromeApi?.action ?? chromeApi?.browserAction,
} = {}) {
  if (!chromeApi) return;
  registerInstallHandler(chromeApi, debugEnabled);
  enableSidePanelOnClick(chromeApi);
  registerActionHandler(chromeApi, actionApi, debugEnabled);
  registerMessageRouter(chromeApi);
}

globalThis.__jsCheaterInitBackground = initBackgroundRuntime;
