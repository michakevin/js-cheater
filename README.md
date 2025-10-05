# js‑cheater 🎮

> **Cheat‑Engine‑Erlebnis direkt im Browser.**  
> Durchsuche JavaScript‑Variablen, verfeinere Treffer wie in Cheat‑Engine und manipuliere sie live – bequem im Side‑Panel von Chrome oder der Firefox‑Sidebar.

---

## Inhaltsverzeichnis

1. [Features](#features)
2. [Warum Copy-&-Paste?](#warum-copy--paste)
3. [Installation](#installation)
4. [Schnellstart](#schnellstart)
5. [Bedienungsanleitung](#bedienungsanleitung)
6. [Architektur](#architektur)
7. [Projektstruktur](#projektstruktur)
8. [Entwicklung](#entwicklung)
9. [Roadmap](#roadmap)
10. [Lizenz](#lizenz)

## Features

- 🔍 **Deep Object Scan** – Rekursive Suche nach Werten in `window` und tief verschachtelten Objekten
- 🔠 **Name-Scan** – Durchsucht Variablennamen statt Werte
- 🔬 **Refine-Modus** – Verkleinert Treffer wie in Cheat‑Engine
- ⚡ **Live-Editing** – Werte direkt ändern oder einfrieren
- ⭐ **Favoriten** – Relevante Variablen benennen und speichern
- 📤 **Export/Import** – Favoriten als Datei teilen
- 🛠 **Tools** – localStorage sichern und wiederherstellen
- 🎮 **Side Panel‑UI** – Bleibt offen während des Spiels
- ✅ **CSP‑Kompatibel** – Umgeht Content‑Security‑Policies über eine sichere Bridge

## Warum Copy-&-Paste?

Viele Spiele liefern strenge CSP‑Header. Daher wird der Scanner nicht automatisch injiziert, sondern einmalig manuell per Konsole eingefügt (Button „Scanner‑Code kopieren”).

## Installation

1. Repository klonen

   ```bash
   git clone https://github.com/<user>/js-cheater.git
   cd js-cheater
   ```
2. Abhängigkeiten installieren

   ```bash
   npm install        # Abhängigkeiten installieren
   npm run setup      # optional: Playwright-Browser laden
   ```

3. `npm run build`   # generiert src/popup/scanner-code.js
4. `npm run build:extensions`   # erstellt dist/mv2 und dist/mv3 als ladbare Pakete
5. Erweiterungsseite öffnen
   - Chrome → `chrome://extensions/`
   - Firefox → `about:debugging#/runtime/this-firefox`
6. Entwicklermodus aktivieren → **Entpackte Erweiterung laden** → Projektordner wählen
7. **Nur Firefox:** In `about:config` die Flags `extensions.manifestV3.enabled` und `extensions.backgroundServiceWorker.enabled` auf `true` setzen und Firefox neu starten.
8. 🎮 GamePad‑Icon erscheint in der Toolbar
9. Chrome meldet beim Laden möglicherweise `Unrecognized manifest key 'sidebar_action'`. Diese Warnung ist harmlos, da das Feld nur von Firefox genutzt wird.

## Schnellstart

> Vor dem Start einmalig `npm run build` ausführen.

1. `python3 -m http.server 8000` starten
2. `http://localhost:8000/test.html` öffnen
3. GamePad‑Icon klicken → Side Panel öffnet sich
4. „Scanner‑Code kopieren (manuell einfügen)" → F12 → Konsole → Einfügen → Enter
5. Wert `1337` eingeben → **Erster Scan** klicken
6. Wert im Spiel ändern → neuen Wert eingeben → **Verfeinern**

## Bedienungsanleitung

### Suche

- **Erster Scan** – initiale Treffermenge
- **Verfeinern** – Wert erneut eingeben, um Treffer einzuschränken
- **Neue Suche** – Hit‑Liste zurücksetzen
- **Suchtyp** – Dropdown entscheidet zwischen Wert- oder Namenssuche

### Trefferliste

- Klick auf Eintrag → neuen Wert eingeben
- 💾 Button → als Favorit speichern
- ❄️ Freeze-Button → Wert einfrieren/lösen

### Favoriten

- ✏️ Ändern – Neuer Wert + Enter oder Button
- 🗑️ Löschen – Eintrag entfernen
- ❄️ Freeze – Variable fixieren
- Eingaben bleiben tab‑übergreifend erhalten
- Favoriten werden pro Domain gespeichert
- Export/Import zum Teilen als JSON-Datei

### Tools

- 📤 localStorage exportieren
- 📥 localStorage importieren (z.B. Savegames sichern)

## Architektur

```text
Side Panel  ←→  Service Worker
      ↑                     ↓
   Content Script ←→ Scanner (Main World)
                   (postMessage)
```

- **Manifest V3** mit Service‑Worker
- **postMessage** statt localStorage‑Polling
- **Scanner** läuft im Haupt‑Kontext → Vollzugriff ohne CSP‑Probleme
- **Service-Worker-Lebenszeit** – Chrome hält ihn am Leben, solange das Side Panel offen ist. In Firefox übernimmt die Sidebar diese Rolle. Für geplante Auto-Freeze-Features können `chrome.alarms` oder `offscreenDocuments` genutzt werden.

## Projektstruktur

```text
js-cheater/
├── manifest.json
├── icons/
├── src/
│   ├── service-worker.js
│   ├── content.js
│   └── popup/
│       ├── popup.html
│       └── popup.js
└── test.html
```

## Entwicklung

```bash
npm install          # Installiert alle Abhängigkeiten
npm run setup        # Lädt zusätzlich die Playwright-Browser herunter
npm run lint         # Prüft den Code-Stil mit ESLint und Prettier
npm run format       # Formatiert den Code mit Prettier
npm test             # Führt die Unit-Tests mit Jest aus
npm run test:e2e     # Startet die Playwright-Tests (benötigt installierte Browser)
# Vor dem Ausführen unbedingt `npm run setup` oder `npx playwright install` ausführen
```

- Vor `npm test`, `npm run lint` oder `npm run format` unbedingt einmal `npm install` (oder `npm run setup`) ausführen.

- **Build-Schritt:** `npm run build` generiert den String aus `src/scanner-source.js`.
- **Scanner-Code bearbeiten:** Änderungen in `src/scanner-source.js` erfordern `npm run build`.
- **Debug-Logs:** Ändere `DEBUG` in `src/debug.js` auf `true`, um zusätzliche Konsolenausgaben zu erhalten.
- **Testen:** Unit-Tests mit `npm test`, E2E-Tests mit `npm run test:e2e`. Führe zuvor `npm install` oder `npm run setup` aus.
- **Manuelles Testen:** Die Erweiterung kann weiterhin als entpackte Erweiterung geladen werden (Chrome oder Firefox).
- **Reload:** Nach Code-Änderungen die Erweiterung in `chrome://extensions/` bzw. `about:debugging` neu laden.
- **Manifest:** Änderungen an `manifest.json` immer manuell prüfen, da sie nicht automatisch generiert werden.
- **Hinweis:** Das Feld `sidebar_action` wird nur von Firefox verwendet. Chrome ignoriert es und zeigt beim Laden der Erweiterung lediglich die Warnung `Unrecognized manifest key 'sidebar_action'` an. Wer eine warnungsfreie Version bauen möchte, kann ein kleines Skript schreiben, das vor dem Packen eine manifest.json ohne dieses Feld erzeugt.

**Tipp:**

- Für UI-Änderungen im Side Panel genügt ein Reload des Panels.
- Für Content/Service-Worker-Änderungen ist ein kompletter Reload der Extension nötig.

## Roadmap

| Prio   | Feature                     |
| ------ | --------------------------- |
| ⭐⭐⭐ | Range‑Scans (>, <, ≈)       |
| ⭐⭐   | Auto‑Freeze (Hooks/Proxies) |
| ⭐     | Memory‑Snapshot‑Diff        |

## Lizenz

MIT – Viel Spaß beim Cheaten 🎮
