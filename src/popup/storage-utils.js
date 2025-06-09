export function loadFromStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : {};
  } catch {
    return {};
  }
}

export function saveToStorage(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    console.error('Failed to save to storage');
  }
}
