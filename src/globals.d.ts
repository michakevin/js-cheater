import type { ScannerRuntime } from "./scanner-core.js";

export interface InitBackgroundOptions {
  debugEnabled?: boolean;
  chromeApi?: typeof chrome;
  actionApi?: typeof chrome.action | typeof chrome.browserAction;
}

declare global {
  interface Window {
    __cheatScanner__?: ScannerRuntime;
    __jsCheaterContentInitialized__?: boolean;
    __jsCheaterDebug__?: boolean;
  }

  var __jsCheaterInitBackground: ((options?: InitBackgroundOptions) => void) | undefined;
}
