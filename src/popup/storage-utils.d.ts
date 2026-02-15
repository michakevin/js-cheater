export function loadFromStorage<
  T extends Record<string, unknown> = Record<string, unknown>,
>(key: string): T;

export function saveToStorage(key: string, obj: unknown): void;
