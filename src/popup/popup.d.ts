import type { StartPollingOptions } from "./popup-injection.js";

export type PopupHandler = (() => void | Promise<void>) | undefined;

export let onInject: PopupHandler;

export let onStart: PopupHandler;

export let onRefine: PopupHandler;

export let onNewSearch: PopupHandler;

export let startConnectionMonitor: () => void;

export function stopConnectionMonitor(): void;

export function startPolling(options?: StartPollingOptions): void;
