// Zentraler Freeze-State des Popups.
//
// Das tatsächliche Einfrieren läuft als setInterval im Seitenkontext
// (scanner-core.js). Die Popup-UI baut ihre Buttons aber bei jedem Render neu
// auf. Ohne zentralen State ginge der „eingefroren"-Zustand bei jedem
// Re-Render (Tab-Wechsel, Fokus, visibilitychange) verloren und ein erneuter
// Klick würde ein zweites Freeze-Intervall starten. Dieses Set ist die Single
// Source of Truth, aus der Treffer- und Favoriten-Render ihren Button-Zustand
// ableiten.
const frozenPaths = new Set();

export function markFrozen(path) {
  frozenPaths.add(path);
}

export function markUnfrozen(path) {
  frozenPaths.delete(path);
}

export function isFrozen(path) {
  return frozenPaths.has(path);
}

export function clearFrozen() {
  frozenPaths.clear();
}
