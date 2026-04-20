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
    return { success: true };
  } catch (error) {
    console.error(`Failed to save to storage (key=${key}):`, error);
    return {
      success: false,
      error: error?.name || "UnknownError",
      message: error?.message || String(error),
    };
  }
}
