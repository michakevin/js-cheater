export function loadFromStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : {};
  } catch (e) {
    return {};
  }
}

export function saveToStorage(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
}
