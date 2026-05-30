# Bug-Report – js-cheater

Stand: 2026-05-30

Geprüft wurde die gesamte Erweiterung (Scanner, Content-Script, Service-Worker,
Popup/Side-Panel, Favoriten, Save-Editor, RPG-Maker-Data-Editor, Build-Skripte).

**Tooling-Status (alles grün):**

- `npm run lint` – keine Findings
- `npm run typecheck` – keine Fehler
- `npm test` – 22 Suites / 183 Tests bestehen

Die unten gelisteten Fehler sind daher Logik-/Verhaltensfehler, die von den
bestehenden Tests nicht abgedeckt werden. Sie sind nach Schweregrad sortiert,
mit Einschätzung der Sicherheit (✅ bestätigt / ⚠️ wahrscheinlich).

---

## Hoch

### 1. ✅ [BEHOBEN] Pfad-Präfix wird in der Trefferliste nie entfernt

[src/popup/ui.js:231](src/popup/ui.js#L231) und [src/popup/ui.js:274](src/popup/ui.js#L274)

```js
const displayPath = h.path.replace(/^window\.globalThis\./, "");
```

Der Scanner baut Pfade ab `"window"` zusammen (`findAll(... path = "window" ...)`),
echte Pfade lauten also z. B. `window.gameState.player.hp`. Das Konstrukt
`window.globalThis.` entsteht im realen Betrieb **nie** (beim Rekursieren in
`window.globalThis` greift das `seen`-WeakSet, da `window.globalThis === window`).

Folge: Der `window.`-Präfix wird **niemals** entfernt; in der Trefferliste steht
durchgehend der redundante `window.`-Vorsatz. Der Unit-Test
([tests/unit/ui.test.js:71](tests/unit/ui.test.js#L71)) testet nur den
künstlichen Fall `window.globalThis.bar` und verdeckt so den Fehler.

**Fix:** Regex auf `/^window\./` ändern (ggf. zusätzlich `globalThis.` strippen).

**Behoben:** Neue Helper-Funktion `formatDisplayPath()` in
[src/popup/ui.js](src/popup/ui.js) strippt `window.`- und `globalThis.`-Präfix
(`/^(?:window|globalThis)\./`) an beiden Stellen. Test in
[tests/unit/ui.test.js](tests/unit/ui.test.js) prüft jetzt reale Pfade.

---

### 2. ✅ [BEHOBEN] Freeze-UI-Status desynchronisiert nach jedem Re-Render

[src/popup/ui.js:214-259](src/popup/ui.js#L214-L259) (Treffer) und
[src/popup/favorites-ui.js:117-127](src/popup/favorites-ui.js#L117-L127) (Favoriten)

Der „Freeze"-Status wird nur über die CSS-Klasse `active` am Button gehalten.
`renderHitsWithSaveButtons()` bzw. `renderFavorites()` bauen die Buttons bei
jedem Aufruf neu und damit immer im Zustand „nicht eingefroren" (❄️). Das
tatsächliche Einfrieren läuft aber als `setInterval` im Seitenkontext
([src/scanner-core.js:638](src/scanner-core.js#L638)) unverändert weiter.

Re-Renders passieren häufig: `updateList()` wird u. a. bei Tab-Wechsel,
Fenster-Fokus und `visibilitychange` über
[src/popup/popup-tab-context.js:77-78](src/popup/popup-tab-context.js#L77-L78)
ausgelöst. Folge:

- Eine eingefrorene Variable wird wieder als „nicht eingefroren" angezeigt.
- Klickt man erneut auf ❄️, wird ein **zweites** Freeze-Intervall gestartet
  (das erste läuft weiter und wird nie sauber aufgehoben, solange die
  UI-Anzeige nicht stimmt).
- Nach einer Verfeinerung verschieben sich zudem die Treffer-Indizes, sodass
  ein „eingefroren" wirkender Eintrag nicht mehr zur tatsächlich eingefrorenen
  Variable gehört.

**Fix:** Eingefrorene Pfade in einem zentralen Set/State halten und beim Render
den Button-Zustand daraus ableiten.

**Behoben:** Neues Modul [src/popup/freeze-state.js](src/popup/freeze-state.js)
hält ein zentrales `Set` der eingefrorenen Pfade als Single Source of Truth.
Treffer-Render ([src/popup/ui.js](src/popup/ui.js)) und Favoriten-Render
([src/popup/favorites-ui.js](src/popup/favorites-ui.js)) leiten den
Button-Zustand (`active`, ❄️/🔥) jetzt aus `isFrozen(path)` ab; die
Klick-Handler pflegen den State via `markFrozen`/`markUnfrozen`. Damit bleibt
der Zustand über Re-Renders (Tab-Wechsel, Fokus, `visibilitychange`) erhalten
und ein doppeltes Freeze-Intervall wird vermieden. Regressionstest in
[tests/unit/ui.test.js](tests/unit/ui.test.js).

---

### 3. ✅ [BEHOBEN] Suche im Save-Editor filtert nichts

[src/popup/save-editor.js:816-874](src/popup/save-editor.js#L816-L874)

`performSearch()` setzt für **jede** Zeile `row.style.display = ""` (also
sichtbar) – auch für Nicht-Treffer. Es werden weder Nicht-Treffer ausgeblendet
noch Treffer hervorgehoben; lediglich übergeordnete Container werden aufgeklappt
und ein Zähler („N Treffer") gesetzt.

Folge: Das Suchfeld wirkt funktionslos – außer dem Trefferzähler ändert sich
optisch nichts. Erwartbar wäre ein Ausblenden der Nicht-Treffer oder ein
Highlight.

**Behoben:** [src/popup/save-editor.js](src/popup/save-editor.js)
`performSearch()` blendet jetzt zuerst alle Zeilen aus und macht dann nur
Treffer (Klasse `search-match`) plus deren kompletten Eltern-Pfad via neuer
Helper-Funktion `revealRowPath()` wieder sichtbar; eingeklappte Container
werden dabei aufgeklappt. Highlight-Styles in
[src/popup/save-editor.css](src/popup/save-editor.css) (hell + dark).
Regressionstest in
[tests/unit/save-editor.behavior.test.js](tests/unit/save-editor.behavior.test.js).

---

## Mittel

### 4. ✅ [BEHOBEN] Verlorene Treffer beim Verfeinern numerischer „lose" Matches

[src/scanner-core.js:391-401](src/scanner-core.js#L391-L401) vs.
[src/scanner-core.js:414-426](src/scanner-core.js#L414-L426)

`scan()` matcht bei numerischen Zielen über `looseNumericMatch` auch Werte, die
als String (`"100"`) oder BigInt gespeichert sind. `refine()` (und
`refineByNameAndValue()`) vergleichen jedoch strikt mit `obj[key] === value`.

Folge: Ein als String gespeicherter Wert (in Spielen häufig) wird beim ersten
Scan gefunden, beim ersten „Verfeinern" aber zwangsweise verworfen – obwohl er
weiterhin der korrekte Treffer ist. Refine sollte dieselbe Lockerheit wie Scan
verwenden.

**Behoben:** Gemeinsame Hilfsfunktion `looseValueEquals(v, value)` in
[src/scanner-core.js](src/scanner-core.js) kapselt die lockere
Numerik-Vergleichslogik (Number/String/BigInt). `scan`,
`scanByNameAndValue`, `refine` und `refineByNameAndValue` nutzen sie jetzt
einheitlich; Refine verwirft string-/bigint-gespeicherte Zahlen nicht mehr.
Generierte [src/popup/scanner-code.js](src/popup/scanner-code.js) neu gebaut.
Regressionstest in [tests/unit/scanner.test.js](tests/unit/scanner.test.js).

### 5. ✅ [BEHOBEN] Re-Encoding von Objekt-Speicherständen ändert den Typ (Datenintegrität)

[src/content.js:274](src/content.js#L274) und
[src/popup/save-editor.js:758-779](src/popup/save-editor.js#L758-L779)

`getRpgMakerSaves` macht aus einem nicht-String-IndexedDB-Wert per
`JSON.stringify(v)` einen String. Beim Speichern schreibt
`setRpgMakerSave`/`writeLocalForage` den bearbeiteten JSON wieder als **String**
zurück (`store.put(raw, key)`). Ein Slot, den das Spiel ursprünglich als
**Objekt** abgelegt hat, liegt danach als String in der IndexedDB – das Spiel
kann ihn dann u. U. nicht mehr korrekt lesen.

Betrifft Spiele mit unkomprimierten Objekt-Saves (Format `"json"`); bei den
üblichen LZString-/zlib-komprimierten String-Saves ist der Roundtrip korrekt.

**Behoben:** `readLocalForage` merkt sich jetzt pro Slot das ursprüngliche
Encoding (`encoding: "string" | "json"`). Der Save-Editor
([src/popup/save-editor.js](src/popup/save-editor.js)) reicht es beim Speichern
an `setRpgMakerSave` zurück; `writeLocalForage` ([src/content.js](src/content.js))
parst bei `encoding === "json"` den JSON-String vor dem `store.put` wieder zu
einem Objekt, sodass der Original-Typ erhalten bleibt. Regressionstest in
[tests/unit/content.test.js](tests/unit/content.test.js).

### 6. ⚠️ `writeLocalForage` erzeugt leere „Phantom"-IndexedDB-Datenbanken

[src/content.js:312-360](src/content.js#L312-L360)

Anders als `readLocalForage` (das in `onupgradeneeded` die Transaktion via
`abort()` verwirft, um Neuanlage zu verhindern) besitzt `writeLocalForage`
**keinen** `onupgradeneeded`-Handler. Ein `indexedDB.open("localforage")` bzw.
`open("RPG Maker MZ")` auf einer nicht existierenden DB legt diese damit als
leere Datenbank an. Folge: ungewollte, leere DBs im Origin des Spiels.

---

## Niedrig / Latent

### 7. ⚠️ Build escaped Backslashes nur in `parse-path`, nicht im restlichen Scanner-Code

[scripts/build-scanner.mjs:21](scripts/build-scanner.mjs#L21) und
[scripts/build-scanner.mjs:52](scripts/build-scanner.mjs#L52)

Backslashes werden gezielt nur für `parse-path.js` verdoppelt
(`parsePath.replace(/\\/g, "\\\\")`). Beim finalen Einbetten in das
Template-Literal werden nur Backticks und `${` escaped – Backslashes aus
`scanner-core.js`/`scanner-source.js` jedoch nicht. Aktuell enthält dieser Code
zufällig keine Backslashes. Sobald aber z. B. ein Regex mit `\d`/`\s` in
`scanner-core.js` ergänzt wird, würde der generierte `SCANNER_CODE` beim
Template-Literal-Auswerten beschädigt. Latente Build-Fragilität.

### 8. ⚠️ `findAll` – ungeschützter Zugriff auf `constructor.prototype`

[src/scanner-core.js:146-151](src/scanner-core.js#L146-L151),
Top-Level-Aufruf in [src/scanner-core.js:229](src/scanner-core.js#L229)

```js
if (typeof root === "object" && root.constructor &&
    root.constructor.prototype === root) { return out; }
```

Der Zugriff auf `root.constructor`/`.prototype` steht außerhalb von try/catch.
Bei rekursiven Aufrufen ist das durch das umschließende try/catch abgefangen,
der erste Aufruf `findAll(window, ...)` in `runPasses` jedoch nicht. Ein exotisches
globales Objekt mit werfendem `constructor`-Getter könnte den gesamten
Scan-Pass abbrechen. Geringe Eintrittswahrscheinlichkeit.

### 9. ⚠️ Manifest: alle Icon-Größen zeigen auf das 128px-PNG

[manifest.json:13-18](manifest.json#L13-L18) (und die `action`/`side_panel`-Icons)

Die Größen 16/32/48 verweisen alle auf `icons/icon128.png`. Funktioniert, ist
aber suboptimal (Skalierung der 128px-Grafik auf 16px). Kosmetisch.

---

## Hinweise (kein Fehler, aber auffällig)

- **Nicht committete Working-Tree-Änderungen:** Mehrere `*.d.ts` sind als
  gelöscht markiert und `src/globals.d.ts` ist neu/ungetrackt. Vor dem nächsten
  Commit prüfen, ob das gewollt ist (betrifft `typecheck:dts`).
- **Freeze-Wert in Favoriten** ([src/popup/favorites-ui.js:124](src/popup/favorites-ui.js#L124)):
  Es wird `fav.value` (Stand zum Speicherzeitpunkt) eingefroren, nicht der aktuell
  im Eingabefeld stehende bzw. der live ausgelesene Wert. Verhalten ist
  nachvollziehbar, kann aber überraschen.
- **`setLocalStorage`-Import mergt statt zu ersetzen**
  ([src/content.js:124-143](src/content.js#L124-L143)): Vorhandene Keys, die
  nicht im Import enthalten sind, bleiben erhalten. Je nach Erwartung an einen
  „Savegame-Restore" evtl. unerwünscht.
