# JS-Cheater Extension - Anleitung

## Funktionsweise

Die Extension nutzt ein **Side Panel** für persistente Bedienung und verwendet postMessage-Kommunikation, um CSP-Probleme zu umgehen.

## Schritt-für-Schritt Anleitung

### 1. Extension installieren

- Öffne die Erweiterungsseite
  - Chrome: `chrome://extensions/`
  - Firefox: `about:debugging#/runtime/this-firefox`
- Aktiviere "Developer mode" (Entwicklermodus)
- Klicke "Load unpacked" und wähle den Projektordner (z.B. <Pfad zum Projektordner>/js-cheater)
- **Nur Firefox:** `about:config` öffnen und `extensions.manifestV3.enabled` sowie `extensions.backgroundServiceWorker.enabled` auf `true` setzen. Danach Firefox neu starten.
- Das 🎮 GamePad-Icon erscheint in der Browser-Toolbar

### 2. Test-Seite öffnen

- Starte lokalen Server: `cd js-cheater && python3 -m http.server 8000`
- Gehe zu `http://localhost:8000/test.html`
- Diese Seite enthält Test-Variablen wie `gameScore: 1337`

### 3. Side Panel öffnen

1. **Klicke das 🎮 GamePad-Icon** in der Browser-Toolbar
2. Das **Side Panel** öffnet sich rechts neben der Webseite
3. Das Panel bleibt **dauerhaft geöffnet** - verschwindet nicht beim Klicken!

### 4. Scanner-Code laden

1. **Scanner-Code kopieren (manuell einfügen)**: Klicke auf "📋 Scanner-Code kopieren"
2. **Developer Tools öffnen**: Drücke F12 auf der Zielseite
3. **Console öffnen**: Gehe zum "Console" Tab
4. **Code einfügen**: Füge den Code mit Ctrl+V ein und drücke Enter
5. **UI wechselt automatisch**: Das Side Panel zeigt die Scan-Tabs

### 5. Werte scannen (Such-Tab)

1. Gib `1337` in das Eingabefeld ein
2. Klicke "🔍 Erster Scan"
3. Die Extension findet alle Stellen mit dem Wert 1337
4. Wechsle zu "Verfeinern" Buttons

### 6. Treffer verfeinern

1. Ändere einen Wert auf der Webseite (z.B. durch Gameplay)
2. Gib den neuen Wert ein
3. Klicke "🔬 Verfeinern" um die Treffer zu reduzieren

### 7. Werte bearbeiten

- **Direkt aus Suchergebnissen**: Klicke auf einen Treffer → neuen Wert eingeben
- **💾 Favoriten speichern**: Klicke den Speicher-Button neben Treffern
- **❄️ Freeze**: Wert per Button einfrieren oder lösen

### 8. Favoriten-Tab

- **Persistente Werte**: Gespeicherte Variablen mit Namen
- **Input-Felder**: Neue Werte eingeben (bleiben beim Tab-Wechsel erhalten)
- **Enter-Taste**: Werte direkt mit Enter ändern
- **✏️ Edit / 🗑️ Delete**: Buttons für Wert-Updates und Löschen
- **❄️ Freeze**: Variable fixieren oder freigeben

### 9. Neue Suche

- **"🆕 Neue Suche"**: Alle Hits zurücksetzen oder mit neuem Wert direkt scannen

### 10. Tools

- **Export**: Aktuellen localStorage als Datei sichern (Backup/Savegame)
- **Import**: JSON-Datei laden und Werte in localStorage schreiben

## Debug

- Die Console zeigt detaillierte Logs für Debugging
- Side Panel bleibt auch bei Console-Nutzung geöffnet

## Side Panel Vorteile

- **Persistent**: Bleibt geöffnet, verschwindet nicht bei Klicks
- **Zwei Tabs**: "Suche" für Scanning, "Favoriten" für gespeicherte Werte
- **Input-Persistenz**: Eingabewerte bleiben beim Tab-Wechsel erhalten
- **Resizable**: Panel-Größe anpassbar

## Intelligente UI

- **Setup-Modus**: Nur Scanner-Code-Button sichtbar
- **Scan-Modus**: Nach Code-Injection erscheinen Scan-Tabs
- **Auto-Tab-Switch**: Wechselt automatisch zwischen Such- und Favoriten-Tab
- **Event-Delegation**: Optimierte Button-Behandlung mit Enter-Key-Support

## CSP-Problem gelöst

Die Extension injiziert keinen Code direkt, sondern verwendet postMessage für sichere Kommunikation zwischen Extension und Konsolen-Code.
