export const $ = (sel) => document.querySelector(sel);

export function tryParse(v) {
  if (!v || v.trim() === "") return "";
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function escapeHtml(str = "") {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

export function safeStringify(value) {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable]";
    }
  }
}
