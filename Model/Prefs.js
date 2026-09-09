// Preferences for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: legacy key and mode helpers are duplicated here under
// prefs-prefixed names.

function prefsIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

var DEFAULTS = {
  version: 1,
  hidden: [],
  order: null,
  unit: "C",
  showRpm: false,
  mode: "digits",
  showDigits: true,
  wordLabels: false,
  colorMode: "auto",
  showClocks: false,
  ramFormat: "percent",
  warnUsage: 70,
  critUsage: 90,
  warnTemp: 75,
  critTemp: 90
};

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

function prefsNormalizeMode(m) {
  if (m === "digits" || m === "gauges" || m === "combo") {
    return m;
  }
  return "digits";
}

function prefsCleanStringArray(v, migrate) {
  if (!prefsIsArray((v))) {
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

function prefsCloneDefaults() {
  return {
    version: 1,
    hidden: [],
    order: null,
    unit: "C",
    showRpm: false,
    mode: "digits",
    showDigits: true,
    wordLabels: false,
    colorMode: "auto",
    showClocks: false,
    ramFormat: "percent",
    warnUsage: 70,
    critUsage: 90,
    warnTemp: 75,
    critTemp: 90
  };
}

// Parse and validate raw prefs. Corrupt input returns defaults.
function adoptPrefs(raw) {
  var out = prefsCloneDefaults();
  var src = raw;
  if (typeof src === "string") {
    try {
      src = JSON.parse(src);
    } catch (e) {
      return out;
    }
  }
  if (src === null || src === undefined) {
    return out;
  }
  if (typeof src !== "object" || prefsIsArray(src)) {
    return out;
  }

  var hidden = prefsCleanStringArray(src.hidden, true);
  if (hidden !== null) {
    out.hidden = hidden;
  }

  if (src.order === null || src.order === undefined) {
    out.order = null;
  } else {
    var order = prefsCleanStringArray(src.order, true);
    if (order !== null) {
      out.order = order;
    } else {
      out.order = null;
    }
  }

  if (src.unit === "F" || src.unit === "f") {
    out.unit = "F";
  } else {
    out.unit = "C";
  }

  if (typeof src.showRpm === "boolean") {
    out.showRpm = src.showRpm;
  }
  if (typeof src.showDigits === "boolean") {
    out.showDigits = src.showDigits;
  }
  if (typeof src.wordLabels === "boolean") {
    out.wordLabels = src.wordLabels;
  }
  if (typeof src.showClocks === "boolean") {
    out.showClocks = src.showClocks;
  }

  if (typeof src.mode === "string") {
    out.mode = prefsNormalizeMode(src.mode);
  }

  if (src.colorMode === "graphite") {
    out.colorMode = "graphite";
  } else {
    out.colorMode = "auto";
  }

  if (src.ramFormat === "used") {
    out.ramFormat = "used";
  } else {
    out.ramFormat = "percent";
  }

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

  out.version = 1;
  return out;
}

// First-run seed from a shell.json style object. Unknown keys ignored.
function seedPrefs(seed) {
  if (seed === null || seed === undefined) {
    return prefsCloneDefaults();
  }
  if (typeof seed !== "object" || prefsIsArray(seed)) {
    return prefsCloneDefaults();
  }
  return adoptPrefs(seed);
}

// Stable JSON with keys in a fixed order for deterministic files.
function serialize(prefs) {
  var p = adoptPrefs(prefs);
  var ordered = {
    version: p.version,
    hidden: p.hidden,
    order: p.order,
    unit: p.unit,
    showRpm: p.showRpm,
    mode: p.mode,
    showDigits: p.showDigits,
    wordLabels: p.wordLabels,
    colorMode: p.colorMode,
    showClocks: p.showClocks,
    ramFormat: p.ramFormat,
    warnUsage: p.warnUsage,
    critUsage: p.critUsage,
    warnTemp: p.warnTemp,
    critTemp: p.critTemp
  };
  return JSON.stringify(ordered);
}

// Map a legacy barStyle name to v1 mode plus options.
function migrateBarStyle(old) {
  var src = old;
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
  var work = {};
  var k = "";
  for (k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) {
      work[k] = src[k];
    }
  }
  // Legacy file without a version flag keeps its display fields and
  // converts barStyle. Migrate legacy metric keys in hidden and order.
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
  // Also accept legacy keys stored as bare flags, for example an old
  // hidden list is already handled above. Nothing else to rename.
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
      work.mode = "combo";
    } else if (style === "labels") {
      work.mode = "digits";
      work.wordLabels = true;
    }
    delete work.barStyle;
    delete work.bar_style;
  }
  return adoptPrefs(work);
}
