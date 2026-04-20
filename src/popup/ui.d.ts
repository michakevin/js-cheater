export interface HitListEntry {
  path: string;
  value: unknown;
}

export function initTabs(): void;

export function showSetupMode(): void;

export function showScannerMode(): void;

export function showInitialScanState(): void;

export function showRefineScanState(): void;

export function showLoading(message?: string): void;

export function setScanButtonsDisabled(disabled: boolean): void;

export function updateList(): Promise<void>;

export function renderHitsWithSaveButtons(
  list: ReadonlyArray<HitListEntry> | null | undefined,
): void;
