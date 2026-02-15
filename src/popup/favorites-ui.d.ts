import type {
  FavoriteInputsMap,
  FavoritesMap,
} from "./favorites-storage.js";

export interface FavoritesUiEventHandlers {
  getFavorites: () => Promise<FavoritesMap>;
  updateFavorite: (
    id: string,
    newValue: string | number | boolean,
  ) => void | Promise<void>;
  deleteFavorite: (id: string) => void | Promise<void>;
  renameFavorite: (
    id: string,
    newName: string,
  ) => boolean | void | Promise<boolean | void>;
  saveFavoriteInputValue: (id: string, value: string) => void | Promise<void>;
  exportFavorites: () => void | Promise<void>;
  importFavoritesFromText: (text: string) => void | Promise<void>;
}

export function renderFavorites(
  favorites: FavoritesMap,
  inputs: FavoriteInputsMap,
): void;

export function setupFavoritesEventListeners(
  handlers: FavoritesUiEventHandlers,
): void;
