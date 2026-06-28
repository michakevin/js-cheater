/**
 * Tools-tab UI for the Gallery-Unlocker.
 *
 * Drives `analyzeGallery` / `unlockGallery` via the content-script bridge
 * and renders three escalation tiers (known plugin, name heuristics on
 * $gameSwitches, free ID range).
 */

import { send } from "./communication.js";
import { $, escapeHtml } from "./utils.js";
import { showDialog } from "./dialog.js";

let lastAnalysis = null;
let galleryStatusTimeout = null;

const TIER_LABELS = {
  plugin: "Stufe 1 – Bekannte Plugins",
  switches: "Stufe 2 – Schalter-Heuristik",
  filter: "Namensfilter (manuell)",
  range: "Stufe 3 – Schalter nach ID-Nummer",
};

/** Preserved across re-render after unlock/refresh */
let lastFilterQuery = "";
let lastFilterTargets = { switches: true, variables: false };

function showGalleryStatus(message, type = "info", autoHide = true) {
  const bar = $("#galleryUnlockerStatus");
  if (!bar) return;
  if (galleryStatusTimeout) {
    clearTimeout(galleryStatusTimeout);
    galleryStatusTimeout = null;
  }
  bar.classList.remove("hidden", "status-success", "status-error", "status-info");
  bar.classList.add(`status-${type}`);
  bar.textContent = message;
  if (autoHide && type !== "info") {
    galleryStatusTimeout = setTimeout(() => hideGalleryStatus(), 8000);
  }
}

function hideGalleryStatus() {
  const bar = $("#galleryUnlockerStatus");
  if (!bar) return;
  bar.classList.add("hidden");
  bar.classList.remove("status-success", "status-error", "status-info");
  bar.textContent = "";
  if (galleryStatusTimeout) {
    clearTimeout(galleryStatusTimeout);
    galleryStatusTimeout = null;
  }
}

export function setupGalleryUnlockerListeners() {
  const btn = document.getElementById("analyzeGalleryBtn");
  if (!btn) return;
  btn.addEventListener("click", onAnalyzeClick);
}

async function onAnalyzeClick() {
  const btn = $("#analyzeGalleryBtn");
  const result = $("#galleryUnlockerResult");
  if (!btn || !result) return;

  btn.disabled = true;
  btn.textContent = "⏳ Analysiere…";
  result.classList.add("hidden");
  result.innerHTML = "";

  try {
    const analysis = await send("analyzeGallery");
    if (!analysis) {
      showGalleryStatus("❌ Scanner nicht erreichbar.", "error");
      return;
    }
    if (analysis.error) {
      showGalleryStatus("❌ Analyse fehlgeschlagen: " + analysis.error, "error");
      return;
    }
    lastAnalysis = analysis;
    renderAnalysis(analysis);
    result.classList.remove("hidden");
    hideGalleryStatus();
    if (!analysis.scannerEngineDetected) {
      showGalleryStatus(
        "ℹ️ $gameSwitches nicht gefunden – ist das Spiel geladen und der Scanner aktiv?",
        "info",
        false,
      );
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "🔍 Galerie analysieren";
  }
}

function renderAnalysis(analysis) {
  const result = $("#galleryUnlockerResult");
  if (!result) return;

  result.innerHTML = "";
  result.appendChild(renderTierPlugin(analysis.tier1));
  result.appendChild(renderTierSwitches(analysis.tier2));
  result.appendChild(renderTierNameFilter(analysis));
  result.appendChild(renderTierRange(analysis.tier3, analysis.tier2));

  if (Array.isArray(analysis.warnings) && analysis.warnings.length > 0) {
    const warn = document.createElement("div");
    warn.className = "gallery-tier-warning";
    warn.textContent = "⚠ " + analysis.warnings.join(" · ");
    result.appendChild(warn);
  }

  updateRangePreview(analysis.tier3?.totalSwitches ?? 0);
}

function renderTierPlugin(tier1) {
  const card = createTierCard("plugin", tier1.available);
  appendTitle(card, TIER_LABELS.plugin);

  const desc = document.createElement("p");
  desc.className = "gallery-tier-desc";
  if (tier1.available && tier1.adapters.length > 0) {
    const names = tier1.adapters.map((a) => a.name).join(", ");
    desc.textContent = `Erkannte Plugins: ${names}.`;
  } else {
    desc.textContent =
      "Kein bekanntes Galerie-Plugin erkannt. Fahre mit Stufe 2 fort.";
  }
  card.appendChild(desc);

  const btn = createApplyButton("Stufe 1 anwenden", async () => {
    await applyTier({ tier: "plugin" });
  });
  btn.disabled = !tier1.available;
  card.appendChild(btn);
  return card;
}

function renderTierSwitches(tier2) {
  const card = createTierCard("switches", tier2.available);
  appendTitle(card, TIER_LABELS.switches);

  const desc = document.createElement("p");
  desc.className = "gallery-tier-desc";
  if (tier2.available) {
    desc.textContent = `${tier2.switchCount} Schalter mit Galerie-/CG-bezogenen Namen gefunden (von ${tier2.totalSwitches}).`;
  } else if (tier2.totalSwitches > 0) {
    desc.textContent =
      "Keine Schalter mit Galerie-Namen erkannt. System.json enthält keine passenden Bezeichnungen.";
  } else {
    desc.textContent = "Keine Schalter-Daten verfügbar.";
  }
  card.appendChild(desc);

  if (tier2.sampleNames && tier2.sampleNames.length > 0) {
    const sample = document.createElement("div");
    sample.className = "gallery-tier-sample";
    sample.innerHTML = tier2.sampleNames.map((s) => escapeHtml(s)).join("<br>");
    card.appendChild(sample);
  }

  const btn = createApplyButton("Stufe 2 anwenden", async () => {
    await applyTier({ tier: "switches" });
  });
  btn.disabled = !tier2.available;
  card.appendChild(btn);
  return card;
}

function renderTierNameFilter(analysis) {
  const card = createTierCard("filter", true);
  appendTitle(card, TIER_LABELS.filter);

  const desc = document.createElement("p");
  desc.className = "gallery-tier-desc";
  desc.textContent =
    "Eigener Suchbegriff in Schalter- und Variablennamen (z. B. „Galerie“, „CG“, „回想“). Nützlich, wenn Stufe 2 zu wenig findet.";
  card.appendChild(desc);

  const searchRow = document.createElement("div");
  searchRow.className = "gallery-tier-filter-row";
  const input = document.createElement("input");
  input.type = "text";
  input.id = "galleryNameFilter";
  input.className = "gallery-tier-filter-input";
  input.placeholder = "Suchbegriff in Namen…";
  input.value = lastFilterQuery;
  input.setAttribute("aria-label", "Namensfilter");
  searchRow.appendChild(input);
  card.appendChild(searchRow);

  const targetRow = document.createElement("div");
  targetRow.className = "gallery-tier-filter-targets";
  targetRow.innerHTML = `
    <label class="gallery-tier-check"><input type="checkbox" id="galleryFilterSwitches" ${lastFilterTargets.switches ? "checked" : ""}> Schalter (→ EIN)</label>
    <label class="gallery-tier-check"><input type="checkbox" id="galleryFilterVariables" ${lastFilterTargets.variables ? "checked" : ""}> Variablen (→ 1 / wahr)</label>
  `;
  card.appendChild(targetRow);

  const preview = document.createElement("div");
  preview.id = "galleryFilterPreview";
  preview.className = "gallery-tier-preview";
  preview.textContent = "Vorschau: Suchbegriff eingeben…";
  card.appendChild(preview);

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "gallery-tier-btn-secondary";
  previewBtn.textContent = "🔍 Vorschau aktualisieren";
  previewBtn.addEventListener("click", () => refreshFilterPreview());
  card.appendChild(previewBtn);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") refreshFilterPreview();
  });

  if (lastFilterQuery.trim()) {
    queueMicrotask(() => refreshFilterPreview());
  }

  const btn = createApplyButton("Treffer freischalten", async () => {
    const query = $("#galleryNameFilter")?.value?.trim();
    const targets = readFilterTargets();
    if (!query) {
      showGalleryStatus("Bitte einen Suchbegriff eingeben.", "error");
      return;
    }
    if (targets.length === 0) {
      showGalleryStatus("Bitte Schalter und/oder Variablen auswählen.", "error");
      return;
    }
    lastFilterQuery = query;
    await applyTier({ tier: "filter", nameFilter: query, targets });
  });
  card.appendChild(btn);
  return card;
}

function readFilterTargets() {
  const targets = [];
  if ($("#galleryFilterSwitches")?.checked) targets.push("switches");
  if ($("#galleryFilterVariables")?.checked) targets.push("variables");
  lastFilterTargets = {
    switches: targets.includes("switches"),
    variables: targets.includes("variables"),
  };
  return targets;
}

async function refreshFilterPreview() {
  const preview = $("#galleryFilterPreview");
  if (!preview) return;
  const query = $("#galleryNameFilter")?.value?.trim();
  const targets = readFilterTargets();
  if (!query) {
    preview.textContent = "Vorschau: Suchbegriff eingeben…";
    return;
  }
  if (targets.length === 0) {
    preview.textContent = "Vorschau: Schalter oder Variablen auswählen.";
    return;
  }
  preview.textContent = "⏳ Suche…";
  const result = await send("previewGallery", {
    type: "filter",
    nameFilter: query,
    targets,
  });
  if (!result || result.error) {
    preview.textContent = result?.error || "Vorschau fehlgeschlagen.";
    return;
  }
  const parts = [];
  if (targets.includes("switches")) {
    parts.push(`${result.switchCount} Schalter`);
  }
  if (targets.includes("variables")) {
    parts.push(`${result.variableCount} Variablen`);
  }
  let text = `Vorschau: ${parts.join(", ")} gefunden`;
  if (result.truncated) text += " (Auszug unten)";
  const lines = [];
  for (const s of result.switches || []) {
    lines.push(`${s.id}: ${s.name}`);
  }
  for (const v of result.variables || []) {
    lines.push(`Var ${v.id}: ${v.name}`);
  }
  if (lines.length > 0) {
    preview.innerHTML =
      escapeHtml(text) +
      '<div class="gallery-tier-sample">' +
      lines.map((l) => escapeHtml(l)).join("<br>") +
      "</div>";
  } else {
    preview.textContent = text + " – keine Treffer.";
  }
}

function renderTierRange(tier3, tier2) {
  const card = createTierCard("range", tier3.available);
  appendTitle(card, TIER_LABELS.range);

  const desc = document.createElement("p");
  desc.className = "gallery-tier-desc";
  desc.textContent =
    "Jeder RPG-Maker-Schalter hat eine fortlaufende ID-Nummer (steht im Spielwerte-Editor in der Spalte „ID“). Diese Stufe setzt alle Schalter von ID „Von“ bis „Bis“ auf EIN – unabhängig vom Namen. Nur nutzen, wenn Stufe 2 und der Namensfilter nicht reichen.";
  card.appendChild(desc);

  if (tier2?.idRange) {
    const hint = document.createElement("p");
    hint.className = "gallery-tier-hint";
    hint.textContent = `Stufe 2 fand Galerie-Schalter bei ID ${tier2.idRange.min}–${tier2.idRange.max}.`;
    card.appendChild(hint);

    const suggestBtn = document.createElement("button");
    suggestBtn.type = "button";
    suggestBtn.className = "gallery-tier-btn-secondary";
    suggestBtn.textContent = `Vorschlag übernehmen (${tier3.suggestedRange?.min ?? tier2.idRange.min}–${tier3.suggestedRange?.max ?? tier2.idRange.max})`;
    suggestBtn.addEventListener("click", () => {
      const fromInput = $("#galleryRangeFrom");
      const toInput = $("#galleryRangeTo");
      if (fromInput && tier3.suggestedRange) {
        fromInput.value = String(tier3.suggestedRange.min);
      }
      if (toInput && tier3.suggestedRange) {
        toInput.value = String(tier3.suggestedRange.max);
      }
      updateRangePreview(tier3.totalSwitches);
    });
    card.appendChild(suggestBtn);
  }

  const from = tier3.suggestedRange?.min ?? 1;
  const to = tier3.suggestedRange?.max ?? Math.max(tier3.totalSwitches || 1, 1);

  const rangeBlock = document.createElement("div");
  rangeBlock.className = "gallery-tier-range-block";
  rangeBlock.innerHTML = `
    <div class="gallery-tier-range-field">
      <span class="gallery-tier-range-label">Schalter-ID von</span>
      <input type="number" id="galleryRangeFrom" min="1" max="${tier3.totalSwitches || 9999}" value="${from}" aria-label="Erste Schalter-ID">
    </div>
    <div class="gallery-tier-range-field">
      <span class="gallery-tier-range-label">Schalter-ID bis</span>
      <input type="number" id="galleryRangeTo" min="1" max="${tier3.totalSwitches || 9999}" value="${to}" aria-label="Letzte Schalter-ID">
    </div>
  `;
  card.appendChild(rangeBlock);

  const rangeMeta = document.createElement("p");
  rangeMeta.className = "gallery-tier-range-meta";
  rangeMeta.textContent =
    tier3.totalSwitches > 0
      ? `Das Spiel hat ${tier3.totalSwitches} Schalter-Plätze (IDs 1–${tier3.totalSwitches}).`
      : "";
  card.appendChild(rangeMeta);

  const rangePreview = document.createElement("div");
  rangePreview.id = "galleryRangePreview";
  rangePreview.className = "gallery-tier-preview";
  card.appendChild(rangePreview);

  const bindRangePreview = () => updateRangePreview(tier3.totalSwitches);
  card.addEventListener("input", (e) => {
    if (
      e.target instanceof HTMLInputElement &&
      (e.target.id === "galleryRangeFrom" || e.target.id === "galleryRangeTo")
    ) {
      bindRangePreview();
    }
  });

  const risk = document.createElement("label");
  risk.className = "gallery-tier-risk";
  const ack = document.createElement("input");
  ack.type = "checkbox";
  ack.id = "galleryRangeAck";
  const riskText = document.createElement("span");
  riskText.className = "gallery-tier-risk-text";
  riskText.textContent =
    "Ich verstehe das Risiko: Schalter außerhalb der Galerie können mit aktiviert werden.";
  risk.appendChild(ack);
  risk.appendChild(riskText);
  card.appendChild(risk);

  const btn = createApplyButton("Stufe 3 anwenden", async () => {
    const ack = $("#galleryRangeAck");
    const fromInput = $("#galleryRangeFrom");
    const toInput = $("#galleryRangeTo");
    if (!ack?.checked) {
      showGalleryStatus("Bitte die Risiko-Bestätigung ankreuzen.", "error");
      return;
    }
    const fromVal = Number(fromInput?.value);
    const toVal = Number(toInput?.value);
    if (!Number.isFinite(fromVal) || !Number.isFinite(toVal) || toVal < fromVal) {
      showGalleryStatus("Bitte einen gültigen Bereich angeben.", "error");
      return;
    }
    const confirmed = await showDialog({
      type: "confirm",
      title: "Schalter-IDs anwenden?",
      message: `Setzt alle Schalter mit ID ${fromVal} bis ${toVal} auf EIN (${toVal - fromVal + 1} Stück). Story-Flags können mit betroffen sein. Fortfahren?`,
    });
    if (!confirmed) return;
    await applyTier({ tier: "range", range: { from: fromVal, to: toVal } });
  });
  btn.disabled = !tier3.available;
  card.appendChild(btn);
  return card;
}

function updateRangePreview(totalSwitches) {
  const preview = $("#galleryRangePreview");
  const fromInput = $("#galleryRangeFrom");
  const toInput = $("#galleryRangeTo");
  if (!preview || !fromInput || !toInput) return;

  const fromVal = Number(fromInput.value);
  const toVal = Number(toInput.value);
  if (!Number.isFinite(fromVal) || !Number.isFinite(toVal) || toVal < fromVal) {
    preview.textContent = "Vorschau: Bitte gültige Schalter-IDs eingeben.";
    preview.classList.add("is-warning");
    return;
  }
  const count = toVal - fromVal + 1;
  preview.classList.remove("is-warning");
  let text = `Vorschau: ${count} Schalter (ID ${fromVal}–${toVal}) werden auf EIN gesetzt.`;
  if (totalSwitches > 0 && toVal > totalSwitches) {
    text += ` Hinweis: ID ${toVal} liegt über der bekannten Anzahl (${totalSwitches}).`;
    preview.classList.add("is-warning");
  } else if (count > 50) {
    text += " Achtung: Viele Schalter – Story-Flags können mit betroffen sein.";
    preview.classList.add("is-warning");
  }
  preview.textContent = text;
}

async function applyTier({ tier, range, nameFilter, targets }) {
  const payload = { tier };
  if (range) payload.range = range;
  if (nameFilter) payload.nameFilter = nameFilter;
  if (targets) payload.targets = targets;
  showGalleryStatus(
    `⏳ ${TIER_LABELS[tier] || tier} wird angewendet…`,
    "info",
    false,
  );
  const result = await send("unlockGallery", payload);
  if (!result) {
    showGalleryStatus("❌ Scanner nicht erreichbar.", "error");
    return;
  }
  if (result.error) {
    showGalleryStatus("❌ " + result.error, "error");
    return;
  }
  reportUnlockResult(result);
  if (lastAnalysis) {
    const fresh = await send("analyzeGallery");
    if (fresh && !fresh.error) {
      lastAnalysis = fresh;
      renderAnalysis(fresh);
    }
  }
}

function reportUnlockResult(result) {
  const errCount = Array.isArray(result.errors) ? result.errors.length : 0;
  const parts = [
    `✓ ${result.applied} freigeschaltet`,
    `${result.skipped} übersprungen`,
    `${result.total} geprüft`,
  ];
  if (errCount > 0) parts.push(`${errCount} Fehler`);
  const summary = parts.join(" · ");

  if (result.applied > 0) {
    showGalleryStatus(
      `✅ ${summary}. Galerie-Menü schließen und erneut öffnen, um die Änderung zu sehen.`,
      "success",
    );
  } else if (errCount > 0) {
    const first = result.errors[0];
    showGalleryStatus(
      `❌ ${summary}. Erster Fehler: ${first?.error || "unbekannt"}`,
      "error",
    );
  } else {
    showGalleryStatus(
      `ℹ️ ${summary}. Alle Treffer waren bereits freigeschaltet.`,
      "info",
      false,
    );
  }
}

function createTierCard(tierId, available) {
  const card = document.createElement("div");
  card.className =
    "gallery-tier " + (available ? "is-available" : "is-unavailable");
  card.dataset.tier = tierId;
  return card;
}

function appendTitle(card, text) {
  const h = document.createElement("h4");
  h.className = "gallery-tier-title";
  h.textContent = text;
  card.appendChild(h);
}

function createApplyButton(label, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "⏳ läuft…";
    try {
      await handler();
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
  });
  return btn;
}

export function updateGalleryUnlockerVisibility(isRpgMaker) {
  const group = document.getElementById("galleryUnlockerGroup");
  if (!group) return;
  group.classList.toggle("hidden", !isRpgMaker);
  if (!isRpgMaker) {
    const result = $("#galleryUnlockerResult");
    if (result) {
      result.classList.add("hidden");
      result.innerHTML = "";
    }
    hideGalleryStatus();
    lastAnalysis = null;
  }
}
