# PLAN.md – Bestandsaufnahme & Refactor-Vorschläge

Stand: 2026-04-20. Ergebnis einer Code-Review über `src/`, `scripts/`, `tests/` und
Manifeste. Tests, Lint und Typecheck laufen grün (`npm run test:unit`,
`npm run lint`, `npm run typecheck`), d. h. die u. g. Probleme sind durch die
bestehende Testabdeckung nicht erfasst.

---

## 1. Harte Bugs

### 1.1 `rpgmaker-data-editor.js` ignoriert die `readPath`-Antwortform (kritisch)

Datei: [src/popup/rpgmaker-data-editor.js](src/popup/rpgmaker-data-editor.js)

`scanner.readPath(path)` liefert `{ value: … }` bzw. `{ error: … }` (siehe
[src/scanner-core.js:823-837](src/scanner-core.js#L823-L837)). Der Editor
behandelt das Ergebnis aber, als wäre es direkt der Wert:

- [rpgmaker-data-editor.js:124-125](src/popup/rpgmaker-data-editor.js#L124-L125)
  `Array.isArray(varResult)` ist für `{ value: [...] }` immer `false`, also
  werden `variables` und `switches` jedes Mal auf `[]` gesetzt. Die Tabelle
  „📊 Variablen / Schalter“ bleibt damit leer bzw. zeigt nur die
  benannten Einträge mit Wert `0` / `false`.
- [rpgmaker-data-editor.js:158-163](src/popup/rpgmaker-data-editor.js#L158-L163)
  `partyItems = itemsResult` enthält dann `{ value: {...} }`, wodurch
  `partyData[itemId]` immer `undefined` ist. Folge: die Item-Liste zeigt für
  alle Items „x 0“, selbst wenn sie im Inventar sind.

**Fix:** auf `.value` zugreifen, ähnlich wie:

```js
variables = Array.isArray(varResult?.value) ? varResult.value : [];
switches  = Array.isArray(swResult?.value)  ? swResult.value  : [];

const items = itemsResult?.value;
partyItems  = items && typeof items === "object" && !Array.isArray(items)
  ? items : {};
```

Außerdem: `varResult.error` / `swResult.error` werden gar nicht behandelt. Ein
vorhandener Fehler fällt damit still auf `[]` durch.

**Tests ergänzen** – aktuell deckt kein Test den `rpgmaker-data-editor`
(keine Datei `tests/unit/rpgmaker-data-editor*`).

### 1.2 `save-editor.setAtPath` schreibt auf falsche Pfade

Datei: [src/popup/save-editor.js:590-608](src/popup/save-editor.js#L590-L608)

```js
function setAtPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 1; i < parts.length - 1; i++) { … }  // <- Start bei i=1
  const lastKey = parts[parts.length - 1];
  current[lastKey] = value;
}
```

Die Schleife überspringt `parts[0]`. Pfade kommen aber ohne Root-Präfix herein
(`renderEditor` baut sie als `key + "." + childKey` → `"party.0._gold"`):

- `"party"` (length 1): setzt `obj.party` – OK.
- `"party.0"` (length 2): setzt `obj["0"]` statt `obj.party[0]` – **BUG**.
- `"party.0._gold"` (length 3): navigiert `obj["0"]`, das ist `undefined` →
  Funktion returnt stumm, nichts wird geschrieben – **BUG**.

Der Regressionstest
[tests/unit/save-editor.behavior.test.js](tests/unit/save-editor.behavior.test.js)
editiert nur ein Top-Level-Primitive (`{ gold: 100 }`) und trifft den Bug nicht.

**Fix:** Schleife bei `i = 0` starten.

**Folgearbeit:** Testfall mit geschachteltem Save hinzufügen
(`{ party: { gold: 100 } }` + `path = "party.gold"` → schreibt wirklich `party.gold`).

### 1.3 `engine-detect.js`: `let`-Verwendung vor Deklaration

Datei: [src/popup/engine-detect.js:32,36](src/popup/engine-detect.js#L32-L36)

```js
  lastRawResult = result;   // Zeile 32
}
let lastRawResult = null;   // Zeile 36
```

Das ist am Modul-Scope zwar legal (Deklaration wird vor erstem Aufruf
ausgeführt), aber stilistisch eine Stolperfalle und bricht, falls der Zugriff
je in eine innere Funktion verschoben wird (TDZ). `let` nach oben ziehen.

### 1.4 `scanner-core.readPath` ignoriert `window`/`globalThis`-Präfix

Datei: [src/scanner-core.js:823-837](src/scanner-core.js#L823-L837) vs.
[src/scanner-core.js:609-656](src/scanner-core.js#L609-L656)

`pokeByPath` überspringt `parts[0]` wenn es `"window"` oder `"globalThis"`
ist, `readPath` aber nicht. Funktioniert aktuell durch Zufall
(`window.window === window`, `window.globalThis === window`), sorgt aber für
Inkonsistenzen und bricht, sobald ein Pfad z. B. auf `globalThis` in einem
ShadowRealm umgestellt würde. → gleiche `startIdx`-Logik wie `pokeByPath`.

### 1.5 `freezeByPath` schreibt auf orphanen Parent

Datei: [src/scanner-core.js:660-693](src/scanner-core.js#L660-L693)

Der Parent wird einmal aufgelöst und im Closure gehalten. Ersetzt das Spiel
intern das übergeordnete Objekt (`$gameActors` wird bei Kampfende durch eine
neue Instanz ausgetauscht), friert unser `setInterval` weiterhin das alte,
nicht mehr referenzierte Objekt ein → „Freeze wirkt nicht mehr“.

**Fix:** Pfad bei jedem Tick neu auflösen (z. B. inline `pokeByPath(path, value)`
aufrufen), oder dokumentieren, dass ein Freeze nach Scene-Wechseln erneuert
werden muss.

### 1.6 Manifest-Inkonsistenz

- [manifest.chrome.json](manifest.chrome.json): listet `src/popup/save-editor.*`
  in `web_accessible_resources`, aber nicht `src/popup/rpgmaker-data-editor.*`.
- [manifest.firefox.json](manifest.firefox.json): listet nur `src/content.js`
  in `web_accessible_resources` (weder Save- noch RPG-Editor).

Die Editor-Fenster funktionieren aktuell, weil Extension-eigene Seiten ihre
Ressourcen normalerweise auch ohne WAR laden dürfen; wir sollten die Listen
aber konsistent pflegen oder gezielt leer halten.

---

## 2. Logische Glitches / Edge Cases

### 2.1 `rpgmaker-data-editor.js` behandelt `readPath`-Fehler nicht

Zusätzlich zu 1.1: Antworten mit `{ error: … }` laufen stumm in den leeren
Zustand. Der Nutzer bekommt nur „📊 Keine Ergebnisse“, nicht die eigentliche
Fehlermeldung.

### 2.2 Doppelter `change`-Listener auf der Switch-Checkbox

[rpgmaker-data-editor.js:295](src/popup/rpgmaker-data-editor.js#L295) und
[rpgmaker-data-editor.js:300](src/popup/rpgmaker-data-editor.js#L300) hängen
zwei separate `change`-Handler an dieselbe Checkbox. Beim Revert im
Fehlerfall (`cb.checked = !value`) feuert `change` nicht erneut → das Label
bleibt auf dem alten Zustand. Einen einzigen Handler bauen, der beides macht.

### 2.3 `favorites-ui.handleUpdateFavorite`: `isNaN(inputValue)` vs. leerer String

[favorites-ui.js:79](src/popup/favorites-ui.js#L79):
`!isNaN(inputValue) && inputValue !== ""` – hier wird auch `"   "`
(Whitespace) als Zahl interpretiert (`parseFloat("   ")` ist `NaN`, aber
`Number("   ")` ist `0`, `isNaN("   ")` ist `false`). Also wird
`"   "` zu `0` gepokt. Besser vorher `trim()` + explizit auf leer prüfen
(wird oben bereits gemacht, danach aber wieder der unbereinigte String
benutzt).

### 2.4 `save-editor.performSearch` kann Markup zerlegen

[save-editor.js:887-953](src/popup/save-editor.js#L887-L953): Bei mehrfachem
Suchen werden Highlights per `replaceChild` / `normalize()` entfernt und neu
gesetzt. Es gibt aber gar keinen Code, der `search-highlight`-Spans erzeugt
– die Klasse wird nur im Entfernen referenziert. Entweder totes Entfernen
raus oder tatsächlich Highlighting einbauen.

### 2.5 `scanner-core.shouldAvoidGetterEvaluation` pro Scan mehrfach ausgeführt

Einmal in `scan()` für `conservativeMode`, einmal in jedem rekursiven
`findAll`-Aufruf. Bei tiefen Scans läppert sich das (UA-Parsing pro Aufruf).
Ergebnis einmal cachen.

### 2.6 `ui.js` – toter Code

[ui.js:160-186](src/popup/ui.js#L160-L186) exportiert `renderHits`, aber
aufgerufen wird nur `renderHitsWithSaveButtons`. Ebenso ist
[ui.js:127-129](src/popup/ui.js#L127-L129) `showEmptyState` ein No-Op. Beide
entfernen (oder ggf. `renderHits` als gemeinsame Basis in
`renderHitsWithSaveButtons` refaktorieren, falls es perspektivisch weitere
Varianten geben soll).

### 2.7 `tools.js` – dreifache RPG-Maker-Prüfung

[tools.js:49-53, 67-71](src/popup/tools.js#L49-L71):

```js
detection.id.startsWith("rpgmaker") ||
  detection.id.includes("rpg-maker") ||
  detection.id.includes("rpgmaker")
```

`startsWith("rpgmaker")` deckt beide vorhandenen IDs
(`rpgmaker-mv-mz`, `rpgmaker-mz-effekseer`) ab, die beiden `includes`-Zweige
matchen nichts Zusätzliches. Auf einen Aufruf reduzieren.

---

## 3. Refactoring-Kandidaten

### 3.1 Zentraler Tab-Message-Helper

`sendTabMessage` / `send` ist in vier Modulen neu implementiert:

- [src/popup/communication.js:86-123](src/popup/communication.js#L86-L123)
- [src/popup/save-editor.js:42-77](src/popup/save-editor.js#L42-L77)
- [src/popup/rpgmaker-data-editor.js:15-42](src/popup/rpgmaker-data-editor.js#L15-L42)

Den Helper aus `communication.js` auch für die beiden Editor-Fenster nutzen
(Import-Pfad geht, weil beide im selben Extension-Origin laufen).

### 3.2 `tools.js` – `updateSaveEditorVisibility` / `updateRpgDataEditorVisibility`

[tools.js:44-73](src/popup/tools.js#L44-L73): Zwei nahezu identische
Funktionen + zwei fast identische `openSaveEditor`/`openRpgDataEditor`.
Auf einen Generator reduzieren:

```js
const openEditor = (file, name, size) => async () => {
  const tab = await getActiveTab().catch(() => null);
  const url = chrome.runtime.getURL(
    `src/popup/${file}` + (tab?.id ? `?tabId=${tab.id}` : "")
  );
  window.open(url, name, size);
};
```

### 3.3 `background.js` / `service-worker.js` gemeinsames Kernstück

[src/background.js](src/background.js) und
[src/service-worker.js](src/service-worker.js) sind zu ~80 % gleich. Einen
`background-core.js` mit allem Gemeinsamen anlegen und aus beiden Einstiegs-
punkten importieren; so bleibt die Pflege konsistent.

### 3.4 Scanner-Preset-Muster

`priorityPatterns` in `scan`, `scanByName`, `scanByNameAndValue`
(~3× dieselbe Liste Spiel-Keywords, [src/scanner-core.js:188-208](src/scanner-core.js#L188-L208)
u. a.) in eine Modulkonstante hochziehen.

### 3.5 `renderFavorites` nutzt `innerHTML` mit Template-Literalen

[favorites-ui.js:19-56](src/popup/favorites-ui.js#L19-L56): `escapeHtml`
schützt zwar, aber der Mix aus `innerHTML` und später DOM-APIs ist
fehleranfällig. Perspektivisch auf reine DOM-API umstellen (wie es
`rpgmaker-data-editor.buildVariableRows` ohnehin tut).

### 3.6 `rpgmaker-data-editor.renderValues` baut Tabellen per `innerHTML`

[rpgmaker-data-editor.js:187-226](src/popup/rpgmaker-data-editor.js#L187-L226):
Statisches Tabellenskelett mit `innerHTML`, danach per `appendChild`
weitergebaut – Stilbruch. Entweder ganz DOM oder ganz Template.

### 3.7 `src/debug.js`

Das File enthält nur die Exportzeile (1 Zeile). Kein Problem – nur erwähnen,
weil es zusammen mit `parse-path.js` / `storage-utils.js` als Einzeiler
gewachsen ist. Zusammenführen (`src/shared/`)? Optional.

---

## 4. Dokumentation & Housekeeping

- [AGENTS.md](AGENTS.md) erwähnt `src/popup/rpgmaker-data-editor.js` nicht im
  Repo-Map-Abschnitt.
- [README.md](README.md) – checken, ob die neuen RPG-Maker-Features dort
  beschrieben sind (nicht gelesen, nur als Stichwort).
- Tests: es gibt keine Unit-Tests für
  `rpgmaker-data-editor`, `engine-detect` (nur sehr oberflächlich),
  `popup-injection` (nur Copy-Pfad). Die kritischen Bugs 1.1 und 1.2 wären
  mit minimalem Test-Setup früh aufgefallen.
- `src/debug.js` / `src/parse-path.js` haben `.d.ts`-Geschwister, aber
  `src/popup/path-utils.js` ist ein 1-Zeiler Re-Export – die Abstraktion wirkt
  überflüssig.

---

## 5. Priorisierte Abarbeitungsreihenfolge (Vorschlag)

1. **Bug 1.1** – sofort, bricht ein zentrales Feature (RPG-Editor).
2. **Bug 1.2** – sofort, Save-Editor speichert geschachtelte Werte nicht.
3. Tests für 1.1 und 1.2 ergänzen, Regression verhindern.
4. **Bug 1.5** (Freeze) – verifizieren, ggf. Pfad pro Tick neu auflösen.
5. **Glitches 2.1–2.3** nachziehen (kleine, isolierte Fixes).
6. **Refactor 3.1** (gemeinsamer Send-Helper) – Voraussetzung, damit die drei
   Editor-Varianten sich nicht weiter auseinanderentwickeln.
7. Rest (3.2–3.7, 4) nach Bedarf.
