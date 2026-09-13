// Preferences for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// v2 schema: monitors are grouped (cpu/gpu/mem/net/disk/fan). Every piece
// of a group's bar cell is a "part": boolean toggles that add or remove
// what it draws, plus `quiet` (muted, never warms) against regular. Each
// group also carries its own alert thresholds and, where it applies, the
// source it reads. adoptPrefs() is the single validated entry point; it
// also upgrades a v1 (or pre-1.0 barStyle) file and the two pre-release
// drafts of v2 on first load, so there is only one public "load" path.

function prefsIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

function prefsIsObject(v) {
  return v !== null && typeof v === "object" && !prefsIsArray(v);
}

var PREFS_GROUP_IDS = ["cpu", "gpu", "mem", "net", "disk", "fan"];

// The GPU sources the collector can read (MONITOR_GPU).
var PREFS_GPU_SOURCES = ["auto", "nvidia", "amd", "intel"];

// Threshold pairs, clamped to [0, max] with warn < crit.
var PREFS_LIMITS = [
  ["warnUsage", "critUsage", 100],
  ["warnTemp", "critTemp", 150],
  ["warnRpm", "critRpm", 20000]
];

function prefsPart(toggles, quiet) {
  var out = {};
  var k = "";
  for (k in toggles) {
    if (Object.prototype.hasOwnProperty.call(toggles, k)) {
      out[k] = toggles[k];
    }
  }
  out.quiet = quiet === true;
  return out;
}

function prefsLabelPart(word) {
  return prefsPart({ icon: word !== true, word: word === true });
}

// Every group's fields, in file order, with their defaults. The toggles
// of a part follow the order its pieces draw in, left to right. mem starts
// as a word: no glyph reads as "RAM" at a glance.
function prefsGroupDefaults(id) {
  if (id === "cpu" || id === "gpu") {
    var g = { enabled: true };
    if (id === "gpu") {
      g.adapter = "auto";
    }
    g.label = prefsLabelPart(false);
    g.load = prefsPart({ bar: false, number: true });
    g.zero = prefsPart({ show: true }, true);
    g.clock = prefsPart({ show: false });
    g.temp = prefsPart({ icon: false, value: true, unit: false });
    if (id === "cpu") {
      g.avg = prefsPart({ one: false, five: false, fifteen: false });
    } else {
      g.vram = prefsPart({ bar: false, percent: false, gib: false });
      g.power = prefsPart({ show: false });
    }
    g.warnUsage = 70;
    g.critUsage = 90;
    g.warnTemp = 75;
    g.critTemp = 90;
    return g;
  }
  if (id === "mem") {
    return {
      enabled: true,
      label: prefsLabelPart(true),
      used: prefsPart({ bar: false, percent: true, gib: false }),
      zero: prefsPart({ show: true }, true),
      swap: prefsPart({ bar: false, percent: false, gib: false }),
      warnUsage: 70,
      critUsage: 90
    };
  }
  if (id === "net") {
    return {
      enabled: false,
      iface: "auto",
      label: prefsLabelPart(false),
      down: prefsPart({ icon: true, value: true }),
      up: prefsPart({ icon: true, value: true })
    };
  }
  if (id === "disk") {
    return {
      enabled: false,
      mount: "/",
      label: prefsLabelPart(false),
      used: prefsPart({ bar: false, percent: true, gib: false }),
      zero: prefsPart({ show: true }, true),
      read: prefsPart({ tag: true, value: true }),
      write: prefsPart({ tag: true, value: true }),
      warnUsage: 70,
      critUsage: 90
    };
  }
  return {
    enabled: true,
    label: prefsLabelPart(false),
    rpm: prefsPart({ value: true, unit: false }),
    showStopped: true,
    warnRpm: 4000,
    critRpm: 6000,
    hidden: [],
    order: null,
    names: {}
  };
}

function prefsCloneDefaults() {
  var groups = {};
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    groups[PREFS_GROUP_IDS[i]] = prefsGroupDefaults(PREFS_GROUP_IDS[i]);
  }
  return {
    version: 2,
    order: PREFS_GROUP_IDS.slice(),
    groups: groups,
    unit: "C",
    colorIntensity: 100,
    gaps: { icon: 2, part: 5, metric: 10 },
    refresh: 3
  };
}

var DEFAULTS = prefsCloneDefaults();

// ---------------------------------------------------------------------
// Small validators
// ---------------------------------------------------------------------

// Legacy metric keys from the pre-1.0 widget, still relevant when reading
// an old hidden/order array during the v1 upgrade below.
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
    return isFinite(v) ? v : null;
  }
  if (typeof v === "string") {
    var t = v.replace(/^\s+|\s+$/g, "");
    if (t === "") {
      return null;
    }
    var n = Number(t);
    return isFinite(n) ? n : null;
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

function prefsInt(v, lo, hi, fallback) {
  var n = prefsNum(v);
  return prefsClamp(Math.round(n === null ? fallback : n), lo, hi);
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

function prefsChoice(v, choices, fallback) {
  return choices.indexOf(v) >= 0 ? v : fallback;
}

function prefsCleanStringArray(v, migrate) {
  if (!prefsIsArray(v)) {
    return null;
  }
  var out = [];
  var i = 0;
  for (i = 0; i < v.length; i++) {
    if (typeof v[i] === "string" && v[i] !== "") {
      out.push(migrate === true ? prefsMigrateKey(v[i]) : v[i]);
    }
  }
  return out;
}

// A fan's own name: trimmed, 1 to 24 characters.
function prefsFanName(v) {
  if (typeof v !== "string") {
    return null;
  }
  var t = v.replace(/^\s+|\s+$/g, "");
  return (t.length > 0 && t.length <= 24) ? t : null;
}

function prefsFanNames(v) {
  var out = {};
  if (!prefsIsObject(v)) {
    return out;
  }
  var k = "";
  for (k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k) && k.indexOf("fan:") === 0 && prefsFanName(v[k]) !== null) {
      out[k] = prefsFanName(v[k]);
    }
  }
  return out;
}

// One part: every toggle of the default, each falling back on its own.
function prefsValidatePart(src, d) {
  var s = prefsIsObject(src) ? src : {};
  var out = {};
  var k = "";
  for (k in d) {
    if (Object.prototype.hasOwnProperty.call(d, k)) {
      out[k] = prefsBool(s[k], d[k]);
    }
  }
  return out;
}

// One group: every field falls back to that group's default, unknown
// fields drop, and the result keeps the default's field order.
function prefsValidateGroup(id, src) {
  var d = prefsGroupDefaults(id);
  var s = prefsIsObject(src) ? src : {};
  var out = {};
  var k = "";
  for (k in d) {
    if (!Object.prototype.hasOwnProperty.call(d, k)) {
      continue;
    }
    var dv = d[k];
    if (k === "adapter") {
      out.adapter = prefsChoice(s.adapter, PREFS_GPU_SOURCES, dv);
    } else if (k === "iface") {
      out.iface = (typeof s.iface === "string" && /^[^\s\/]{1,32}$/.test(s.iface)) ? s.iface : dv;
    } else if (k === "mount") {
      out.mount = (typeof s.mount === "string" && s.mount.charAt(0) === "/") ? s.mount : dv;
    } else if (k === "hidden") {
      out.hidden = prefsCleanStringArray(s.hidden, false) || [];
    } else if (k === "order") {
      out.order = (s.order === null || s.order === undefined) ? null : prefsCleanStringArray(s.order, false);
    } else if (k === "names") {
      out.names = prefsFanNames(s.names);
    } else if (typeof dv === "boolean") {
      out[k] = prefsBool(s[k], dv);
    } else if (typeof dv === "number") {
      out[k] = dv;
    } else if (prefsIsObject(dv)) {
      out[k] = prefsValidatePart(s[k], dv);
    }
  }
  var i = 0;
  for (i = 0; i < PREFS_LIMITS.length; i++) {
    var warnKey = PREFS_LIMITS[i][0];
    var critKey = PREFS_LIMITS[i][1];
    var hi = PREFS_LIMITS[i][2];
    if (Object.prototype.hasOwnProperty.call(d, warnKey)) {
      var pair = prefsFixPair(prefsInt(s[warnKey], 0, hi, d[warnKey]), prefsInt(s[critKey], 0, hi, d[critKey]), 0, hi);
      out[warnKey] = pair[0];
      out[critKey] = pair[1];
    }
  }
  return out;
}

// Unknown group ids are dropped; any group missing from the input is
// appended in the default sequence, so an upgrade never drops one.
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

// ---------------------------------------------------------------------
// Older shapes. Every older file is first read as "word" groups (one word
// per piece, the shape of the pre-release draft), then prefsFromWords()
// turns those words into parts. A word it does not know maps to nothing,
// so that part keeps its default.
// ---------------------------------------------------------------------

function prefsWordLabel(v) {
  if (v === "icon") {
    return { icon: true, word: false };
  }
  if (v === "word") {
    return { icon: false, word: true };
  }
  if (v === "none") {
    return { icon: false, word: false };
  }
  return undefined;
}

function prefsWordLoad(v) {
  if (v === "number") {
    return { bar: false, number: true };
  }
  if (v === "bar") {
    return { bar: true, number: false };
  }
  if (v === "both") {
    return { bar: true, number: true };
  }
  if (v === "off") {
    return { bar: false, number: false };
  }
  return undefined;
}

// A load word on memory or disk space: the number is a percentage, or
// the GiB pair when the old file asked for "used".
function prefsWordUsed(load, format) {
  var l = prefsWordLoad(load);
  if (l === undefined) {
    return undefined;
  }
  var gib = format === "used";
  return { bar: l.bar, percent: l.number && !gib, gib: l.number && gib };
}

function prefsWordZero(v) {
  if (v === "quiet") {
    return { show: true, quiet: true };
  }
  if (v === "normal") {
    return { show: true, quiet: false };
  }
  if (v === "hide") {
    return { show: false, quiet: true };
  }
  return undefined;
}

function prefsWordShow(v) {
  if (v === "on") {
    return { show: true, quiet: false };
  }
  if (v === "quiet") {
    return { show: true, quiet: true };
  }
  if (v === "off") {
    return { show: false, quiet: false };
  }
  return undefined;
}

function prefsWordMarked(v) {
  if (v === "icon") {
    return { icon: true, value: true };
  }
  if (v === "plain") {
    return { icon: false, value: true };
  }
  if (v === "off") {
    return { icon: false, value: false };
  }
  return undefined;
}

// One "word" group -> a partial v2 group; validation fills the rest.
function prefsFromWords(id, w) {
  var e = prefsIsObject(w) ? w : {};
  var g = {};
  var keep = ["enabled", "adapter", "hidden", "order", "warnUsage", "critUsage", "warnTemp", "critTemp"];
  var i = 0;
  for (i = 0; i < keep.length; i++) {
    if (e[keep[i]] !== undefined) {
      g[keep[i]] = e[keep[i]];
    }
  }
  g.label = prefsWordLabel(e.label);
  if (id === "cpu" || id === "gpu") {
    g.load = prefsWordLoad(e.load);
    g.zero = prefsWordZero(e.zero);
    g.clock = prefsWordShow(e.clock);
    g.temp = prefsWordMarked(e.temp);
    if (e.tempColor === "secondary") {
      g.temp = g.temp || {};
      g.temp.quiet = true;
    }
  } else if (id === "mem") {
    g.used = prefsWordUsed(e.load, e.ramFormat);
    g.zero = prefsWordZero(e.zero);
  } else if (id === "disk") {
    g.used = prefsWordUsed(e.load, "percent");
    g.zero = prefsWordZero(e.zero);
    var activity = prefsWordShow(e.activity);
    if (activity !== undefined) {
      g.read = { value: activity.show, quiet: activity.quiet };
      g.write = { value: activity.show, quiet: activity.quiet };
    }
  } else if (id === "net") {
    g.down = prefsWordMarked(e.down);
    g.up = prefsWordMarked(e.up);
  } else if (typeof e.rpmUnit === "string") {
    g.rpm = { unit: e.rpmUnit === "on" };
  }
  return g;
}

function prefsGroupsFromWords(words) {
  var groups = {};
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    groups[PREFS_GROUP_IDS[i]] = prefsFromWords(PREFS_GROUP_IDS[i], words[PREFS_GROUP_IDS[i]]);
  }
  return groups;
}

// Copy old global thresholds into every group that has them, so a user
// who tuned them before keeps the same alerts everywhere.
function prefsSeedLimits(groups, src) {
  var keys = ["warnUsage", "critUsage", "warnTemp", "critTemp"];
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    var d = prefsGroupDefaults(PREFS_GROUP_IDS[i]);
    var j = 0;
    for (j = 0; j < keys.length; j++) {
      if (Object.prototype.hasOwnProperty.call(d, keys[j]) && prefsNum(src[keys[j]]) !== null) {
        groups[PREFS_GROUP_IDS[i]][keys[j]] = src[keys[j]];
      }
    }
  }
}

// The "word" draft: groups exist and name their pieces with strings.
function prefsIsWordShape(groups) {
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    var g = groups[PREFS_GROUP_IDS[i]];
    if (prefsIsObject(g) && (typeof g.label === "string" || typeof g.load === "string")) {
      return true;
    }
  }
  return false;
}

function prefsUpgradeWords(src) {
  return {
    order: src.order,
    groups: prefsGroupsFromWords(src.groups),
    unit: src.unit,
    colorIntensity: src.colorIntensity
  };
}

// The "mode" draft: a top-level defaultMode that groups could inherit,
// one boolean per piece and global thresholds.
function prefsModeLoad(g, defaultMode) {
  if (g.showUsage === false) {
    return "off";
  }
  var mode = (g.mode === undefined || g.mode === "inherit") ? defaultMode : g.mode;
  if (mode === "gauges") {
    return "bar";
  }
  if (mode === "both") {
    return "both";
  }
  return "number";
}

function prefsUpgradeModes(src) {
  var words = {};
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    var id = PREFS_GROUP_IDS[i];
    var s = prefsIsObject(src.groups[id]) ? src.groups[id] : {};
    var w = { enabled: s.enabled, adapter: s.adapter, hidden: s.hidden, order: s.order };
    if (typeof s.label === "string") {
      w.label = s.label;
    } else if (typeof s.wordLabel === "boolean") {
      w.label = s.wordLabel ? "word" : "icon";
    }
    w.load = prefsModeLoad(s, src.defaultMode);
    w.clock = s.showClocks === true ? "on" : "off";
    w.temp = s.showTemp === false ? "off" : "plain";
    w.tempColor = s.tempColor;
    w.ramFormat = s.ramFormat;
    w.activity = s.showIo === false ? "off" : "on";
    w.rpmUnit = s.showRpm === true ? "on" : "off";
    words[id] = w;
  }
  var groups = prefsGroupsFromWords(words);
  prefsSeedLimits(groups, src);
  return {
    order: src.order,
    groups: groups,
    unit: src.unit,
    colorIntensity: src.colorIntensity
  };
}

// ---------------------------------------------------------------------
// v1 -> v2 (and, before that, the pre-1.0 barStyle shape -> v1)
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
  var hidden = prefsCleanStringArray(work.hidden, true);
  if (hidden !== null) {
    work.hidden = hidden;
  }
  var order = prefsCleanStringArray(work.order, true);
  if (order !== null) {
    work.order = order;
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
      // v1 called this look "combo": a gauge, then only the temp digits.
      work.mode = "combo";
    } else if (style === "labels") {
      work.mode = "digits";
      work.wordLabels = true;
    }
    delete work.barStyle;
    delete work.bar_style;
  }
  return work;
}

// v1 display modes -> a load word. A v1 gauge carried its usage digits
// unless showDigits was false; v1 combo drew the gauge with only the temp.
function prefsUpgradeV1Load(mode, showDigits) {
  if (mode === "gauges") {
    return showDigits === false ? "bar" : "both";
  }
  if (mode === "combo") {
    return "bar";
  }
  return "number";
}

// Flat v1 shape -> v2. Fan hidden/order entries carry over verbatim;
// cpu/gpu hidden entries switch that piece off; a hidden mem_usage
// disables memory, since memory has nothing else. The shell.json gaps
// seed the same way.
function prefsUpgradeV1ToV2(raw) {
  var v1 = prefsAncientMigrate(prefsIsObject(raw) ? raw : {});
  var hidden = prefsCleanStringArray(v1.hidden, false) || [];
  var load = prefsUpgradeV1Load(v1.mode, v1.showDigits);
  var clock = v1.showClocks === true ? "on" : "off";
  var i = 0;
  var fanHidden = [];
  for (i = 0; i < hidden.length; i++) {
    if (hidden[i].indexOf("fan:") === 0) {
      fanHidden.push(hidden[i]);
    }
  }
  var words = {
    cpu: {
      load: hidden.indexOf("cpu_usage") < 0 ? load : "off",
      temp: hidden.indexOf("cpu_temp") < 0 ? "plain" : "off",
      clock: clock
    },
    gpu: {
      load: hidden.indexOf("gpu_usage") < 0 ? load : "off",
      temp: hidden.indexOf("gpu_temp") < 0 ? "plain" : "off",
      clock: clock
    },
    mem: { enabled: hidden.indexOf("mem_usage") < 0, load: load, ramFormat: v1.ramFormat },
    net: {},
    disk: { load: load },
    fan: { rpmUnit: v1.showRpm === true ? "on" : "off", hidden: fanHidden }
  };
  // The old global wordLabels only migrates as an explicit "on": it
  // asked for words everywhere, so honor that everywhere.
  if (v1.wordLabels === true) {
    for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
      words[PREFS_GROUP_IDS[i]].label = "word";
    }
  }

  var groupOrder = [];
  var seen = {};
  var fanOrder = [];
  var v1Order = prefsCleanStringArray(v1.order, false) || [];
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
  if (fanOrder.length > 0) {
    words.fan.order = fanOrder;
  }

  var groups = prefsGroupsFromWords(words);
  prefsSeedLimits(groups, v1);
  return {
    order: groupOrder,
    groups: groups,
    unit: v1.unit,
    // The old flat "graphite" (never warm) vs "auto" (always warm) choice
    // becomes a 0-100 intensity dial: graphite maps to 0.
    colorIntensity: v1.colorMode === "graphite" ? 0 : 100,
    gaps: { icon: v1.iconGap, part: v1.partGap, metric: v1.metricGap }
  };
}

// ---------------------------------------------------------------------
// The single load path
// ---------------------------------------------------------------------

// Parse and validate raw prefs. Corrupt input returns defaults. A v1 (or
// older) file and both drafts are upgraded first, so this is the one
// entry point for prefs of any age.
function adoptPrefs(raw) {
  var src = raw;
  if (typeof src === "string") {
    try {
      src = JSON.parse(src);
    } catch (e) {
      return prefsCloneDefaults();
    }
  }
  if (!prefsIsObject(src)) {
    return prefsCloneDefaults();
  }
  if (!prefsIsObject(src.groups)) {
    src = prefsUpgradeV1ToV2(src);
  } else if (typeof src.defaultMode === "string") {
    src = prefsUpgradeModes(src);
  } else if (prefsIsWordShape(src.groups)) {
    src = prefsUpgradeWords(src);
  }

  var out = prefsCloneDefaults();
  out.order = prefsValidateOrder(src.order);
  var i = 0;
  for (i = 0; i < PREFS_GROUP_IDS.length; i++) {
    out.groups[PREFS_GROUP_IDS[i]] = prefsValidateGroup(PREFS_GROUP_IDS[i], src.groups[PREFS_GROUP_IDS[i]]);
  }
  out.unit = (src.unit === "F" || src.unit === "f") ? "F" : "C";
  out.colorIntensity = prefsInt(src.colorIntensity, 0, 100, 100);
  var gaps = prefsIsObject(src.gaps) ? src.gaps : {};
  out.gaps = {
    icon: prefsInt(gaps.icon, 0, 20, 2),
    part: prefsInt(gaps.part, 0, 20, 5),
    metric: prefsInt(gaps.metric, 0, 40, 10)
  };
  out.refresh = prefsInt(src.refresh, 1, 10, 3);
  return out;
}

// First-run seed from a shell.json style object. Unknown keys ignored.
// shell.json still seeds the old flat v1 fields; adoptPrefs upgrades them.
function seedPrefs(seed) {
  if (!prefsIsObject(seed)) {
    return prefsCloneDefaults();
  }
  return adoptPrefs(seed);
}

// Stable JSON with keys in a fixed order for deterministic files. The
// validated groups already follow the defaults' field order.
function serialize(prefs) {
  var p = adoptPrefs(prefs);
  return JSON.stringify({
    version: p.version,
    order: p.order,
    groups: p.groups,
    unit: p.unit,
    colorIntensity: p.colorIntensity,
    gaps: p.gaps,
    refresh: p.refresh
  });
}
