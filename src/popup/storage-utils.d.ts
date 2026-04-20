export function loadFromStorage<
  T extends Record<string, unknown> = Record<string, unknown>,
>(key: string): T;

export interface SaveToStorageResult {
  success: boolean;
  error?: string;
  message?: string;
}

export function saveToStorage(
  key: string,
  obj: unknown,
): SaveToStorageResult;
