// Metric catalog for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: every helper used here is defined in this file under a
// metrics-prefixed name, so loading order does not matter.

// Nerd Font glyphs by device, picked from ranges confirmed (by actually
// rendering a live sample under this project's own font stack) to exist
// in `ttf-jetbrains-mono-nerd-basic`, the Nerd Font installed on target
// systems: microchip U+F2DB (cpu), thermometer_half U+F2C9 (temp),
// desktop U+F108 (gpu), spinner U+F110 (fan), wifi U+F1EB (net),
// hdd_o U+F0A0 (disk), arrow_down U+F063 and arrow_up U+F062 (net down
// and up) — all classic FontAwesome 4 (U+F000-U+F2FF);
// memory U+EFC5 ("fa-memory", FontAwesome6's dedicated RAM-stick icon)
// for mem — two earlier attempts (MDI "memory" U+F035B, a server-rack
// stand-in U+F233) both read as "not RAM" and were dropped; built via
// `String.fromCodePoint` since none of these fit a single UTF-16 code
// unit. RAM still defaults to a word label (see Prefs.js), so this icon
// only shows once a user explicitly switches that group to Icon.
// Verify any new glyph the same way (render it, don't assume the range)
// before adding it — this font's supported ranges aren't contiguous.
function metricsIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

var GLYPH = {
  cpu: "",
  temp: "",
  gpu: "",
  mem: String.fromCodePoint(0xEFC5),
  down: "",
  up: "",
  fan: "",
  net: "",
  disk: ""
};

// Short, English, menu-card labels per monitor group (SPEC section 9:
// English everywhere in UI). Order here is cosmetic only — actual card
// order comes from prefs.order.
var GROUP_LABELS = {
  cpu: "CPU",
  gpu: "GPU",
  mem: "RAM",
  net: "Net",
  disk: "Disk",
  fan: "Fans"
};

// Empty reading. Every schema field is present, values are null
// except the schema version and the fan list.
var EMPTY = {
  schema: 2,
  cpu: null,
  temp: null,
  mem: null,
  gpu: null,
  gpu_temp: null,
  fans: [],
  cpu_mhz: null,
  gpu_mhz: null,
  mem_used_kib: null,
  mem_total_kib: null,
  swap_used_kib: null,
  swap_total_kib: null,
  cpu_model: null,
  cpu_cores: null,
  load: null,
  gpu_detail: null,
  net: null,
  disk: null,
  gpu_source: null,
  gpu_sources: []
};

function metricsNum(v) {
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

function metricsStr(v) {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "string") {
    var t = v.replace(/^\s+|\s+$/g, "");
    if (t === "") {
      return null;
    }
    return t;
  }
  if (typeof v === "number") {
    if (isFinite(v)) {
      return String(v);
    }
    return null;
  }
  return null;
}

// A fresh EMPTY, its lists new, so no caller can change EMPTY itself.
function metricsCloneEmpty() {
  var out = {};
  var k = "";
  for (k in EMPTY) {
    if (Object.prototype.hasOwnProperty.call(EMPTY, k)) {
      out[k] = metricsIsArray(EMPTY[k]) ? [] : EMPTY[k];
    }
  }
  return out;
}

// A list of non-empty strings, or [] for anything else.
function metricsStrList(v) {
  var out = [];
  if (!metricsIsArray(v)) {
    return out;
  }
  var i = 0;
  for (i = 0; i < v.length; i++) {
    var s = metricsStr(v[i]);
    if (s !== null && typeof v[i] === "string") {
      out.push(s);
    }
  }
  return out;
}

function metricsParseLoad(v) {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v !== "object" || metricsIsArray(v)) {
    return null;
  }
  var one = metricsNum(v.one);
  var five = metricsNum(v.five);
  var fifteen = metricsNum(v.fifteen);
  if (one === null && five === null && fifteen === null) {
    return null;
  }
  return { one: one, five: five, fifteen: fifteen };
}

function metricsParseGpuDetail(v) {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v !== "object" || metricsIsArray(v)) {
    return null;
  }
  var used = metricsNum(v.vram_used_b);
  var total = metricsNum(v.vram_total_b);
  var watts = metricsNum(v.watts);
  if (used === null && total === null && watts === null) {
    return null;
  }
  return { vram_used_b: used, vram_total_b: total, watts: watts };
}

function metricsParseNet(v) {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v !== "object" || metricsIsArray(v)) {
    return null;
  }
  var iface = metricsStr(v.iface);
  if (iface === null) {
    return null;
  }
  return {
    iface: iface,
    ifaces: metricsStrList(v.ifaces),
    down_bps: metricsNum(v.down_bps),
    up_bps: metricsNum(v.up_bps)
  };
}

function metricsParseDisk(v) {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v !== "object" || metricsIsArray(v)) {
    return null;
  }
  var mount = metricsStr(v.mount);
  var usedPct = metricsNum(v.used_pct);
  var readBps = metricsNum(v.read_bps);
  var writeBps = metricsNum(v.write_bps);
  if (mount === null && usedPct === null && readBps === null && writeBps === null) {
    return null;
  }
  return {
    mount: mount,
    mounts: metricsStrList(v.mounts),
    used_pct: usedPct,
    used_b: metricsNum(v.used_b),
    total_b: metricsNum(v.total_b),
    read_bps: readBps,
    write_bps: writeBps
  };
}

function metricsParseFan(entry, index) {
  if (entry === null || entry === undefined) {
    return null;
  }
  if (typeof entry !== "object" || metricsIsArray(entry)) {
    return null;
  }
  var chip = metricsStr(entry.chip);
  var label = metricsStr(entry.label);
  var id = metricsStr(entry.id);
  var rpm = metricsNum(entry.rpm);
  if (id === null) {
    if (chip !== null && label !== null) {
      id = chip + "/" + label;
    } else if (chip !== null) {
      id = chip + "/fan" + String(index + 1);
    } else if (label !== null) {
      id = label;
    } else {
      id = "fan" + String(index + 1);
    }
  }
  if (chip === null) {
    var slash = id.indexOf("/");
    if (slash > 0) {
      chip = id.substring(0, slash);
    }
  }
  if (label === null) {
    var tail = id;
    var pos = id.indexOf("/");
    if (pos >= 0) {
      tail = id.substring(pos + 1);
    }
    var digits = tail.replace(/[^0-9]/g, "");
    if (digits !== "") {
      label = "Fan " + digits.replace(/^0+/, "") ;
      if (label === "Fan ") {
        label = "Fan " + digits;
      }
    } else {
      label = "Fan " + String(index + 1);
    }
  }
  return { id: id, chip: chip, label: label, rpm: rpm };
}

function metricsParseFans(v) {
  if (!metricsIsArray((v))) {
    return [];
  }
  var out = [];
  var i = 0;
  for (i = 0; i < v.length; i++) {
    var f = metricsParseFan(v[i], i);
    if (f !== null) {
      out.push(f);
    }
  }
  return out;
}

// Parse one collector JSON line into a sanitized reading.
// Garbage input returns a fresh EMPTY reading. Never throws.
function parse(line) {
  var obj = null;
  if (typeof line === "string") {
    var t = line.replace(/^\s+|\s+$/g, "");
    if (t === "") {
      return metricsCloneEmpty();
    }
    try {
      obj = JSON.parse(t);
    } catch (e) {
      return metricsCloneEmpty();
    }
  } else if (line !== null && typeof line === "object" && !metricsIsArray((line))) {
    obj = line;
  } else {
    return metricsCloneEmpty();
  }
  var out = metricsCloneEmpty();
  var schema = metricsNum(obj.schema);
  if (schema !== null) {
    out.schema = Math.round(schema);
  }
  out.cpu = metricsNum(obj.cpu);
  out.temp = metricsNum(obj.temp);
  out.mem = metricsNum(obj.mem);
  out.gpu = metricsNum(obj.gpu);
  out.gpu_temp = metricsNum(obj.gpu_temp);
  out.cpu_mhz = metricsNum(obj.cpu_mhz);
  out.gpu_mhz = metricsNum(obj.gpu_mhz);
  out.mem_used_kib = metricsNum(obj.mem_used_kib);
  out.mem_total_kib = metricsNum(obj.mem_total_kib);
  out.swap_used_kib = metricsNum(obj.swap_used_kib);
  out.swap_total_kib = metricsNum(obj.swap_total_kib);
  out.cpu_model = metricsStr(obj.cpu_model);
  var cores = metricsNum(obj.cpu_cores);
  if (cores !== null) {
    out.cpu_cores = Math.round(cores);
  }
  out.load = metricsParseLoad(obj.load);
  out.gpu_detail = metricsParseGpuDetail(obj.gpu_detail);
  out.net = metricsParseNet(obj.net);
  out.disk = metricsParseDisk(obj.disk);
  out.fans = metricsParseFans(obj.fans);
  out.gpu_source = metricsStr(obj.gpu_source);
  out.gpu_sources = metricsStrList(obj.gpu_sources);
  return out;
}

// True when the reading carries at least one usable value.
function hasReading(r) {
  if (r === null || r === undefined) {
    return false;
  }
  if (typeof r !== "object" || metricsIsArray(r)) {
    return false;
  }
  if (r.cpu !== null && r.cpu !== undefined) {
    return true;
  }
  if (r.temp !== null && r.temp !== undefined) {
    return true;
  }
  if (r.mem !== null && r.mem !== undefined) {
    return true;
  }
  if (r.gpu !== null && r.gpu !== undefined) {
    return true;
  }
  if (r.gpu_temp !== null && r.gpu_temp !== undefined) {
    return true;
  }
  if (r.cpu_mhz !== null && r.cpu_mhz !== undefined) {
    return true;
  }
  if (r.gpu_mhz !== null && r.gpu_mhz !== undefined) {
    return true;
  }
  if (r.mem_used_kib !== null && r.mem_used_kib !== undefined) {
    return true;
  }
  if (r.mem_total_kib !== null && r.mem_total_kib !== undefined) {
    return true;
  }
  if (r.load !== null && r.load !== undefined) {
    return true;
  }
  if (r.gpu_detail !== null && r.gpu_detail !== undefined) {
    return true;
  }
  if (r.net !== null && r.net !== undefined) {
    return true;
  }
  if (r.disk !== null && r.disk !== undefined) {
    return true;
  }
  if (metricsIsArray(r.fans) && r.fans.length > 0) {
    return true;
  }
  return false;
}

// Display labels for fans. Duplicate base labels get " (<chip>)".
// Returns an array in input order and also maps id to label.
function fanLabels(fans) {
  var out = [];
  if (!metricsIsArray((fans)) || fans.length === 0) {
    return out;
  }
  var base = [];
  var counts = {};
  var i = 0;
  for (i = 0; i < fans.length; i++) {
    var f = fans[i];
    var label = null;
    if (f && typeof f === "object") {
      label = metricsStr(f.label);
    }
    if (label === null) {
      var idGuess = (f && f.id) ? String(f.id) : "";
      var tail = idGuess;
      var pos = idGuess.indexOf("/");
      if (pos >= 0) {
        tail = idGuess.substring(pos + 1);
      }
      var digits = tail.replace(/[^0-9]/g, "");
      if (digits !== "") {
        var clean = digits.replace(/^0+/, "");
        if (clean === "") {
          clean = digits;
        }
        label = "Fan " + clean;
      } else {
        label = "Fan " + String(i + 1);
      }
    }
    base.push(label);
    if (counts[label] === undefined) {
      counts[label] = 1;
    } else {
      counts[label] = counts[label] + 1;
    }
  }
  for (i = 0; i < fans.length; i++) {
    var shown = base[i];
    if (counts[base[i]] > 1) {
      var chip = null;
      var f2 = fans[i];
      if (f2 && typeof f2 === "object") {
        chip = metricsStr(f2.chip);
      }
      if (chip === null) {
        var id2 = (f2 && f2.id) ? String(f2.id) : "";
        var slash = id2.indexOf("/");
        if (slash > 0) {
          chip = id2.substring(0, slash);
        }
      }
      if (chip !== null) {
        shown = base[i] + " (" + chip + ")";
      }
    }
    out.push(shown);
    var fid = (fans[i] && fans[i].id) ? String(fans[i].id) : null;
    if (fid !== null) {
      out[fid] = shown;
    }
  }
  return out;
}

function metricsRamp(value, warn, crit) {
  var v = metricsNum(value);
  var w = metricsNum(warn);
  var c = metricsNum(crit);
  if (v === null || w === null || c === null) {
    return 0;
  }
  if (c <= w) {
    if (v >= c) {
      return 1;
    }
    return 0;
  }
  if (v <= w) {
    return 0;
  }
  if (v >= c) {
    return 1;
  }
  return (v - w) / (c - w);
}

// Zero-pad a percentage to 2 digits ("3" -> "03") so a usage read-out
// holds a steady width as it crosses the 10% mark, and report how many
// of those leading characters are padding (not the significant digit),
// so MetricButton.qml can draw them in the secondary/muted color.
function metricsPadPercent(n) {
  var rounded = Math.max(0, Math.round(n));
  var digits = String(rounded);
  if (rounded < 10) {
    return { text: "0" + digits, padLen: 1 };
  }
  return { text: digits, padLen: 0 };
}

function metricsTempBar(celsius, unit) {
  var n = metricsNum(celsius);
  if (n === null) {
    return null;
  }
  var v = n;
  if (unit === "F" || unit === "f") {
    v = n * 9 / 5 + 32;
  }
  return String(Math.round(v)) + "°";
}

function metricsTempValue(celsius, unit) {
  var n = metricsNum(celsius);
  if (n === null) {
    return null;
  }
  var v = n;
  var suffix = "°C";
  if (unit === "F" || unit === "f") {
    v = n * 9 / 5 + 32;
    suffix = "°F";
  }
  return String(Math.round(v)) + " " + suffix;
}

function metricsGib(gib) {
  var n = metricsNum(gib);
  if (n === null) {
    return null;
  }
  if (n < 0) {
    n = 0;
  }
  if (n < 10) {
    var r = Math.round(n * 10) / 10;
    return r.toFixed(1);
  }
  return String(Math.round(n));
}

function metricsGibPair(usedGib, totalGib) {
  var u = metricsNum(usedGib);
  var t = metricsNum(totalGib);
  if (u === null || t === null) {
    return null;
  }
  var us = metricsGib(u);
  var ts = metricsGib(t);
  if (us === null || ts === null) {
    return null;
  }
  return us + "/" + ts + "G";
}

function metricsClockShort(mhz) {
  var n = metricsNum(mhz);
  if (n === null || n < 0) {
    return null;
  }
  if (n >= 1000) {
    var r = Math.round(n / 1000 * 10) / 10;
    return r.toFixed(1) + "G";
  }
  return String(Math.round(n)) + "M";
}

function metricsClockLong(mhz) {
  var n = metricsNum(mhz);
  if (n === null || n < 0) {
    return null;
  }
  if (n >= 1000) {
    var r = Math.round(n / 1000 * 10) / 10;
    return r.toFixed(1) + " GHz";
  }
  return String(Math.round(n)) + " MHz";
}

// Bytes/sec, auto-scaled like metricsClockShort/Long: bar form keeps only
// the unit letter ("1.2M", "340K"), menu form spells the unit out.
function metricsRateShort(bytesPerSec) {
  var n = metricsNum(bytesPerSec);
  if (n === null || n < 0) {
    return null;
  }
  if (n >= 1048576) {
    var mb = Math.round(n / 1048576 * 10) / 10;
    return mb.toFixed(1) + "M";
  }
  if (n >= 1024) {
    return String(Math.round(n / 1024)) + "K";
  }
  return String(Math.round(n));
}

function metricsRateLong(bytesPerSec) {
  var n = metricsNum(bytesPerSec);
  if (n === null || n < 0) {
    return null;
  }
  if (n >= 1048576) {
    var mb = Math.round(n / 1048576 * 10) / 10;
    return mb.toFixed(1) + " MB/s";
  }
  if (n >= 1024) {
    return String(Math.round(n / 1024)) + " KB/s";
  }
  return String(Math.round(n)) + " B/s";
}

// A group's warn/crit pair, falling back per field when missing.
function metricsLimits(g, warnKey, critKey, warn, crit) {
  var w = metricsNum(g[warnKey]);
  var c = metricsNum(g[critKey]);
  return [w === null ? warn : w, c === null ? crit : c];
}

// Whether a part draws anything: any of the given toggles is on. A part
// the prefs do not carry at all counts as shown, so ad-hoc prefs in tests
// and callers without a group still see every metric.
function metricsPartShows(part, keys) {
  if (!part || typeof part !== "object") {
    return true;
  }
  var i = 0;
  for (i = 0; i < keys.length; i++) {
    if (part[keys[i]] === true) {
      return true;
    }
  }
  return false;
}

// The clock draws in the bar only when its part says so.
function metricsClockOn(g) {
  return !!(g.clock && typeof g.clock === "object" && g.clock.show === true);
}

function metricsGroupOf(prefs, id) {
  if (prefs && typeof prefs === "object" && prefs.groups && typeof prefs.groups === "object") {
    var g = prefs.groups[id];
    if (g && typeof g === "object") {
      return g;
    }
  }
  return {};
}

// "9.4/62 GiB", the menu form of metricsGibPair.
function metricsGibLong(usedGib, totalGib) {
  var u = metricsGib(usedGib);
  var t = metricsGib(totalGib);
  if (u === null || t === null) {
    return null;
  }
  return u + "/" + t + " GiB";
}

// Bar form of a power draw: one decimal under 10 W, none above.
function metricsWattsShort(w) {
  var n = metricsNum(w);
  if (n === null || n < 0) {
    return null;
  }
  if (n < 10) {
    return (Math.round(n * 10) / 10).toFixed(1) + "W";
  }
  return String(Math.round(n)) + "W";
}

// A used/total pair as a percentage metric's extra fields: the padded
// bar digits, the GiB pair, the ratio and the menu value.
function metricsUsedFields(pct, usedGib, totalGib) {
  var pad = metricsPadPercent(pct);
  var gib = (usedGib !== null && totalGib !== null && totalGib > 0) ? metricsGibPair(usedGib, totalGib) : null;
  var gibLong = gib !== null ? metricsGibLong(usedGib, totalGib) : null;
  return {
    bar: pad.text + "%",
    padLen: pad.padLen,
    gib: gib,
    value: String(Math.round(pct)) + " %" + (gibLong !== null ? " · " + gibLong : ""),
    ratio: pct / 100
  };
}

function metricsAssign(target, fields) {
  var k = "";
  for (k in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, k)) {
      target[k] = fields[k];
    }
  }
  return target;
}

// Build the metric catalog in default bar order: CPU usage, temp and load
// average; GPU usage, temp, memory and power; memory and swap; net down
// and up; disk used, read and write; fans as found. Every metric the
// reading can answer is built here; the group prefs decide later what
// draws (metricsEffectiveHidden, Styles/Modes.js).
function metrics(reading, prefs) {
  var out = [];
  if (reading === null || reading === undefined) {
    return out;
  }
  if (typeof reading !== "object" || metricsIsArray(reading)) {
    return out;
  }
  var p = (prefs && typeof prefs === "object" && !metricsIsArray((prefs))) ? prefs : {};
  var unit = (p.unit === "F" || p.unit === "f") ? "F" : "C";
  var pgCpu = metricsGroupOf(p, "cpu");
  var pgGpu = metricsGroupOf(p, "gpu");
  var pgMem = metricsGroupOf(p, "mem");
  var pgDisk = metricsGroupOf(p, "disk");
  var pgFan = metricsGroupOf(p, "fan");
  // Each group warms on its own thresholds: a GPU runs hotter than a CPU.
  var limCpuUsage = metricsLimits(pgCpu, "warnUsage", "critUsage", 70, 90);
  var limCpuTemp = metricsLimits(pgCpu, "warnTemp", "critTemp", 75, 90);
  var limGpuUsage = metricsLimits(pgGpu, "warnUsage", "critUsage", 70, 90);
  var limGpuTemp = metricsLimits(pgGpu, "warnTemp", "critTemp", 75, 90);
  var limMem = metricsLimits(pgMem, "warnUsage", "critUsage", 70, 90);
  var limDisk = metricsLimits(pgDisk, "warnUsage", "critUsage", 70, 90);
  var limFan = metricsLimits(pgFan, "warnRpm", "critRpm", 4000, 6000);
  // A usage clock is its own field; the bar draws it as its own part.
  var useClocksCpu = metricsClockOn(pgCpu);
  var useClocksGpu = metricsClockOn(pgGpu);
  var cpuModel = metricsStr(reading.cpu_model);
  var cpuCores = metricsNum(reading.cpu_cores);
  var load = (reading.load && typeof reading.load === "object") ? reading.load : null;
  var loadOne = load ? metricsNum(load.one) : null;
  var loadFive = load ? metricsNum(load.five) : null;
  var loadFifteen = load ? metricsNum(load.fifteen) : null;

  var cpuMhz = metricsNum(reading.cpu_mhz);
  var cpuP = metricsNum(reading.cpu);
  if (cpuP !== null) {
    var cpuPad = metricsPadPercent(cpuP);
    var cpuClockLong = useClocksCpu ? metricsClockLong(cpuMhz) : null;
    out.push({
      key: "cpu_usage",
      device: "cpu",
      kind: "usage",
      label: "CPU usage",
      glyph: GLYPH.cpu,
      bar: cpuPad.text + "%",
      padLen: cpuPad.padLen,
      clock: useClocksCpu ? metricsClockShort(cpuMhz) : null,
      value: String(Math.round(cpuP)) + " %" + (cpuClockLong !== null ? " · " + cpuClockLong : ""),
      severity: metricsRamp(cpuP, limCpuUsage[0], limCpuUsage[1]),
      dim: false,
      ratio: cpuP / 100,
      mhz: cpuMhz,
      unit: unit,
      cpuModel: cpuModel,
      cpuCores: cpuCores
    });
  }

  var cpuT = metricsNum(reading.temp);
  if (cpuT !== null) {
    out.push({
      key: "cpu_temp",
      device: "cpu",
      kind: "temp",
      label: "CPU temp",
      glyph: GLYPH.temp,
      bar: metricsTempBar(cpuT, unit),
      value: metricsTempValue(cpuT, unit),
      severity: metricsRamp(cpuT, limCpuTemp[0], limCpuTemp[1]),
      dim: false,
      mhz: cpuMhz,
      unit: unit,
      cpuModel: cpuModel,
      cpuCores: cpuCores
    });
  }

  if (loadOne !== null || loadFive !== null || loadFifteen !== null) {
    var avgShort = function (v) { return v !== null ? v.toFixed(2) : null; };
    var avgParts = [loadOne, loadFive, loadFifteen].filter(function (v) { return v !== null; }).map(avgShort);
    out.push({
      key: "cpu_avg",
      device: "cpu",
      kind: "avg",
      label: "Load average",
      glyph: "",
      bar: avgParts.join(" "),
      one: avgShort(loadOne),
      five: avgShort(loadFive),
      fifteen: avgShort(loadFifteen),
      value: avgParts.join(" · "),
      severity: 0,
      dim: false,
      unit: unit
    });
  }

  var gpuDetail = (reading.gpu_detail && typeof reading.gpu_detail === "object") ? reading.gpu_detail : null;
  var vramUsed = gpuDetail ? metricsNum(gpuDetail.vram_used_b) : null;
  var vramTotal = gpuDetail ? metricsNum(gpuDetail.vram_total_b) : null;
  var watts = gpuDetail ? metricsNum(gpuDetail.watts) : null;
  var gpuMhz = metricsNum(reading.gpu_mhz);
  var gpuP = metricsNum(reading.gpu);
  if (gpuP !== null) {
    var gpuPad = metricsPadPercent(gpuP);
    var gpuClockLong = useClocksGpu ? metricsClockLong(gpuMhz) : null;
    out.push({
      key: "gpu_usage",
      device: "gpu",
      kind: "usage",
      label: "GPU usage",
      glyph: GLYPH.gpu,
      bar: gpuPad.text + "%",
      padLen: gpuPad.padLen,
      clock: useClocksGpu ? metricsClockShort(gpuMhz) : null,
      value: String(Math.round(gpuP)) + " %" + (gpuClockLong !== null ? " · " + gpuClockLong : ""),
      severity: metricsRamp(gpuP, limGpuUsage[0], limGpuUsage[1]),
      dim: false,
      ratio: gpuP / 100,
      mhz: gpuMhz,
      unit: unit
    });
  }

  var gpuT = metricsNum(reading.gpu_temp);
  if (gpuT !== null) {
    out.push({
      key: "gpu_temp",
      device: "gpu",
      kind: "temp",
      label: "GPU temp",
      glyph: GLYPH.temp,
      bar: metricsTempBar(gpuT, unit),
      value: metricsTempValue(gpuT, unit),
      severity: metricsRamp(gpuT, limGpuTemp[0], limGpuTemp[1]),
      dim: false,
      mhz: gpuMhz,
      unit: unit
    });
  }

  if (vramUsed !== null && vramTotal !== null && vramTotal > 0) {
    var vramPct = vramUsed / vramTotal * 100;
    out.push(metricsAssign({
      key: "gpu_vram",
      device: "gpu",
      kind: "vram",
      label: "GPU memory",
      glyph: "",
      severity: metricsRamp(vramPct, limGpuUsage[0], limGpuUsage[1]),
      dim: false,
      unit: unit
    }, metricsUsedFields(vramPct, vramUsed / 1073741824, vramTotal / 1073741824)));
  }

  if (watts !== null) {
    var wattsShort = metricsWattsShort(watts);
    out.push({
      key: "gpu_power",
      device: "gpu",
      kind: "power",
      label: "GPU power",
      glyph: "",
      bar: wattsShort,
      value: wattsShort.replace("W", " W"),
      severity: 0,
      dim: false,
      unit: unit
    });
  }

  var memUsedKib = metricsNum(reading.mem_used_kib);
  var memTotalKib = metricsNum(reading.mem_total_kib);
  var swapUsedKib = metricsNum(reading.swap_used_kib);
  var swapTotalKib = metricsNum(reading.swap_total_kib);
  var memHasKib = memUsedKib !== null && memTotalKib !== null && memTotalKib > 0;
  var memP = metricsNum(reading.mem);
  if (memP === null && memHasKib) {
    memP = memUsedKib / memTotalKib * 100;
  }
  if (memP !== null) {
    out.push(metricsAssign({
      key: "mem_usage",
      device: "mem",
      kind: "usage",
      label: "Memory used",
      glyph: GLYPH.mem,
      severity: metricsRamp(memP, limMem[0], limMem[1]),
      dim: false,
      unit: unit
    }, metricsUsedFields(memP, memHasKib ? memUsedKib / 1048576 : null, memHasKib ? memTotalKib / 1048576 : null)));
  }

  if (swapUsedKib !== null && swapTotalKib !== null && swapTotalKib > 0) {
    var swapPct = swapUsedKib / swapTotalKib * 100;
    out.push(metricsAssign({
      key: "mem_swap",
      device: "mem",
      kind: "swap",
      label: "Swap",
      glyph: "",
      severity: metricsRamp(swapPct, limMem[0], limMem[1]),
      dim: false,
      unit: unit
    }, metricsUsedFields(swapPct, swapUsedKib / 1048576, swapTotalKib / 1048576)));
  }

  if (reading.net && typeof reading.net === "object") {
    var netDown = metricsNum(reading.net.down_bps);
    var netUp = metricsNum(reading.net.up_bps);
    var netIface = metricsStr(reading.net.iface);
    if (netDown !== null) {
      out.push({
        key: "net_down",
        device: "net",
        kind: "down",
        label: "Net down",
        glyph: GLYPH.down,
        bar: metricsRateShort(netDown),
        value: metricsRateLong(netDown),
        severity: 0,
        dim: false,
        unit: unit,
        iface: netIface
      });
    }
    if (netUp !== null) {
      out.push({
        key: "net_up",
        device: "net",
        kind: "up",
        label: "Net up",
        glyph: GLYPH.up,
        bar: metricsRateShort(netUp),
        value: metricsRateLong(netUp),
        severity: 0,
        dim: false,
        unit: unit,
        iface: netIface
      });
    }
  }

  if (reading.disk && typeof reading.disk === "object") {
    var disk = reading.disk;
    var diskMount = metricsStr(disk.mount);
    var diskPct = metricsNum(disk.used_pct);
    var diskUsedB = metricsNum(disk.used_b);
    var diskTotalB = metricsNum(disk.total_b);
    var diskHasB = diskUsedB !== null && diskTotalB !== null && diskTotalB > 0;
    if (diskPct !== null) {
      out.push(metricsAssign({
        key: "disk_usage",
        device: "disk",
        kind: "usage",
        label: "Disk used",
        glyph: GLYPH.disk,
        severity: metricsRamp(diskPct, limDisk[0], limDisk[1]),
        dim: false,
        unit: unit,
        mount: diskMount
      }, metricsUsedFields(diskPct, diskHasB ? diskUsedB / 1073741824 : null, diskHasB ? diskTotalB / 1073741824 : null)));
    }
    var rates = [
      { kind: "read", label: "Disk read", tag: "R", bps: metricsNum(disk.read_bps) },
      { kind: "write", label: "Disk write", tag: "W", bps: metricsNum(disk.write_bps) }
    ];
    var ri = 0;
    for (ri = 0; ri < rates.length; ri++) {
      if (rates[ri].bps === null) {
        continue;
      }
      out.push({
        key: "disk_" + rates[ri].kind,
        device: "disk",
        kind: rates[ri].kind,
        label: rates[ri].label,
        glyph: rates[ri].tag,
        bar: metricsRateShort(rates[ri].bps),
        value: metricsRateLong(rates[ri].bps),
        severity: 0,
        dim: false,
        unit: unit,
        mount: diskMount
      });
    }
  }

  var fans = reading.fans;
  if (metricsIsArray(fans) && fans.length > 0) {
    var labels = fanLabels(fans);
    var names = (pgFan.names && typeof pgFan.names === "object" && !metricsIsArray(pgFan.names)) ? pgFan.names : {};
    var fi = 0;
    for (fi = 0; fi < fans.length; fi++) {
      var fan = fans[fi];
      var rpm = fan ? metricsNum(fan.rpm) : null;
      if (rpm === null) {
        continue;
      }
      var fid = fan.id ? String(fan.id) : "fan" + String(fi + 1);
      var fanKey = "fan:" + fid;
      var auto = labels[fi];
      if (auto === undefined || auto === null) {
        auto = fan.label ? String(fan.label) : fid;
      }
      // A name the user gave this fan wins over the detected label.
      var custom = typeof names[fanKey] === "string" ? metricsStr(names[fanKey]) : null;
      var r = Math.round(rpm);
      out.push({
        key: fanKey,
        device: "fan",
        kind: "fan",
        label: custom !== null ? custom : auto,
        autoLabel: auto,
        glyph: GLYPH.fan,
        bar: String(r),
        value: r === 0 ? "stopped" : String(r) + " RPM",
        severity: r === 0 ? 0 : metricsRamp(r, limFan[0], limFan[1]),
        dim: r === 0,
        rpm: r,
        unit: unit
      });
    }
  }

  // The label a cell draws: the group's glyph, and its word (the group's
  // short name, or a fan's own label, since fans are the one group with
  // several cells on the bar). `glyph` stays the metric's own mark (the
  // thermometer, the net arrows, the disk R/W).
  var wi = 0;
  for (wi = 0; wi < out.length; wi++) {
    out[wi].groupGlyph = GLYPH[out[wi].device] || "";
    out[wi].word = out[wi].device === "fan" ? out[wi].label : GROUP_LABELS[out[wi].device];
  }

  return out;
}

// Reorder metrics by a user order array. Unknown order entries are
// ignored, unknown metric keys are appended in default order.
function orderKeys(allMetrics, order) {
  if (!metricsIsArray((allMetrics))) {
    return [];
  }
  if (!metricsIsArray((order)) || order.length === 0) {
    return allMetrics.slice();
  }
  var byKey = {};
  var i = 0;
  for (i = 0; i < allMetrics.length; i++) {
    var m = allMetrics[i];
    if (m && typeof m.key === "string") {
      byKey[m.key] = m;
    }
  }
  var seen = {};
  var out = [];
  for (i = 0; i < order.length; i++) {
    var k = order[i];
    if (typeof k !== "string") {
      continue;
    }
    var found = byKey[k];
    if (found && !seen[found.key]) {
      out.push(found);
      seen[found.key] = true;
    }
  }
  for (i = 0; i < allMetrics.length; i++) {
    var item = allMetrics[i];
    if (item && !seen[item.key]) {
      out.push(item);
      seen[item.key] = true;
    }
  }
  return out;
}

function isHidden(key, hidden) {
  return metricsIsArray(hidden) && hidden.indexOf(key) >= 0;
}

// Filter out hidden metrics. Keeps default order.
function shown(list, hidden) {
  if (!metricsIsArray((list))) {
    return [];
  }
  if (!metricsIsArray((hidden)) || hidden.length === 0) {
    return list.slice();
  }
  var out = [];
  var i = 0;
  for (i = 0; i < list.length; i++) {
    var m = list[i];
    if (m && !isHidden(m.key, hidden)) {
      out.push(m);
    }
  }
  return out;
}

// Intra-group metric-key suffixes, in display order, for every group that
// isn't the auto-discovered fan list.
var GROUP_METRIC_KINDS = {
  cpu: ["usage", "temp", "avg"],
  gpu: ["usage", "temp", "vram", "power"],
  mem: ["usage", "swap"],
  net: ["down", "up"],
  disk: ["usage", "read", "write"]
};

// Expand a group-id order (prefs.order) into a flat metric-key order,
// reusable directly with orderKeys() above. Fan keys come from the
// group's own nested order (prefs.groups.fan.order); any fan not listed
// there is left for orderKeys()'s own "unknown keys appended" fallback.
function metricsExpandGroupOrder(groupOrder, fanOrder) {
  var out = [];
  if (!metricsIsArray(groupOrder)) {
    return out;
  }
  var i = 0;
  var j = 0;
  for (i = 0; i < groupOrder.length; i++) {
    var g = groupOrder[i];
    if (g === "fan") {
      if (metricsIsArray(fanOrder)) {
        for (j = 0; j < fanOrder.length; j++) {
          out.push(fanOrder[j]);
        }
      }
      continue;
    }
    var kinds = GROUP_METRIC_KINDS[g];
    if (!kinds) {
      continue;
    }
    for (j = 0; j < kinds.length; j++) {
      out.push(g + "_" + kinds[j]);
    }
  }
  return out;
}

// Derive a flat hidden-key list from prefs.groups (group enable switches
// plus each group's own sub-toggles), so the existing shown()/isHidden()
// machinery keeps being the single visibility mechanism instead of a
// second parallel one.
function metricsEffectiveHidden(allMetrics, prefs) {
  var out = [];
  if (!metricsIsArray(allMetrics)) {
    return out;
  }
  var p = (prefs && typeof prefs === "object" && !metricsIsArray(prefs)) ? prefs : {};
  var i = 0;
  for (i = 0; i < allMetrics.length; i++) {
    var m = allMetrics[i];
    if (m && typeof m.key === "string" && metricsDrawsNothing(m, metricsGroupOf(p, m.device))) {
      out.push(m.key);
    }
  }
  return out;
}

// Whether a metric draws nothing on the bar: its group is off, or every
// toggle of the part it feeds is off. A CPU/GPU usage metric also feeds
// the clock, so it stays while either one shows.
function metricsDrawsNothing(m, g) {
  if (g.enabled === false) {
    return true;
  }
  var dev = m.device;
  if (dev === "fan") {
    if (isHidden(m.key, g.hidden)) {
      return true;
    }
    if (m.rpm === 0 && g.showStopped === false) {
      return true;
    }
    return !metricsPartShows(g.rpm, ["value"]);
  }
  if (m.kind === "usage") {
    if (dev === "cpu" || dev === "gpu") {
      return !metricsPartShows(g.load, ["bar", "number"]) && !metricsClockOn(g);
    }
    return !metricsPartShows(g.used, ["bar", "percent", "gib"]);
  }
  if (m.kind === "temp") {
    return !metricsPartShows(g.temp, ["value"]);
  }
  if (m.kind === "avg") {
    return !metricsPartShows(g.avg, ["one", "five", "fifteen"]);
  }
  if (m.kind === "vram" || m.kind === "swap") {
    return !metricsPartShows(g[m.kind], ["bar", "percent", "gib"]);
  }
  if (m.kind === "power") {
    return !metricsPartShows(g.power, ["show"]);
  }
  if (m.kind === "down" || m.kind === "up" || m.kind === "read" || m.kind === "write") {
    return !metricsPartShows(g[m.kind], ["value"]);
  }
  return false;
}

// The collector provider (sysread's MONITOR_READ) behind each metric.
var METRIC_READS = {
  cpu_usage: "cpu", cpu_temp: "temp", cpu_avg: "load",
  gpu_usage: "gpu", gpu_temp: "gpu", gpu_vram: "gpu", gpu_power: "gpu",
  mem_usage: "mem", mem_swap: "mem",
  net_down: "net", net_up: "net",
  disk_usage: "disk", disk_read: "io", disk_write: "io"
};

// What the collector reads for the bar, by the rules of
// metricsDrawsNothing: a piece that draws nothing costs nothing. The CPU
// group also reads the load average (for its tooltip) and, when that
// piece shows, the clock. Mount and interface lists are for the menu,
// which asks for everything while it is open.
function metricsReadList(prefs) {
  var p = (prefs && typeof prefs === "object" && !metricsIsArray(prefs)) ? prefs : {};
  var out = [];
  function need(name) {
    if (out.indexOf(name) < 0) {
      out.push(name);
    }
  }
  var id = "";
  var j = 0;
  for (id in GROUP_METRIC_KINDS) {
    var g = metricsGroupOf(p, id);
    var kinds = GROUP_METRIC_KINDS[id];
    for (j = 0; j < kinds.length; j++) {
      if (!metricsDrawsNothing({ key: id + "_" + kinds[j], device: id, kind: kinds[j] }, g)) {
        need(METRIC_READS[id + "_" + kinds[j]]);
      }
    }
  }
  var cpu = metricsGroupOf(p, "cpu");
  if (cpu.enabled !== false) {
    need("load");
    if (metricsClockOn(cpu)) {
      need("clocks");
    }
  }
  if (!metricsDrawsNothing({ key: "", device: "fan", rpm: null }, metricsGroupOf(p, "fan"))) {
    need("fans");
  }
  return out;
}

// Cluster an already-ordered metric list into contiguous per-device runs.
// Both the bar strip (one display mode per group) and the menu (one card
// per group) build their per-group view from this same clustering, so a
// group's metrics only ever need to be contiguous once, here.
function metricsGroupRuns(orderedMetrics) {
  var out = [];
  if (!metricsIsArray(orderedMetrics)) {
    return out;
  }
  var i = 0;
  for (i = 0; i < orderedMetrics.length; i++) {
    var m = orderedMetrics[i];
    if (!m) {
      continue;
    }
    var dev = (typeof m.device === "string" && m.device !== "") ? m.device : "other";
    var last = out.length > 0 ? out[out.length - 1] : null;
    if (last && last.device === dev) {
      last.items.push(m);
    } else {
      out.push({ device: dev, items: [m] });
    }
  }
  return out;
}
