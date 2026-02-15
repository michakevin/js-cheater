import { loadFromStorage, saveToStorage } from "./storage-utils.js";
import { getActiveTab } from "./communication.js";

const FAVORITES_KEY_PREFIX = "cheat_favorites_";
const UNKNOWN_DOMAIN = "unknown";

function getOriginFromUrl(url) {
  if (!url) return UNKNOWN_DOMAIN;
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.origin || parsedUrl.origin === "null") {
      return UNKNOWN_DOMAIN;
    }
    return parsedUrl.origin;
  } catch {
    return UNKNOWN_DOMAIN;
  }
}

export async function getDomainKey() {
  try {
    const tab = await getActiveTab();
    return FAVORITES_KEY_PREFIX + getOriginFromUrl(tab?.url);
  } catch {
    return FAVORITES_KEY_PREFIX + UNKNOWN_DOMAIN;
  }
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
