import type { FavoriteEntry } from "./favorites-storage.js";

export { getDomainKey } from "./favorites-storage.js";

export function exportFavorites(): Promise<void>;

export function importFavoritesFromText(text: string): Promise<void>;

export function renameFavorite(id: string, newName: string): Promise<boolean>;

export function saveFavorite(path: string, value: unknown): Promise<void>;

export function loadFavorites(): Promise<void>;

export function setupFavoritesEventListeners(): void;

export function updateFavorite(
  id: string,
  newValue: string | number | boolean,
): Promise<void>;

export function deleteFavorite(id: string): Promise<void>;

export type { FavoriteEntry };
