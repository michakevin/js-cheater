import { $ } from "./utils.js";
import { queryTabs, sendTabMessage, setActiveTab } from "./communication.js";
import { showDialog } from "./dialog.js";
import { SCANNER_CODE } from "./scanner-code.js";

function fallbackCopyText(text) {
  if (typeof document.execCommand !== "function") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy") === true;
  } catch (error) {
    console.error("Fallback copy failed:", error);
    return false;
  } finally {
    textarea.remove();
  }
}

async function copyScannerCode(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  return fallbackCopyText(text);
}

export function shouldInjectScannerDirectly() {
  return !chrome.scripting?.executeScript && !!chrome.tabs?.executeScript;
}

export function configureSetupMode({ directScannerInjection }) {
  if (!directScannerInjection) {
    return;
  }

  const setupDescription = document.querySelector(".setup-description");
  if (setupDescription) {
    setupDescription.textContent =
      "Firefox kann den Scanner direkt laden. Die Konsole wird nur als Fallback benötigt.";
  }

  const injectBtn = $("#inject");
  if (injectBtn) {
    injectBtn.textContent = "⚡ Scanner direkt laden";
  }
}

function showInjectFeedback(injectBtn, label) {
  if (!injectBtn) return;

  const originalText = injectBtn.textContent;
  injectBtn.textContent = label;
  injectBtn.classList.add("copied");
  setTimeout(() => {
    injectBtn.textContent = originalText;
    injectBtn.classList.remove("copied");
  }, 2000);
}

async function executeTabsScript(tabId, details) {
  if (!chrome.tabs?.executeScript) {
    throw new Error("tabs.executeScript ist nicht verfügbar");
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error = null) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    try {
      const maybePromise = chrome.tabs.executeScript(tabId, details, () =>
        settle(chrome.runtime?.lastError ?? null),
      );
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(() => settle()).catch((error) => settle(error));
      }
    } catch (error) {
      settle(error);
    }
  });
}

async function injectContentScript(tabId) {
  if (chrome.scripting?.executeScript) {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["src/content.js"],
    });
    return;
  }

  await executeTabsScript(tabId, {
    file: "/src/content.js",
    allFrames: true,
    matchAboutBlank: true,
  });
}

async function isContentScriptReady(tabId) {
  try {
    const result = await sendTabMessage(tabId, { cmd: "ping" });
    return result === "pong";
  } catch {
    return false;
  }
}

async function injectScannerIntoTab(tabId) {
  const injector = `(function(){
    var s = document.createElement('script');
    s.textContent = ${JSON.stringify(SCANNER_CODE)};
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  })();`;

  await executeTabsScript(tabId, {
    code: injector,
    allFrames: false,
    matchAboutBlank: true,
  });
}

export function createInjectHandler({ directScannerInjection, startPolling }) {
  return async function onInject() {
    const injectBtn = $("#inject");
    let scannerReady = false;
    let contentScriptReady = false;
    let showManualInstructions = !directScannerInjection;
    let timeoutMessage = "Scanner nicht gefunden – Code korrekt eingefügt?";

    try {
      const [currTab] = await queryTabs({
        active: true,
        currentWindow: true,
      });

      if (currTab) {
        setActiveTab(currTab.id);
        contentScriptReady = await isContentScriptReady(currTab.id);
        if (!contentScriptReady) {
          await injectContentScript(currTab.id);
          contentScriptReady = true;
        }

        if (directScannerInjection) {
          try {
            await injectScannerIntoTab(currTab.id);
            scannerReady = true;
            showInjectFeedback(injectBtn, "✅ Direkt geladen!");
            showManualInstructions = false;
            timeoutMessage =
              "Scanner nicht gefunden – Seite neu laden und erneut versuchen.";
          } catch (directError) {
            console.error("Direct scanner injection failed", directError);
            const copied = await copyScannerCode(SCANNER_CODE);
            scannerReady = copied;
            showManualInstructions = copied;

            if (!copied) {
              await showDialog({
                type: "alert",
                title: "Direktladen fehlgeschlagen",
                message:
                  "Scanner konnte nicht direkt geladen oder kopiert werden. Bitte Seite neu laden und erneut versuchen.",
              });
            } else {
              showInjectFeedback(injectBtn, "✅ Kopiert!");
              await showDialog({
                type: "alert",
                title: "Direktladen fehlgeschlagen",
                message:
                  "Der Scanner-Code wurde kopiert. Bitte in der Konsole einfügen und mit Enter ausführen.",
              });
            }
          }
        } else {
          scannerReady = await copyScannerCode(SCANNER_CODE);
          if (!scannerReady) {
            await showDialog({
              type: "alert",
              title: "Kopieren fehlgeschlagen",
              message: "Bitte manuell kopieren.",
            });
          } else {
            showInjectFeedback(injectBtn, "✅ Kopiert!");
          }
        }
      } else {
        contentScriptReady = false;
      }
    } catch (error) {
      contentScriptReady = false;
      console.error("Content-script injection failed", error);
    }

    if (scannerReady && contentScriptReady) {
      startPolling({
        showInstructions: showManualInstructions,
        timeoutMessage,
      });
    } else if (scannerReady && !contentScriptReady) {
      await showDialog({
        type: "alert",
        title: "Fehler",
        message:
          "Content Script konnte nicht geladen werden. Seite neu laden und erneut versuchen.",
      });
    }
  };
}
