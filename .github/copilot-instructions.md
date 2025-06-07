# GitHub Copilot – Projektleitplanken für *js-cheater*

## 1. Allgemeine Ziele
- **Einfachheit vor Perfektion**: schnelle Iterationen, aber sauberen Code liefern.
- **Manifest V3** strikt einhalten. Keine veralteten API-Vorschläge.
- **Kein externes Framework** im Popup (plain JS + kleines CSS).

## 2. Code-Stil
- ES2022 (Top-Level await nicht benötigt)
- 2-Space-Indent, Semicolons
- Funktionsnamen in camelCase, Konstanten in UPPER_SNAKE
- Kommentare auf Englisch

## 3. Dateien
| Pfad | Zweck |
|------|-------|
| `src/content.js`         | Scan-/Refine-Logik, Nachricht-Handler |
| `src/service-worker.js`  | Hintergrundlogik (optional)           |
| `src/popup/*`            | UI (HTML + JS)                        |
| `manifest.json`          | Nicht automatisch ändern, nur per Review! |

## 4. Typische Snippet-Prompts
```js
// Scan starten
chrome.runtime.sendMessage({ cmd: 'start', value: 123 });
```

## 5. Vermeide
- Framework-Imports (React, Vue, jQuery)
- `eval`, `Function`-Konstruktor
- Legacy `chrome.extension` API

## 6. Tests
Copilot darf einfache Jest-Snippets für reine Utility-Funktionen vorschlagen, aber keine E2E-Tests.

*(Letzte Aktualisierung: 2025-06-01)*
