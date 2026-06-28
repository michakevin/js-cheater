/**
 * RPG Maker MV/MZ Gallery-Unlocker.
 *
 * Provides three escalation tiers to unlock gallery / CG-recall content live
 * in a running RPG Maker game. The module is intentionally pure (no DOM,
 * no chrome APIs): it accepts a `win` object that exposes the game globals
 * and returns a small API. The scanner-core inlines it via the build step
 * (`scripts/build-scanner.mjs`) and binds it to the real `window`.
 *
 * Tiers:
 *  - Tier 1 ("plugin"): try known gallery-plugin adapters (CGMZ, VisuStella,
 *    generic *Gallery objects). Safe.
 *  - Tier 2 ("switches"): set every $gameSwitch whose name matches a
 *    gallery/CG/scene keyword to true. Moderate – relies on naming.
 *  - Tier 3 ("range"): set every $gameSwitch within a user-chosen [from, to]
 *    range to true. Aggressive – can flip unrelated story flags.
 */

const GALLERY_KEYWORD_PATTERNS = [
  /\bgaller(y|ie)\b/i,
  /\bgalerie\b/i,
  /\bcg(\d+)?\b/i,
  /\brecall\b/i,
  /\brecollection\b/i,
  /\bunlock\b/i,
  /\bpicture\b/i,
  /\bszene\b/i,
  /\bscene\b/i,
  /\breplay\b/i,
  /\bmemor(y|ies)\b/i,
  /\berinnerung\b/i,
  /\bh[- ]?scene\b/i,
  /\bevent[- ]?cg\b/i,
  /回想/,
  /ギャラリー/,
];

const SCENE_FALSE_POSITIVES = [
  /scene[- ]?manager/i,
  /scene[- ]?start/i,
  /opening[- ]?scene/i,
  /title[- ]?scene/i,
];

function isGalleryName(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  if (SCENE_FALSE_POSITIVES.some((re) => re.test(name))) return false;
  return GALLERY_KEYWORD_PATTERNS.some((re) => re.test(name));
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Tier-1 plugin adapters. Each adapter is a duck-typed best-effort hook
 * around a known gallery plugin. `detect(win)` returns truthy when the
 * plugin appears installed; `unlock(win)` then attempts to unlock all
 * art listings via the plugin's own API.
 *
 * Adapters must never throw – they catch internally and report errors
 * via the returned `{ applied, errors }` shape.
 */
const PLUGIN_ADAPTERS = [
  {
    id: "cgmz-picture-gallery",
    name: "CGMZ Picture Gallery",
    detect: (win) =>
      win &&
      typeof win.$cgmzTemp !== "undefined" &&
      typeof win.$cgmzTemp.discoverPictureGalleryPicture === "function",
    unlock: (win) => {
      const ids = collectCgmzPictureIds(win);
      let applied = 0;
      const errors = [];
      for (const id of ids) {
        try {
          win.$cgmzTemp.discoverPictureGalleryPicture(id, true);
          applied += 1;
        } catch (e) {
          errors.push({ id, error: e?.message || String(e) });
        }
      }
      return { applied, candidateCount: ids.length, errors };
    },
  },
  {
    id: "visustella-cg-gallery",
    name: "VisuStella CG Gallery",
    detect: (win) => detectVisuStellaCgGallery(win),
    unlock: (win) => unlockVisuStellaCgGallery(win),
  },
  {
    id: "generic-gallery-manager",
    name: "Generic Gallery / CG Manager",
    detect: (win) => Boolean(findGenericGalleryObject(win)),
    unlock: (win) => {
      const target = findGenericGalleryObject(win);
      if (!target) {
        return { applied: 0, candidateCount: 0, errors: [] };
      }
      try {
        const fn = target.obj[target.method];
        fn.call(target.obj);
        return {
          applied: 1,
          candidateCount: 1,
          errors: [],
          note: `Aufgerufen: ${target.path}.${target.method}()`,
        };
      } catch (e) {
        return {
          applied: 0,
          candidateCount: 1,
          errors: [{ id: target.path, error: e?.message || String(e) }],
        };
      }
    },
  },
];

function collectCgmzPictureIds(win) {
  const seen = new Set();
  try {
    const tempPics = win.$cgmzTemp?._pictureGallery;
    for (const entry of asArray(tempPics)) {
      const id = entry?._id ?? entry?.id ?? entry?._name ?? entry?.name;
      if (id != null) seen.add(id);
    }
  } catch {
    /* ignore */
  }
  try {
    const cfgPics = win.$cgmz?._pictureGallery;
    for (const entry of asArray(cfgPics)) {
      const id = entry?._id ?? entry?.id ?? entry?._name ?? entry?.name;
      if (id != null) seen.add(id);
    }
  } catch {
    /* ignore */
  }
  return [...seen];
}

function detectVisuStellaCgGallery(win) {
  if (!win) return false;
  if (win.VisuMZ && (win.VisuMZ.CGGallery || win.VisuMZ.CG_Gallery)) {
    return true;
  }
  const cm = win.ConfigManager;
  if (cm && typeof cm === "object") {
    for (const key of Object.keys(cm)) {
      if (/cg/i.test(key) && /gallery|unlock/i.test(key)) return true;
    }
  }
  return false;
}

function unlockVisuStellaCgGallery(win) {
  const errors = [];
  let applied = 0;
  let candidateCount = 0;

  const cm = win.ConfigManager;
  if (cm && typeof cm === "object") {
    for (const key of Object.keys(cm)) {
      if (!/cg/i.test(key) || !/gallery|unlock/i.test(key)) continue;
      candidateCount += 1;
      try {
        const current = cm[key];
        if (Array.isArray(current)) {
          cm[key] = current.map(() => true);
          applied += 1;
        } else if (current && typeof current === "object") {
          for (const k of Object.keys(current)) {
            current[k] = true;
          }
          applied += 1;
        } else if (typeof current === "boolean") {
          cm[key] = true;
          applied += 1;
        }
      } catch (e) {
        errors.push({ id: key, error: e?.message || String(e) });
      }
    }
    if (applied > 0 && typeof cm.save === "function") {
      try {
        cm.save();
      } catch (e) {
        errors.push({ id: "ConfigManager.save", error: e?.message || String(e) });
      }
    }
  }

  return { applied, candidateCount, errors };
}

const GENERIC_GALLERY_GLOBALS = [
  "CGViewer",
  "CGViewerMZ",
  "CGGallery",
  "GalleryManager",
  "PictureGallery",
];
const GENERIC_UNLOCK_METHODS = [
  "unlockAll",
  "unlockEverything",
  "unlockAllImages",
  "unlockAllPictures",
];

function findGenericGalleryObject(win) {
  if (!win) return null;
  for (const name of GENERIC_GALLERY_GLOBALS) {
    const obj = win[name];
    if (!obj || typeof obj !== "object") continue;
    for (const method of GENERIC_UNLOCK_METHODS) {
      if (typeof obj[method] === "function") {
        return { obj, path: name, method };
      }
    }
  }
  return null;
}

function matchesNameFilter(name, id, filter) {
  const needle = filter.trim().toLowerCase();
  if (!needle) return false;
  const nameStr = String(name || "").toLowerCase();
  return nameStr.includes(needle) || String(id).includes(needle);
}

function findSwitchMatches(systemData, filter) {
  const switchNames = systemData?.switches ? asArray(systemData.switches) : [];
  const matches = [];
  for (let i = 1; i < switchNames.length; i++) {
    const name = switchNames[i];
    if (matchesNameFilter(name, i, filter)) {
      matches.push({ id: i, name: name || "" });
    }
  }
  return matches;
}

function findVariableMatches(systemData, filter) {
  const varNames = systemData?.variables ? asArray(systemData.variables) : [];
  const matches = [];
  for (let i = 1; i < varNames.length; i++) {
    const name = varNames[i];
    if (matchesNameFilter(name, i, filter)) {
      matches.push({ id: i, name: name || "" });
    }
  }
  return matches;
}

/**
 * Preview what a range or name-filter unlock would affect.
 *
 * @param {object} ctx
 * @param {{type:"range", range:{from:number,to:number}}|{type:"filter", nameFilter:string, targets?:string[]}} options
 */
export function previewGallery(ctx = {}, options = {}) {
  const systemData = resolveSystemData(ctx);

  if (options.type === "range") {
    const from = Number(options.range?.from);
    const to = Number(options.range?.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || from < 1) {
      return { error: "Ungültiger Schalter-ID-Bereich." };
    }
    return {
      type: "range",
      from: Math.floor(from),
      to: Math.floor(to),
      switchCount: Math.floor(to) - Math.floor(from) + 1,
    };
  }

  if (options.type === "filter") {
    const filter = options.nameFilter?.trim();
    if (!filter) {
      return { error: "Bitte einen Suchbegriff eingeben." };
    }
    const targets = Array.isArray(options.targets) ? options.targets : ["switches"];
    const includeSwitches = targets.includes("switches");
    const includeVariables = targets.includes("variables");
    const switchMatches = includeSwitches
      ? findSwitchMatches(systemData, filter)
      : [];
    const variableMatches = includeVariables
      ? findVariableMatches(systemData, filter)
      : [];
    return {
      type: "filter",
      nameFilter: filter,
      switchCount: switchMatches.length,
      variableCount: variableMatches.length,
      switches: switchMatches.slice(0, 15),
      variables: variableMatches.slice(0, 15),
      truncated:
        switchMatches.length > 15 || variableMatches.length > 15,
    };
  }

  return { error: "Unbekannter Vorschau-Typ." };
}

/**
 * Analyse the current game and return what each tier could do.
 *
 * @param {object} ctx
 * @param {object} ctx.win - usually `window`
 * @param {{switches?: string[]}} [ctx.systemData] - parsed System.json
 * @returns {{
 *   scannerEngineDetected: boolean,
 *   tier1: {available: boolean, adapters: Array<{id:string,name:string}>},
 *   tier2: {available: boolean, switchCount: number, totalSwitches: number, sampleNames: string[], idRange: {min:number,max:number}|null},
 *   tier3: {available: boolean, totalSwitches: number, suggestedRange: {min:number,max:number}|null, gallerySwitchIdRange: {min:number,max:number}|null},
 *   warnings: string[]
 * }}
 */
export function analyzeGallery(ctx = {}) {
  const win = ctx.win;
  const systemData = resolveSystemData(ctx);
  const warnings = [];

  if (!win) {
    return {
      scannerEngineDetected: false,
      tier1: { available: false, adapters: [] },
      tier2: {
        available: false,
        switchCount: 0,
        totalSwitches: 0,
        sampleNames: [],
        idRange: null,
      },
      tier3: { available: false, totalSwitches: 0, suggestedRange: null },
      warnings: ["Kein window-Kontext verfügbar."],
    };
  }

  const scannerEngineDetected =
    typeof win.$gameSwitches !== "undefined" &&
    typeof win.$gameVariables !== "undefined";

  if (!scannerEngineDetected) {
    warnings.push(
      "RPG Maker $gameSwitches/$gameVariables nicht gefunden. Spiel evtl. nicht geladen.",
    );
  }

  const adapters = PLUGIN_ADAPTERS.filter((adapter) => {
    try {
      return adapter.detect(win) === true;
    } catch {
      return false;
    }
  }).map(({ id, name }) => ({ id, name }));

  const switchNames = systemData?.switches ? asArray(systemData.switches) : [];
  const switchHits = [];
  for (let i = 1; i < switchNames.length; i++) {
    const name = switchNames[i];
    if (isGalleryName(name)) {
      switchHits.push({ id: i, name });
    }
  }

  const totalSwitches = Math.max(
    switchNames.length - 1,
    safeLength(win.$gameSwitches?._data) - 1,
    0,
  );

  let idRange = null;
  if (switchHits.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    for (const hit of switchHits) {
      if (hit.id < min) min = hit.id;
      if (hit.id > max) max = hit.id;
    }
    idRange = { min, max };
  }

  let suggestedRange = null;
  if (idRange) {
    suggestedRange = {
      min: Math.max(1, idRange.min - 10),
      max: Math.min(totalSwitches || idRange.max + 50, idRange.max + 50),
    };
  } else if (totalSwitches > 0) {
    suggestedRange = { min: 1, max: totalSwitches };
  }

  return {
    scannerEngineDetected,
    tier1: { available: adapters.length > 0, adapters },
    tier2: {
      available: switchHits.length > 0,
      switchCount: switchHits.length,
      totalSwitches,
      sampleNames: switchHits.slice(0, 8).map((h) => `${h.id}: ${h.name}`),
      idRange,
    },
    tier3: {
      available: totalSwitches > 0,
      totalSwitches,
      suggestedRange,
      /** ID span of Stufe-2 gallery switch hits – helps explain Stufe 3 */
      gallerySwitchIdRange: idRange,
    },
    warnings,
  };
}

function safeLength(value) {
  if (Array.isArray(value)) return value.length;
  return 0;
}

function resolveSystemData(ctx) {
  if (ctx?.systemData) return ctx.systemData;
  const win = ctx?.win;
  if (!win) return null;
  try {
    const ds = win.$dataSystem;
    if (ds && (Array.isArray(ds.switches) || Array.isArray(ds.variables))) {
      return { switches: ds.switches, variables: ds.variables };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Apply gallery unlocking for the selected tier.
 *
 * @param {object} ctx
 * @param {object} ctx.win
 * @param {{switches?: string[]}} [ctx.systemData]
 * @param {object} options
 * @param {"plugin"|"switches"|"range"|"filter"} options.tier
 * @param {{from:number,to:number}} [options.range] - required for tier "range"
 * @param {string} [options.nameFilter] - required for tier "filter"
 * @param {string[]} [options.targets] - "switches" / "variables" for tier "filter"
 * @returns {{
 *   tier:string,
 *   applied:number,
 *   skipped:number,
 *   total:number,
 *   errors:Array<{id:any,error:string}>,
 *   adapters?:Array<{id:string,name:string,applied:number,candidateCount:number,note?:string}>,
 *   needsMenuRefresh:boolean,
 * }}
 */
export function unlockGallery(ctx = {}, options = {}) {
  const win = ctx.win;
  const systemData = resolveSystemData(ctx);
  const tier = options.tier;

  if (!win) {
    return {
      tier,
      applied: 0,
      skipped: 0,
      total: 0,
      errors: [{ id: null, error: "Kein window-Kontext verfügbar." }],
      needsMenuRefresh: false,
    };
  }

  if (tier === "plugin") {
    return runPluginTier(win);
  }
  if (tier === "switches") {
    return runSwitchTier(win, systemData);
  }
  if (tier === "range") {
    return runRangeTier(win, options.range);
  }
  if (tier === "filter") {
    return runFilterTier(win, systemData, options.nameFilter, options.targets);
  }

  return {
    tier,
    applied: 0,
    skipped: 0,
    total: 0,
    errors: [{ id: null, error: `Unbekannte Stufe: ${tier}` }],
    needsMenuRefresh: false,
  };
}

function runPluginTier(win) {
  const adapters = [];
  const errors = [];
  let applied = 0;
  let candidateTotal = 0;

  for (const adapter of PLUGIN_ADAPTERS) {
    let detected = false;
    try {
      detected = adapter.detect(win) === true;
    } catch {
      detected = false;
    }
    if (!detected) continue;
    let result;
    try {
      result = adapter.unlock(win);
    } catch (e) {
      errors.push({ id: adapter.id, error: e?.message || String(e) });
      continue;
    }
    candidateTotal += result.candidateCount || 0;
    applied += result.applied || 0;
    if (Array.isArray(result.errors)) {
      for (const err of result.errors) {
        errors.push({ id: `${adapter.id}:${err.id}`, error: err.error });
      }
    }
    adapters.push({
      id: adapter.id,
      name: adapter.name,
      applied: result.applied || 0,
      candidateCount: result.candidateCount || 0,
      note: result.note,
    });
  }

  return {
    tier: "plugin",
    applied,
    skipped: Math.max(0, candidateTotal - applied),
    total: candidateTotal,
    errors,
    adapters,
    needsMenuRefresh: applied > 0,
  };
}

function runSwitchTier(win, systemData) {
  const switchNames = systemData?.switches ? asArray(systemData.switches) : [];
  const errors = [];
  const ids = [];
  for (let i = 1; i < switchNames.length; i++) {
    if (isGalleryName(switchNames[i])) ids.push(i);
  }

  if (ids.length === 0) {
    return {
      tier: "switches",
      applied: 0,
      skipped: 0,
      total: 0,
      errors: [
        { id: null, error: "Keine passenden Schalternamen gefunden." },
      ],
      needsMenuRefresh: false,
    };
  }

  return applySwitchIds(win, ids, "switches", errors);
}

function runRangeTier(win, range) {
  if (
    !range ||
    !Number.isFinite(range.from) ||
    !Number.isFinite(range.to) ||
    range.from < 1 ||
    range.to < range.from
  ) {
    return {
      tier: "range",
      applied: 0,
      skipped: 0,
      total: 0,
      errors: [{ id: null, error: "Ungültiger ID-Bereich." }],
      needsMenuRefresh: false,
    };
  }
  const ids = [];
  for (let i = Math.floor(range.from); i <= Math.floor(range.to); i++) {
    ids.push(i);
  }
  return applySwitchIds(win, ids, "range", []);
}

function runFilterTier(win, systemData, nameFilter, targets) {
  const filter = nameFilter?.trim();
  if (!filter) {
    return {
      tier: "filter",
      applied: 0,
      skipped: 0,
      total: 0,
      errors: [{ id: null, error: "Suchbegriff fehlt." }],
      needsMenuRefresh: false,
    };
  }
  const targetList = Array.isArray(targets) ? targets : ["switches"];
  const errors = [];
  let applied = 0;
  let skipped = 0;
  let total = 0;

  if (targetList.includes("switches")) {
    const matches = findSwitchMatches(systemData, filter);
    const switchResult = applySwitchIds(
      win,
      matches.map((m) => m.id),
      "filter",
      errors,
    );
    applied += switchResult.applied;
    skipped += switchResult.skipped;
    total += switchResult.total;
    if (Array.isArray(switchResult.errors)) {
      errors.push(...switchResult.errors);
    }
  }

  if (targetList.includes("variables")) {
    const varResult = applyVariableMatches(
      win,
      findVariableMatches(systemData, filter),
      errors,
    );
    applied += varResult.applied;
    skipped += varResult.skipped;
    total += varResult.total;
  }

  if (total === 0) {
    return {
      tier: "filter",
      applied: 0,
      skipped: 0,
      total: 0,
      errors: [
        ...errors,
        { id: null, error: `Keine Treffer für „${filter}".` },
      ],
      needsMenuRefresh: false,
    };
  }

  return {
    tier: "filter",
    applied,
    skipped,
    total,
    errors,
    needsMenuRefresh: applied > 0,
  };
}

function applyVariableMatches(win, matches, errors) {
  const vars = win.$gameVariables;
  if (!vars || !vars._data) {
    errors.push({
      id: null,
      error: "$gameVariables._data nicht verfügbar (Scanner aktiv?).",
    });
    return {
      applied: 0,
      skipped: 0,
      total: matches.length,
    };
  }

  let applied = 0;
  let skipped = 0;
  for (const { id } of matches) {
    try {
      const current = vars._data[id];
      const next = unlockVariableValue(current);
      if (next === null) {
        skipped += 1;
        continue;
      }
      vars._data[id] = next;
      applied += 1;
    } catch (e) {
      errors.push({ id, error: e?.message || String(e) });
    }
  }

  return { applied, skipped, total: matches.length, errors };
}

/** @returns {number|boolean|null} null = skip (already unlocked) */
function unlockVariableValue(current) {
  if (current === true) return null;
  if (typeof current === "number" && current >= 1) return null;
  if (typeof current === "boolean") return true;
  return 1;
}

function applySwitchIds(win, ids, tier, errors) {
  const sw = win.$gameSwitches;
  if (!sw || !sw._data) {
    return {
      tier,
      applied: 0,
      skipped: 0,
      total: ids.length,
      errors: [
        ...errors,
        {
          id: null,
          error: "$gameSwitches._data nicht verfügbar (Scanner aktiv?).",
        },
      ],
      needsMenuRefresh: false,
    };
  }

  let applied = 0;
  let skipped = 0;
  for (const id of ids) {
    try {
      if (sw._data[id] === true) {
        skipped += 1;
        continue;
      }
      sw._data[id] = true;
      applied += 1;
    } catch (e) {
      errors.push({ id, error: e?.message || String(e) });
    }
  }

  return {
    tier,
    applied,
    skipped,
    total: ids.length,
    errors,
    needsMenuRefresh: applied > 0,
  };
}

/* BUILD_STRIP_START */
export const __testing__ = {
  isGalleryName,
  matchesNameFilter,
  findSwitchMatches,
  findVariableMatches,
  unlockVariableValue,
  PLUGIN_ADAPTERS,
  GALLERY_KEYWORD_PATTERNS,
};
/* BUILD_STRIP_END */
