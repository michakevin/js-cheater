import type { ScannerEngineDetection } from "../scanner-core.js";

export function detectEngine(): Promise<ScannerEngineDetection | null>;

export function getLastRawResult(): unknown;

export function getLastDetection(): ScannerEngineDetection | null;

export function detectAndShowPresets(containerId?: string): Promise<void>;
