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

export function getDomainFromKey(key) {
  if (typeof key !== "string" || !key.startsWith(FAVORITES_KEY_PREFIX)) {
    return UNKNOWN_DOMAIN;
  }
  const domain = key.slice(FAVORITES_KEY_PREFIX.length);
  if (!domain || domain.endsWith("_inputs")) {
    return UNKNOWN_DOMAIN;
  }
  return domain;
}

export function buildFavoritesKey(domain) {
  const normalizedDomain =
    typeof domain === "string" && domain.trim() ? domain.trim() : UNKNOWN_DOMAIN;
  return FAVORITES_KEY_PREFIX + normalizedDomain;
}

export function listStoredFavoriteDomains() {
  const domains = new Set();
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(FAVORITES_KEY_PREFIX) || key.endsWith("_inputs")) {
      continue;
    }
    domains.add(getDomainFromKey(key));
  }
  return [...domains];
}

async function resolveDomain(domain) {
  if (typeof domain === "string" && domain.trim()) {
    return domain.trim();
  }
  return getDomainFromKey(await getDomainKey());
}

export async function getFavoritesKey(domain) {
  return buildFavoritesKey(await resolveDomain(domain));
}

export async function getInputsKey(domain) {
  const key = await getFavoritesKey(domain);
  return `${key}_inputs`;
}

export async function getFavorites(domain) {
  const key = await getFavoritesKey(domain);
  return loadFromStorage(key);
}

export async function saveFavorites(favorites, domain) {
  const key = await getFavoritesKey(domain);
  return saveToStorage(key, favorites);
}

export async function getInputs(domain) {
  const key = await getInputsKey(domain);
  return loadFromStorage(key);
}

export async function saveInputs(inputs, domain) {
  const key = await getInputsKey(domain);
  return saveToStorage(key, inputs);
}

export async function saveFavoriteInputValue(id, value, domain) {
  try {
    const inputs = await getInputs(domain);
    inputs[id] = value;
    await saveInputs(inputs, domain);
  } catch (e) {
    console.error("Failed to save favorite input value:", e);
  }
}

export async function clearFavoriteInputValue(id, domain) {
  try {
    const inputs = await getInputs(domain);
    delete inputs[id];
    await saveInputs(inputs, domain);
  } catch (e) {
    console.error("Failed to clear favorite input value:", e);
  }
}
