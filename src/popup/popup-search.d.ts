export type PopupSearchType = "value" | "name" | "nameAndValue";

export interface SetupSearchTypeUIOptions {
  searchTypeSelect: HTMLSelectElement;
  nameInputGroup: HTMLElement;
  valueInput: HTMLInputElement;
}

export interface CreateSearchHandlersOptions {
  searchTypeSelect: HTMLSelectElement;
  valueInput: HTMLInputElement;
  nameInput: HTMLInputElement;
}

export interface SearchHandlers {
  onStart: () => Promise<void>;
  onRefine: () => Promise<void>;
  onNewSearch: () => Promise<void>;
  handleEnterKey: (event: KeyboardEvent) => void;
}

export function setupSearchTypeUI(options: SetupSearchTypeUIOptions): void;

export function createSearchHandlers(
  options: CreateSearchHandlersOptions,
): SearchHandlers;
