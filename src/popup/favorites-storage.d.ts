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

export function getDomainFromKey(key: string): string;

export function buildFavoritesKey(domain: string): string;

export function listStoredFavoriteDomains(): string[];

export function getFavoritesKey(domain?: string): Promise<string>;

export function getInputsKey(domain?: string): Promise<string>;

export function getFavorites(domain?: string): Promise<FavoritesMap>;

export function saveFavorites(
  favorites: FavoritesMap,
  domain?: string,
): Promise<void>;

export function getInputs(domain?: string): Promise<FavoriteInputsMap>;

export function saveInputs(
  inputs: FavoriteInputsMap,
  domain?: string,
): Promise<void>;

export function saveFavoriteInputValue(
  id: string,
  value: string,
  domain?: string,
): Promise<void>;

export function clearFavoriteInputValue(
  id: string,
  domain?: string,
): Promise<void>;
