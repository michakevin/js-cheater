export interface FavoriteEntry {
  id: string;
  name: string;
  path: string;
  value: unknown;
  savedAt: string;
}

export type FavoritesMap = Record<string, FavoriteEntry>;

export type FavoriteInputsMap = Record<string, string>;

export function getDomainKey(): Promise<string>;

export function getFavoritesKey(): Promise<string>;

export function getInputsKey(): Promise<string>;

export function getFavorites(): Promise<FavoritesMap>;

export function saveFavorites(favorites: FavoritesMap): Promise<void>;

export function getInputs(): Promise<FavoriteInputsMap>;

export function saveInputs(inputs: FavoriteInputsMap): Promise<void>;

export function saveFavoriteInputValue(id: string, value: string): Promise<void>;

export function clearFavoriteInputValue(id: string): Promise<void>;
