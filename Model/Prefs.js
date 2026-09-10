// Preferences for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// v2 schema: monitors are grouped (cpu/gpu/mem/net/disk/fan), each with its
// own enable switch and display config, replacing v1's flat hidden/order/
// mode. adoptPrefs() is the single validated entry point everything else
// goes through; it also transparently upgrades a v1 (or pre-1.0 barStyle)
// file on first load, so there is only one public "load" path.

function prefsIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

var PREFS_GROUP_IDS = ["cpu", "gpu", "mem", "net", "disk", "fan"];

// wordLabel: false draws that group's Nerd Font glyph; true spells its
// short label out as text instead (no icon guessing needed for a device
// nothing depicts well — mem starts as a word for exactly that reason).
// tempColor exists only on cpu/gpu (the only groups with a temp half):
// "primary" lets it warm with severity like usage does; "secondary"
// always renders it in the theme's quieter secondary color instead.
var PREFS_GROUP_DEFAULTS = {
  cpu: { enabled: true, mode: "inherit", showUsage: true, showTemp: true, showClocks: false, wordLabel: false, tempColor: "primary" },
  gpu: { enabled: true, mode: "inherit", adapter: "auto", showUsage: true, showTemp: true, showClocks: false, wordLabel: false, tempColor: "primary" },
  mem: { enabled: true, mode: "inherit", ramFormat: "percent", wordLabel: true },
  net: { enabled: false, mode: "inherit", wordLabel: false },
  disk: { enabled: false, mode: "inherit", showUsage: true, showIo: true, wordLabel: false },
  fan: { enabled: true, showRpm: false, hidden: [], order: null, wordLabel: false }
};

function prefsCloneGroupDefaults(id) {
  var d = PREFS_GROUP_DEFAULTS[id];
  var out = {};
  var k = "";
  for (k in d) {
    if (Object.prototype.hasOwnProperty.call(d, k)) {
      out[k] = d[k];
    }
  }
  if (prefsIsArray(out.hidden)) {
    out.hidden = out.hidden.slice();
  }
  return out;
}

function prefsCloneAllGroupDefaults() {
  var out = {};
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    out[PREFS_GROUP_IDS[i]] = prefsCloneGroupDefaults(PREFS_GROUP_IDS[i]);
  }
  return out;
}

function prefsCloneDefaults() {
  return {
    version: 2,
    order: PREFS_GROUP_IDS.slice(),
    defaultMode: "digits",
    groups: prefsCloneAllGroupDefaults(),
    unit: "C",
    showDigits: true,
    colorIntensity: 100,
    warnUsage: 70,
    critUsage: 90,
    warnTemp: 75,
    critTemp: 90
  };
}

var DEFAULTS = prefsCloneDefaults();

// Legacy metric keys from the pre-1.0 widget, still relevant when reading
// an old hidden/order array during the v1-shape upgrade below.
var PREFS_LEGACY_KEYS = {
  cpu: "cpu_usage",
  temp: "cpu_temp",
  mem: "mem_usage"
};

function prefsMigrateKey(k) {
  if (k === null || k === undefined) {
    return k;
  }
  var s = String(k);
  if (Object.prototype.hasOwnProperty.call(PREFS_LEGACY_KEYS, s)) {
    return PREFS_LEGACY_KEYS[s];
  }
  return s;
}

function prefsNum(v) {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "number") {
    if (isFinite(v)) {
      return v;
    }
    return null;
  }
  if (typeof v === "string") {
    var t = v.replace(/^\s+|\s+$/g, "");
    if (t === "") {
      return null;
    }
    var n = Number(t);
    if (isFinite(n)) {
      return n;
    }
    return null;
  }
  return null;
}

function prefsBool(v, fallback) {
  return (typeof v === "boolean") ? v : fallback;
}

function prefsClamp(v, lo, hi) {
  if (v < lo) {
    return lo;
  }
  if (v > hi) {
    return hi;
  }
  return v;
}

// Enforce warn < crit by narrowing. Both inputs are already clamped.
function prefsFixPair(warn, crit, lo, hi) {
  var w = warn;
  var c = crit;
  if (w >= c) {
    w = c - 1;
    if (w < lo) {
      w = lo;
      c = lo + 1;
      if (c > hi) {
        c = hi;
      }
    }
  }
  return [w, c];
}

// The GLOBAL fallback mode a group uses when its own mode is "inherit".
// Only "digits" (Number) or "gauges" (Bar) — pairing a device's usage
// and temp (or down/up, usage/io) halves into one cell is unconditional
// now (see Styles/Modes.js), so there is no third "combo" mode to pick.
function prefsNormalizeDefaultMode(m) {
  if (m === "digits" || m === "gauges") {
    return m;
  }
  return "digits";
}

// A group's own mode: "inherit" defers to defaultMode.
function prefsNormalizeGroupMode(m) {
  if (m === "inherit" || m === "digits" || m === "gauges") {
    return m;
  }
  return "inherit";
}

function prefsCleanStringArray(v, migrate) {
  if (!prefsIsArray(v)) {
    return null;
  }
  var out = [];
  var i = 0;
  for (i = 0; i < v.length; i++) {
    if (typeof v[i] === "string" && v[i] !== "") {
      if (migrate === true) {
        out.push(prefsMigrateKey(v[i]));
      } else {
        out.push(v[i]);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// v1 -> v2 upgrade (and, before that, the pre-1.0 barStyle shape -> v1)
// ---------------------------------------------------------------------

function prefsGroupOfMetricKey(key) {
  if (key === "cpu_usage" || key === "cpu_temp") {
    return "cpu";
  }
  if (key === "gpu_usage" || key === "gpu_temp") {
    return "gpu";
  }
  if (key === "mem_usage") {
    return "mem";
  }
  if (typeof key === "string" && key.indexOf("fan:") === 0) {
    return "fan";
  }
  return null;
}

// Pre-1.0 shape -> flat v1 shape: legacy metric-key renames in hidden/
// order, and the old barStyle string mapped to mode/showDigits/wordLabels.
function prefsAncientMigrate(src) {
  var work = {};
  var k = "";
  for (k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) {
      work[k] = src[k];
    }
  }
  if (prefsIsArray(work.hidden)) {
    var migratedHidden = [];
    var i = 0;
    for (i = 0; i < work.hidden.length; i++) {
      if (typeof work.hidden[i] === "string") {
        migratedHidden.push(prefsMigrateKey(work.hidden[i]));
      }
    }
    work.hidden = migratedHidden;
  }
  if (prefsIsArray(work.order)) {
    var migratedOrder = [];
    var j = 0;
    for (j = 0; j < work.order.length; j++) {
      if (typeof work.order[j] === "string") {
        migratedOrder.push(prefsMigrateKey(work.order[j]));
      }
    }
    work.order = migratedOrder;
  }
  var style = null;
  if (typeof work.barStyle === "string") {
    style = work.barStyle;
  } else if (typeof work.bar_style === "string") {
    style = work.bar_style;
  }
  if (style !== null) {
    if (style === "numbers") {
      work.mode = "digits";
    } else if (style === "bars") {
      work.mode = "gauges";
      work.showDigits = false;
    } else if (style === "bars+digits") {
      work.mode = "gauges";
      work.showDigits = true;
    } else if (style === "bar+temp") {
      // The old dedicated "joined bar+temp" mode is just "Bar" now —
      // pairing a device's usage and temp halves is unconditional, so
      // Bar mode alone already reproduces what this style asked for.
      work.mode = "gauges";
    } else if (style === "labels") {
      work.mode = "digits";
      work.wordLabels = true;
    }
    delete work.barStyle;
    delete work.bar_style;
  }
  return work;
}

// Flat v1 shape -> v2 group shape. Fan hidden/order entries carry over
// verbatim (nested under groups.fan); cpu/gpu hidden entries become their
// showUsage/showTemp sub-toggles; a hidden mem_usage becomes groups.mem
// disabled outright, since memory has no sub-metric to narrow instead.
function prefsUpgradeV1ToV2(raw) {
  var v1 = prefsAncientMigrate((raw && typeof raw === "object" && !prefsIsArray(raw)) ? raw : {});
  var hidden = prefsCleanStringArray(v1.hidden, false);
  if (hidden === null) {
    hidden = [];
  }
  var groups = prefsCloneAllGroupDefaults();

  groups.cpu.showUsage = hidden.indexOf("cpu_usage") < 0;
  groups.cpu.showTemp = hidden.indexOf("cpu_temp") < 0;
  groups.cpu.showClocks = v1.showClocks === true;
  groups.gpu.showUsage = hidden.indexOf("gpu_usage") < 0;
  groups.gpu.showTemp = hidden.indexOf("gpu_temp") < 0;
  groups.gpu.showClocks = v1.showClocks === true;
  groups.mem.enabled = hidden.indexOf("mem_usage") < 0;
  // The old global wordLabels only migrates as an explicit "on": it was
  // requesting words everywhere, so honor that everywhere (mem included).
  // Left alone (false/absent), each group keeps its own default instead —
  // mem still starts as a word regardless, cpu/gpu/net/disk/fan as icons.
  if (v1.wordLabels === true) {
    groups.cpu.wordLabel = true;
    groups.gpu.wordLabel = true;
    groups.mem.wordLabel = true;
    groups.net.wordLabel = true;
    groups.disk.wordLabel = true;
    groups.fan.wordLabel = true;
  }
  if (typeof v1.ramFormat === "string") {
    groups.mem.ramFormat = (v1.ramFormat === "used") ? "used" : "percent";
  }
  if (typeof v1.showRpm === "boolean") {
    groups.fan.showRpm = v1.showRpm;
  }

  var fanHidden = [];
  var i = 0;
  for (i = 0; i < hidden.length; i++) {
    if (hidden[i].indexOf("fan:") === 0) {
      fanHidden.push(hidden[i]);
    }
  }
  groups.fan.hidden = fanHidden;

  var groupOrder = [];
  var seen = {};
  var v1Order = prefsCleanStringArray(v1.order, true);
  var fanOrder = [];
  if (v1Order !== null) {
    for (i = 0; i < v1Order.length; i++) {
      var g = prefsGroupOfMetricKey(v1Order[i]);
      if (g === "fan") {
        fanOrder.push(v1Order[i]);
      }
      if (g !== null && !seen[g]) {
        groupOrder.push(g);
        seen[g] = true;
      }
    }
  }
  if (fanOrder.length > 0) {
    groups.fan.order = fanOrder;
  }

  return {
    version: 2,
    order: groupOrder,
    defaultMode: (typeof v1.mode === "string") ? v1.mode : "digits",
    groups: groups,
    unit: v1.unit,
    showDigits: v1.showDigits,
    // The old flat "graphite" (never warm) vs "auto" (always warm) choice
    // becomes a 0-100 intensity dial: graphite maps to 0, everything else
    // (including the "auto" default) to full intensity.
    colorIntensity: v1.colorMode === "graphite" ? 0 : 100,
    warnUsage: v1.warnUsage,
    critUsage: v1.critUsage,
    warnTemp: v1.warnTemp,
    critTemp: v1.critTemp
  };
}

// ---------------------------------------------------------------------
// v2 validation
// ---------------------------------------------------------------------

// "primary" lets a temp reading warm with severity like usage does;
// "secondary" always renders it in the theme's quieter secondary color.
function prefsTempColor(v, fallback) {
  if (v === "primary" || v === "secondary") {
    return v;
  }
  return fallback;
}

function prefsValidateGroupCpu(src) {
  var d = prefsCloneGroupDefaults("cpu");
  var s = (src && typeof src === "object" && !prefsIsArray(src)) ? src : {};
  return {
    enabled: prefsBool(s.enabled, d.enabled),
    mode: prefsNormalizeGroupMode(s.mode),
    showUsage: prefsBool(s.showUsage, d.showUsage),
    showTemp: prefsBool(s.showTemp, d.showTemp),
    showClocks: prefsBool(s.showClocks, d.showClocks),
    wordLabel: prefsBool(s.wordLabel, d.wordLabel),
    tempColor: prefsTempColor(s.tempColor, d.tempColor)
  };
}

function prefsValidateGroupGpu(src) {
  var d = prefsCloneGroupDefaults("gpu");
  var s = (src && typeof src === "object" && !prefsIsArray(src)) ? src : {};
  return {
    enabled: prefsBool(s.enabled, d.enabled),
    mode: prefsNormalizeGroupMode(s.mode),
    adapter: (typeof s.adapter === "string" && s.adapter !== "") ? s.adapter : d.adapter,
    showUsage: prefsBool(s.showUsage, d.showUsage),
    showTemp: prefsBool(s.showTemp, d.showTemp),
    showClocks: prefsBool(s.showClocks, d.showClocks),
    wordLabel: prefsBool(s.wordLabel, d.wordLabel),
    tempColor: prefsTempColor(s.tempColor, d.tempColor)
  };
}

function prefsValidateGroupMem(src) {
  var d = prefsCloneGroupDefaults("mem");
  var s = (src && typeof src === "object" && !prefsIsArray(src)) ? src : {};
  return {
    enabled: prefsBool(s.enabled, d.enabled),
    mode: prefsNormalizeGroupMode(s.mode),
    ramFormat: (s.ramFormat === "used") ? "used" : "percent",
    wordLabel: prefsBool(s.wordLabel, d.wordLabel)
  };
}

function prefsValidateGroupNet(src) {
  var d = prefsCloneGroupDefaults("net");
  var s = (src && typeof src === "object" && !prefsIsArray(src)) ? src : {};
  return {
    enabled: prefsBool(s.enabled, d.enabled),
    mode: prefsNormalizeGroupMode(s.mode),
    wordLabel: prefsBool(s.wordLabel, d.wordLabel)
  };
}

function prefsValidateGroupDisk(src) {
  var d = prefsCloneGroupDefaults("disk");
  var s = (src && typeof src === "object" && !prefsIsArray(src)) ? src : {};
  return {
    enabled: prefsBool(s.enabled, d.enabled),
    mode: prefsNormalizeGroupMode(s.mode),
    showUsage: prefsBool(s.showUsage, d.showUsage),
    showIo: prefsBool(s.showIo, d.showIo),
    wordLabel: prefsBool(s.wordLabel, d.wordLabel)
  };
}

function prefsValidateGroupFan(src) {
  var d = prefsCloneGroupDefaults("fan");
  var s = (src && typeof src === "object" && !prefsIsArray(src)) ? src : {};
  var hidden = prefsCleanStringArray(s.hidden, false);
  var order = null;
  if (s.order !== null && s.order !== undefined) {
    var cleanedOrder = prefsCleanStringArray(s.order, false);
    if (cleanedOrder !== null) {
      order = cleanedOrder;
    }
  }
  return {
    enabled: prefsBool(s.enabled, d.enabled),
    showRpm: prefsBool(s.showRpm, d.showRpm),
    hidden: (hidden !== null) ? hidden : [],
    order: order,
    wordLabel: prefsBool(s.wordLabel, d.wordLabel)
  };
}

function prefsValidateGroups(src) {
  var s = (src && typeof src === "object" && !prefsIsArray(src)) ? src : {};
  return {
    cpu: prefsValidateGroupCpu(s.cpu),
    gpu: prefsValidateGroupGpu(s.gpu),
    mem: prefsValidateGroupMem(s.mem),
    net: prefsValidateGroupNet(s.net),
    disk: prefsValidateGroupDisk(s.disk),
    fan: prefsValidateGroupFan(s.fan)
  };
}

// Unknown group ids are dropped; any group missing from the input is
// appended in the default sequence, so a version upgrade never drops one.
function prefsValidateOrder(order) {
  var out = [];
  var seen = {};
  var i = 0;
  if (prefsIsArray(order)) {
    for (i = 0; i < order.length; i++) {
      var id = order[i];
      if (typeof id === "string" && PREFS_GROUP_IDS.indexOf(id) >= 0 && !seen[id]) {
        out.push(id);
        seen[id] = true;
      }
    }
  }
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    if (!seen[PREFS_GROUP_IDS[i]]) {
      out.push(PREFS_GROUP_IDS[i]);
    }
  }
  return out;
}

// Parse and validate raw prefs. Corrupt input returns defaults. A v1 (or
// pre-1.0) file is upgraded transparently before validation, so this is
// the single entry point for loading prefs from disk at any age.
function adoptPrefs(raw) {
  var src = raw;
  if (typeof src === "string") {
    try {
      src = JSON.parse(src);
    } catch (e) {
      return prefsCloneDefaults();
    }
  }
  if (src === null || src === undefined) {
    return prefsCloneDefaults();
  }
  if (typeof src !== "object" || prefsIsArray(src)) {
    return prefsCloneDefaults();
  }

  if (!src.groups || typeof src.groups !== "object" || prefsIsArray(src.groups)) {
    src = prefsUpgradeV1ToV2(src);
  }

  var out = prefsCloneDefaults();
  out.order = prefsValidateOrder(src.order);
  out.defaultMode = prefsNormalizeDefaultMode(src.defaultMode);
  out.groups = prefsValidateGroups(src.groups);

  if (src.unit === "F" || src.unit === "f") {
    out.unit = "F";
  } else {
    out.unit = "C";
  }
  if (typeof src.showDigits === "boolean") {
    out.showDigits = src.showDigits;
  }
  var ci = prefsNum(src.colorIntensity);
  if (ci === null) {
    // A file still carrying the old graphite/auto flag migrates the same
    // way prefsUpgradeV1ToV2 does, so adoptPrefs alone (without going
    // through the v1 path) still honors it.
    ci = src.colorMode === "graphite" ? 0 : 100;
  }
  out.colorIntensity = prefsClamp(Math.round(ci), 0, 100);

  var wu = prefsNum(src.warnUsage);
  var cu = prefsNum(src.critUsage);
  if (wu === null) {
    wu = 70;
  }
  if (cu === null) {
    cu = 90;
  }
  wu = prefsClamp(Math.round(wu), 0, 100);
  cu = prefsClamp(Math.round(cu), 0, 100);
  var fixedU = prefsFixPair(wu, cu, 0, 100);
  out.warnUsage = fixedU[0];
  out.critUsage = fixedU[1];

  var wt = prefsNum(src.warnTemp);
  var ct = prefsNum(src.critTemp);
  if (wt === null) {
    wt = 75;
  }
  if (ct === null) {
    ct = 90;
  }
  wt = prefsClamp(Math.round(wt), 0, 150);
  ct = prefsClamp(Math.round(ct), 0, 150);
  var fixedT = prefsFixPair(wt, ct, 0, 150);
  out.warnTemp = fixedT[0];
  out.critTemp = fixedT[1];

  out.version = 2;
  return out;
}

// First-run seed from a shell.json style object. Unknown keys ignored.
// shell.json still seeds the old flat fields (hidden/mode/...); adoptPrefs
// upgrades that shape automatically, so this needs no v2-specific logic.
function seedPrefs(seed) {
  if (seed === null || seed === undefined) {
    return prefsCloneDefaults();
  }
  if (typeof seed !== "object" || prefsIsArray(seed)) {
    return prefsCloneDefaults();
  }
  return adoptPrefs(seed);
}

function prefsSerializeGroup(id, g) {
  if (id === "cpu") {
    return { enabled: g.enabled, mode: g.mode, showUsage: g.showUsage, showTemp: g.showTemp, showClocks: g.showClocks, wordLabel: g.wordLabel, tempColor: g.tempColor };
  }
  if (id === "gpu") {
    return { enabled: g.enabled, mode: g.mode, adapter: g.adapter, showUsage: g.showUsage, showTemp: g.showTemp, showClocks: g.showClocks, wordLabel: g.wordLabel, tempColor: g.tempColor };
  }
  if (id === "mem") {
    return { enabled: g.enabled, mode: g.mode, ramFormat: g.ramFormat, wordLabel: g.wordLabel };
  }
  if (id === "net") {
    return { enabled: g.enabled, mode: g.mode, wordLabel: g.wordLabel };
  }
  if (id === "disk") {
    return { enabled: g.enabled, mode: g.mode, showUsage: g.showUsage, showIo: g.showIo, wordLabel: g.wordLabel };
  }
  return { enabled: g.enabled, showRpm: g.showRpm, hidden: g.hidden, order: g.order, wordLabel: g.wordLabel };
}

// Stable JSON with keys in a fixed order for deterministic files.
function serialize(prefs) {
  var p = adoptPrefs(prefs);
  var groupsOut = {};
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    var id = PREFS_GROUP_IDS[i];
    groupsOut[id] = prefsSerializeGroup(id, p.groups[id]);
  }
  var ordered = {
    version: p.version,
    order: p.order,
    defaultMode: p.defaultMode,
    groups: groupsOut,
    unit: p.unit,
    showDigits: p.showDigits,
    colorIntensity: p.colorIntensity,
    warnUsage: p.warnUsage,
    critUsage: p.critUsage,
    warnTemp: p.warnTemp,
    critTemp: p.critTemp
  };
  return JSON.stringify(ordered);
}
