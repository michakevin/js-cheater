import { loadFromStorage, saveToStorage } from "./storage-utils.js";

let domainKeyPromise;
export async function getDomainKey() {
  if (!domainKeyPromise) {
    domainKeyPromise = chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const url = tabs[0]?.url || "";
        return "cheat_favorites_" + new URL(url).origin;
      })
      .catch(() => "cheat_favorites_unknown");
  }
  return domainKeyPromise;
}

export async function getFavoritesKey() {
  return getDomainKey();
}

export async function getInputsKey() {
  const key = await getDomainKey();
  return key + "_inputs";
}

export async function getFavorites() {
  const key = await getFavoritesKey();
  return loadFromStorage(key);
}

export async function saveFavorites(favorites) {
  const key = await getFavoritesKey();
  saveToStorage(key, favorites);
}

export async function getInputs() {
  const key = await getInputsKey();
  return loadFromStorage(key);
}

export async function saveInputs(inputs) {
  const key = await getInputsKey();
  saveToStorage(key, inputs);
}

export async function saveFavoriteInputValue(id, value) {
  try {
    const inputs = await getInputs();
    inputs[id] = value;
    await saveInputs(inputs);
  } catch (e) {
    console.error("Failed to save favorite input value:", e);
  }
}

export async function clearFavoriteInputValue(id) {
  try {
    const inputs = await getInputs();
    delete inputs[id];
    await saveInputs(inputs);
  } catch (e) {
    console.error("Failed to clear favorite input value:", e);
  }
}
