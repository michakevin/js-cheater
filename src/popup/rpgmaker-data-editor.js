/**
 * RPG Maker Data Editor
 *
 * Loads /data/Items.json, /data/Weapons.json, /data/Armors.json, /data/System.json
 * from the game server (same-origin fetch via content script), then reads live
 * game state ($gameVariables, $gameSwitches, $gameParty) via the scanner.
 *
 * Requires the JS-Cheater scanner to be active in the game tab for live data.
 */

// ---- Communication ----

import { $, escapeHtml } from "./utils.js";
import { hideStatus, showStatus } from "./editor-status.js";
import {
  createTabSender,
  readTabIdFromLocation,
  sendAndAssertSuccess,
} from "./editor-shell.js";

let activeTabId = null;
const send = createTabSender(() => activeTabId, "Kein aktiver Tab");

// ---- State ----

let staticData = null; // { items, weapons, armors, system }
let partyItems = {}; // { [itemId]: qty }
let partyWeapons = {}; // { [weaponId]: qty }
let partyArmors = {}; // { [armorId]: qty }
let variables = []; // array indexed by variable ID
let switches = []; // array indexed by switch ID
let actors = []; // array indexed by actor ID ($gameActors._data)

let currentItemType = "items";

// Param labels for RPG Maker _paramPlus[0..7]
const PARAM_LABELS = ["MHP", "MMP", "ATK", "DEF", "MAT", "MDF", "AGI", "LUK"];

// ---- Tab switching ----

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== tabName + "Tab");
    panel.classList.toggle("active", panel.id === tabName + "Tab");
  });
  if (tabName === "values") {
    loadValues();
  } else if (tabName === "items") {
    loadItems();
  } else if (tabName === "actors") {
    loadActors();
  }
}

// ---- Load data ----

async function loadValues() {
  const content = $("#valuesContent");
  content.innerHTML = '<div class="loading-state">⏳ Lade Spielwerte…</div>';
  hideStatus();

  try {
    // Static data (variable/switch names from System.json)
    if (!staticData) {
      const result = await send("getRpgMakerGameData");
      if (!result || result.error) {
        throw new Error(result?.error || "Fehler beim Laden der Spieldaten");
      }
      staticData = result;
    }

    // Live game state via scanner (readPath)
    const [varResult, swResult] = await Promise.all([
      send("readPath", { path: "$gameVariables._data" }),
      send("readPath", { path: "$gameSwitches._data" }),
    ]);

    if (varResult?.timeout || swResult?.timeout) {
      throw new Error(
        "Scanner nicht aktiv – bitte zuerst den Scanner starten.",
      );
    }
    if (varResult?.error) throw new Error(varResult.error);
    if (swResult?.error) throw new Error(swResult.error);

    variables = Array.isArray(varResult?.value) ? varResult.value : [];
    switches = Array.isArray(swResult?.value) ? swResult.value : [];

    renderValues();
  } catch (e) {
    content.innerHTML =
      '<div class="empty-state"><p>❌ Fehler beim Laden</p></div>';
    showStatus("❌ " + e.message, "error");
  }
}

async function loadItems() {
  const content = $("#itemsContent");
  content.innerHTML = '<div class="loading-state">⏳ Lade Items…</div>';
  hideStatus();

  try {
    if (!staticData) {
      const result = await send("getRpgMakerGameData");
      if (!result || result.error) {
        throw new Error(result?.error || "Fehler beim Laden der Spieldaten");
      }
      staticData = result;
    }

    const [itemsResult, weaponsResult, armorsResult] = await Promise.all([
      send("readPath", { path: "$gameParty._items" }),
      send("readPath", { path: "$gameParty._weapons" }),
      send("readPath", { path: "$gameParty._armors" }),
    ]);

    if (itemsResult?.timeout) {
      throw new Error(
        "Scanner nicht aktiv – bitte zuerst den Scanner starten.",
      );
    }
    if (itemsResult?.error) throw new Error(itemsResult.error);
    if (weaponsResult?.error) throw new Error(weaponsResult.error);
    if (armorsResult?.error) throw new Error(armorsResult.error);

    const asPartyMap = (r) =>
      r &&
      typeof r.value === "object" &&
      r.value !== null &&
      !Array.isArray(r.value)
        ? r.value
        : {};
    partyItems = asPartyMap(itemsResult);
    partyWeapons = asPartyMap(weaponsResult);
    partyArmors = asPartyMap(armorsResult);

    renderItems();
  } catch (e) {
    content.innerHTML =
      '<div class="empty-state"><p>❌ Fehler beim Laden</p></div>';
    showStatus("❌ " + e.message, "error");
  }
}

async function loadActors() {
  const content = $("#actorsContent");
  content.innerHTML = '<div class="loading-state">⏳ Lade Charaktere…</div>';
  hideStatus();

  try {
    const result = await send("readPath", { path: "$gameActors._data" });

    if (result?.timeout) {
      throw new Error(
        "Scanner nicht aktiv – bitte zuerst den Scanner starten.",
      );
    }
    if (result?.error) throw new Error(result.error);

    actors = Array.isArray(result?.value) ? result.value : [];
    renderActors();
  } catch (e) {
    content.innerHTML =
      '<div class="empty-state"><p>❌ Fehler beim Laden</p></div>';
    showStatus("❌ " + e.message, "error");
  }
}

// ---- Render Spielwerte ----

function renderValues() {
  const content = $("#valuesContent");
  const systemData = staticData?.system || {};
  const varNames = systemData.variables || [];
  const swNames = systemData.switches || [];
  const filter = $("#valuesSearch")?.value?.toLowerCase() || "";

  const varRows = buildVariableRows(varNames, filter);
  const swRows = buildSwitchRows(swNames, filter);

  content.innerHTML = "";

  if (varRows.length > 0) {
    const varSection = document.createElement("div");
    varSection.innerHTML = `
      <div class="section-header">
        📊 Variablen <span class="section-count">${varRows.length}</span>
      </div>
      <table class="values-table">
        <thead>
          <tr>
            <th class="col-id">ID</th>
            <th class="col-name">Name</th>
            <th class="col-value">Wert</th>
          </tr>
        </thead>
        <tbody id="varTableBody"></tbody>
      </table>
    `;
    content.appendChild(varSection);
    const tbody = varSection.querySelector("#varTableBody");
    varRows.forEach((row) => tbody.appendChild(row));
  }

  if (swRows.length > 0) {
    const swSection = document.createElement("div");
    swSection.innerHTML = `
      <div class="section-header">
        🔀 Schalter <span class="section-count">${swRows.length}</span>
      </div>
      <table class="values-table">
        <thead>
          <tr>
            <th class="col-id">ID</th>
            <th class="col-name">Name</th>
            <th class="col-value">Ein/Aus</th>
          </tr>
        </thead>
        <tbody id="swTableBody"></tbody>
      </table>
    `;
    content.appendChild(swSection);
    const tbody = swSection.querySelector("#swTableBody");
    swRows.forEach((row) => tbody.appendChild(row));
  }

  if (varRows.length === 0 && swRows.length === 0) {
    content.innerHTML =
      '<div class="empty-state"><p>Keine Ergebnisse.</p></div>';
  }
}

function buildVariableRows(varNames, filter) {
  const rows = [];
  const maxIdx = Math.max(varNames.length - 1, variables.length - 1);

  for (let i = 1; i <= maxIdx; i++) {
    const name = varNames[i] || "";
    const value = variables[i] ?? 0;
    if (!name && value === 0) continue;

    if (name.startsWith("--")) {
      if (filter) continue;
      const tr = document.createElement("tr");
      tr.className = "table-section-header";
      tr.innerHTML = `<td colspan="3">${escapeHtml(name.replace(/^-+\s*/, ""))}</td>`;
      rows.push(tr);
      continue;
    }

    if (
      filter &&
      !String(i).includes(filter) &&
      !name.toLowerCase().includes(filter)
    )
      continue;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-id">${i}</td>
      <td class="col-name">${escapeHtml(name)}</td>
      <td class="col-value"></td>
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "value-input";
    input.value = value;
    input.dataset.idx = i;
    input.dataset.path = `$gameVariables._data[${i}]`;
    input.addEventListener("change", onVariableChange);
    tr.querySelector(".col-value").appendChild(input);
    rows.push(tr);
  }
  return rows;
}

function buildSwitchRows(swNames, filter) {
  const rows = [];
  const maxIdx = Math.max(swNames.length - 1, switches.length - 1);

  for (let i = 1; i <= maxIdx; i++) {
    const name = swNames[i] || "";
    const value = switches[i] ?? false;
    if (!name && !value) continue;

    if (name.startsWith("--")) {
      if (filter) continue;
      const tr = document.createElement("tr");
      tr.className = "table-section-header";
      tr.innerHTML = `<td colspan="3">${escapeHtml(name.replace(/^-+\s*/, ""))}</td>`;
      rows.push(tr);
      continue;
    }

    if (
      filter &&
      !String(i).includes(filter) &&
      !name.toLowerCase().includes(filter)
    )
      continue;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-id">${i}</td>
      <td class="col-name">${escapeHtml(name)}</td>
      <td class="col-value"></td>
    `;

    const wrap = document.createElement("div");
    wrap.className = "switch-toggle";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "switch-checkbox";
    cb.checked = Boolean(value);
    cb.dataset.idx = i;
    cb.dataset.path = `$gameSwitches._data[${i}]`;

    const lbl = document.createElement("span");
    lbl.className = value ? "switch-label-on" : "switch-label-off";
    lbl.textContent = value ? "EIN" : "AUS";

    const syncLabel = () => {
      lbl.className = cb.checked ? "switch-label-on" : "switch-label-off";
      lbl.textContent = cb.checked ? "EIN" : "AUS";
    };
    cb.addEventListener("change", async (e) => {
      await onSwitchChange(e);
      syncLabel();
    });

    wrap.appendChild(cb);
    wrap.appendChild(lbl);
    tr.querySelector(".col-value").appendChild(wrap);
    rows.push(tr);
  }
  return rows;
}

// ---- Render Items ----

function renderItems() {
  const content = $("#itemsContent");
  const filter = $("#itemsSearch")?.value?.toLowerCase() || "";

  let dataList = null;
  let partyData = {};
  let partyPath = "";

  if (currentItemType === "items") {
    dataList = staticData?.items || [];
    partyData = partyItems;
    partyPath = "$gameParty._items";
  } else if (currentItemType === "weapons") {
    dataList = staticData?.weapons || [];
    partyData = partyWeapons;
    partyPath = "$gameParty._weapons";
  } else {
    dataList = staticData?.armors || [];
    partyData = partyArmors;
    partyPath = "$gameParty._armors";
  }

  const listEl = document.createElement("div");
  listEl.className = "item-list";
  let count = 0;

  for (let i = 1; i < dataList.length; i++) {
    const item = dataList[i];
    if (!item || !item.name) continue;

    if (item.name.startsWith("-----")) {
      if (filter) continue;
      const header = document.createElement("div");
      header.className = "item-section-header";
      header.textContent = item.name.replace(/^-+\s*/, "");
      listEl.appendChild(header);
      continue;
    }

    const name = item.name;
    const desc = item.description || "";
    const iconIndex = item.iconIndex ?? 0;
    const qty = Number(partyData[i] ?? partyData[String(i)] ?? 0);

    if (
      filter &&
      !name.toLowerCase().includes(filter) &&
      !desc.toLowerCase().includes(filter)
    )
      continue;

    const row = document.createElement("div");
    row.className = "item-row";

    const inParty = qty > 0;
    row.innerHTML = `
      <div class="item-icon" title="Icon #${iconIndex}">${iconIndex}</div>
      <div class="item-info">
        <div class="item-name">${escapeHtml(name)}</div>
        <div class="item-desc">${escapeHtml(desc)}</div>
      </div>
      <div class="item-qty-wrap">
        <span class="item-qty-label">x</span>
      </div>
    `;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "99";
    input.className = "item-qty-input" + (inParty ? " in-party" : "");
    input.value = qty;
    input.dataset.itemId = i;
    input.dataset.path = `${partyPath}[${i}]`;
    input.addEventListener("change", onItemQtyChange);
    input.addEventListener("focus", () => input.select());
    // Prevent browser auto-scroll-to-focus when clicking the number spinner buttons.
    // The browser scrolls synchronously on focus; rAF runs after that paint step.
    input.addEventListener("pointerdown", function () {
      const panel = this.closest(".panel-content");
      if (!panel) return;
      const top = panel.scrollTop;
      requestAnimationFrame(() => {
        panel.scrollTop = top;
      });
    });

    row.querySelector(".item-qty-wrap").appendChild(input);
    listEl.appendChild(row);
    count++;
  }

  content.innerHTML = "";
  if (count === 0) {
    content.innerHTML =
      '<div class="empty-state"><p>Keine Items gefunden.</p></div>';
  } else {
    content.appendChild(listEl);
  }
}

// ---- Render Charaktere ----

function renderActors() {
  const content = $("#actorsContent");
  const filter = $("#actorsSearch")?.value?.toLowerCase() || "";

  const cards = [];
  for (let i = 1; i < actors.length; i++) {
    const actor = actors[i];
    if (!actor || typeof actor !== "object") continue;

    const name = String(actor._name ?? "");
    const label = name || `Actor ${i}`;

    if (
      filter &&
      !String(i).includes(filter) &&
      !label.toLowerCase().includes(filter)
    )
      continue;

    cards.push(buildActorCard(i, actor));
  }

  content.innerHTML = "";
  if (cards.length === 0) {
    content.innerHTML =
      '<div class="empty-state"><p>Keine Charaktere gefunden.</p></div>';
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "actor-list";
  cards.forEach((c) => wrap.appendChild(c));
  content.appendChild(wrap);
}

function buildActorCard(id, actor) {
  const card = document.createElement("div");
  card.className = "actor-card";
  card.dataset.actorId = String(id);

  const basePath = `$gameActors._data[${id}]`;
  const paramPlus = Array.isArray(actor._paramPlus) ? actor._paramPlus : [];

  card.innerHTML = `
    <div class="actor-header">
      <span class="actor-id">#${id}</span>
      <input class="actor-name-input" type="text"
             data-path="${basePath}._name" data-type="text"
             aria-label="Name" />
      <span class="actor-level-label">Lv.</span>
      <input class="actor-small-input" type="number" min="1"
             data-path="${basePath}._level" data-type="number"
             aria-label="Level" />
    </div>
    <div class="actor-resources">
      <label>HP <input class="actor-small-input" type="number" min="0"
                     data-path="${basePath}._hp" data-type="number" /></label>
      <label>MP <input class="actor-small-input" type="number" min="0"
                     data-path="${basePath}._mp" data-type="number" /></label>
      <label>TP <input class="actor-small-input" type="number" min="0"
                     data-path="${basePath}._tp" data-type="number" /></label>
      <label>EXP <input class="actor-small-input" type="number" min="0"
                     data-path="${basePath}._exp" data-type="number" /></label>
    </div>
    <div class="actor-params-grid"></div>
  `;

  card.querySelector(".actor-name-input").value = String(actor._name ?? "");
  const smalls = card.querySelectorAll(
    ".actor-header .actor-small-input, .actor-resources .actor-small-input",
  );
  // order: level, hp, mp, tp, exp
  const values = [
    actor._level ?? 1,
    actor._hp ?? 0,
    actor._mp ?? 0,
    actor._tp ?? 0,
    // _exp is an object keyed by classId; we edit the current class' EXP
    extractCurrentExp(actor),
  ];
  smalls.forEach((inp, idx) => {
    inp.value = String(values[idx] ?? 0);
  });

  // EXP path needs the current classId resolved at build time
  const expInput = smalls[4];
  if (expInput) {
    const cid = Number(actor._classId);
    if (Number.isFinite(cid) && cid > 0) {
      expInput.dataset.path = `${basePath}._exp[${cid}]`;
    } else {
      // No classId available → disable EXP editing rather than poking a random path
      expInput.disabled = true;
      expInput.title = "Keine Klasse erkannt";
    }
  }

  // Params grid
  const grid = card.querySelector(".actor-params-grid");
  for (let k = 0; k < PARAM_LABELS.length; k++) {
    const cell = document.createElement("label");
    cell.className = "actor-param";
    const val = Number(paramPlus[k] ?? 0);
    cell.innerHTML = `
      <span class="actor-param-label">${PARAM_LABELS[k]}</span>
    `;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.className = "actor-small-input";
    inp.value = String(val);
    inp.dataset.path = `${basePath}._paramPlus[${k}]`;
    inp.dataset.type = "number";
    cell.appendChild(inp);
    grid.appendChild(cell);
  }

  // Wire change handlers for every editable input inside the card
  card.querySelectorAll("input[data-path]").forEach((inp) => {
    inp.addEventListener("change", onActorFieldChange);
    if (inp.type === "number") {
      inp.addEventListener("focus", () => inp.select());
    }
  });

  return card;
}

function extractCurrentExp(actor) {
  const exp = actor?._exp;
  if (!exp || typeof exp !== "object") return 0;
  const cid = Number(actor._classId);
  if (Number.isFinite(cid) && cid > 0 && exp[cid] != null) return exp[cid];
  // Fallback: first numeric value
  for (const k of Object.keys(exp)) {
    const v = exp[k];
    if (typeof v === "number") return v;
  }
  return 0;
}

// ---- Change handlers ----

async function onVariableChange(e) {
  const input = e.target;
  const path = input.dataset.path;
  const rawVal = input.value.trim();

  let value;
  if (rawVal === "true") value = true;
  else if (rawVal === "false") value = false;
  else if (rawVal === "null") value = null;
  else if (!isNaN(rawVal) && rawVal !== "") value = Number(rawVal);
  else value = rawVal;

  input.classList.add("modified");
  try {
    await sendAndAssertSuccess(send, "poke", { path, value }, "Poke fehlgeschlagen");
    const idx = Number(input.dataset.idx);
    variables[idx] = value;
    showStatus(`✓ Variable ${idx} auf ${value} gesetzt.`, "success");
  } catch (e) {
    showStatus("❌ Fehler: " + e.message, "error");
  }
}

async function onSwitchChange(e) {
  const cb = e.target;
  const path = cb.dataset.path;
  const value = cb.checked;
  const idx = Number(cb.dataset.idx);

  try {
    await sendAndAssertSuccess(send, "poke", { path, value }, "Poke fehlgeschlagen");
    switches[idx] = value;
    showStatus(
      `✓ Schalter ${idx} auf ${value ? "EIN" : "AUS"} gesetzt.`,
      "success",
    );
  } catch (e) {
    showStatus("❌ Fehler: " + e.message, "error");
    cb.checked = !value; // revert
  }
}

async function onItemQtyChange(e) {
  const input = e.target;
  const itemId = Number(input.dataset.itemId);
  const qty = Math.max(0, Math.min(99, Number(input.value) || 0));
  input.value = qty;

  const partyRef =
    currentItemType === "items"
      ? partyItems
      : currentItemType === "weapons"
        ? partyWeapons
        : partyArmors;

  // Path to the specific item slot. pokeByPath now supports creating new keys,
  // so this works even when the item isn't in the party yet. We set only this
  // one key and leave the rest of $gameParty._items untouched.
  const itemPath =
    currentItemType === "items"
      ? `$gameParty._items[${itemId}]`
      : currentItemType === "weapons"
        ? `$gameParty._weapons[${itemId}]`
        : `$gameParty._armors[${itemId}]`;

  input.classList.add("modified");
  try {
    await sendAndAssertSuccess(
      send,
      "poke",
      { path: itemPath, value: qty },
      "Poke fehlgeschlagen",
    );

    // Mirror the change in the local cache
    if (qty === 0) {
      delete partyRef[itemId];
      delete partyRef[String(itemId)];
      input.classList.remove("in-party");
    } else {
      partyRef[itemId] = qty;
      input.classList.add("in-party");
    }
    const typeLabel =
      currentItemType === "items"
        ? "Item"
        : currentItemType === "weapons"
          ? "Waffe"
          : "Rüstung";
    showStatus(
      `✓ ${typeLabel} ${itemId}: Anzahl auf ${qty} gesetzt.`,
      "success",
    );
  } catch (err) {
    showStatus("❌ Fehler: " + err.message, "error");
  }
}

// ---- Search filtering ----

function applyValuesFilter() {
  renderValues();
}

function applyItemsFilter() {
  renderItems();
}

function applyActorsFilter() {
  renderActors();
}

async function onActorFieldChange(e) {
  const input = e.target;
  const path = input.dataset.path;
  const type = input.dataset.type || "text";
  const raw = input.value;

  let value;
  if (type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      showStatus("❌ Ungültige Zahl", "error");
      return;
    }
    value = n;
  } else {
    value = String(raw);
  }

  input.classList.add("modified");
  try {
    const result = await send("poke", { path, value });
    if (result?.success === false) {
      throw new Error(result.error || "Poke fehlgeschlagen");
    }
    showStatus(`✓ ${path} = ${value}`, "success");
  } catch (err) {
    showStatus("❌ Fehler: " + err.message, "error");
  }
}

// ---- Init ----

document.addEventListener("DOMContentLoaded", () => {
  activeTabId = readTabIdFromLocation();

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Item type filter
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentItemType = btn.dataset.type;
      renderItems();
    });
  });

  // Refresh buttons
  $("#refreshValues")?.addEventListener("click", loadValues);
  $("#refreshItems")?.addEventListener("click", loadItems);
  $("#refreshActors")?.addEventListener("click", loadActors);

  // Search inputs
  $("#valuesSearch")?.addEventListener("input", applyValuesFilter);
  $("#itemsSearch")?.addEventListener("input", applyItemsFilter);
  $("#actorsSearch")?.addEventListener("input", applyActorsFilter);

  // Auto-load initial tab (default: values)
  const activePanel = document.querySelector(".tab-panel.active");
  const initialTab = activePanel?.id?.replace(/Tab$/, "") || "values";
  if (initialTab === "values") {
    loadValues();
  } else if (initialTab === "items") {
    loadItems();
  } else if (initialTab === "actors") {
    loadActors();
  }
});
