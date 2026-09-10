// Metric catalog for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: every helper used here is defined in this file under a
// metrics-prefixed name, so loading order does not matter.

// Nerd Font glyphs by device, picked from ranges confirmed (by actually
// rendering a live sample under this project's own font stack) to exist
// in `ttf-jetbrains-mono-nerd-basic`, the Nerd Font installed on target
// systems: microchip U+F2DB (cpu), thermometer_half U+F2C9 (temp),
// desktop U+F108 (gpu), spinner U+F110 (fan), wifi U+F1EB (net),
// hdd_o U+F0A0 (disk) — all classic FontAwesome 4 (U+F000-U+F2FF);
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
  disk: null
};

// Placeholder shown when every metric is hidden.
var PLACEHOLDER = {
  key: "placeholder",
  device: "placeholder",
  kind: "placeholder",
  label: "No metrics visible",
  glyph: "",
  bar: "—",
  value: "All metrics hidden",
  severity: 0,
  dim: true,
  percent: null,
  tempC: null,
  rpm: null,
  mhz: null,
  unit: "C",
  ramFormat: "percent"
};

// Legacy metric keys from the previous widget.
var LEGACY_KEYS = {
  cpu: "cpu_usage",
  temp: "cpu_temp",
  mem: "mem_usage"
};

function migrateKey(k) {
  if (k === null || k === undefined) {
    return k;
  }
  var s = String(k);
  if (Object.prototype.hasOwnProperty.call(LEGACY_KEYS, s)) {
    return LEGACY_KEYS[s];
  }
  return s;
}

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

function metricsCloneEmpty() {
  return {
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
    disk: null
  };
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
    used_pct: usedPct,
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

// Fields the collector can only answer after a delta between two
// samples (a fresh process always reports these as null on its first
// line, by design — see scripts/sysread's priming pattern).
var METRICS_PRIMED_FIELDS = ["cpu", "gpu"];

// One-time grace merge for the single reading right after a deliberate
// collector restart (BarWidget.qml restarts `sysread` whenever the poll
// interval changes, e.g. opening/closing the menu): carries forward the
// previous reading's primed fields when the new one is still null for
// them, so a restart never visibly regresses a metric that a moment ago
// had a real value. Applied exactly once per restart — every reading
// after this one replaces wholesale again, so a sensor that genuinely
// disappears still reflects that within a poll or two.
function mergeReading(oldReading, newReading) {
  if (!newReading || typeof newReading !== "object") {
    return newReading;
  }
  if (!oldReading || typeof oldReading !== "object") {
    return newReading;
  }
  var out = {};
  var k = "";
  for (k in newReading) {
    if (Object.prototype.hasOwnProperty.call(newReading, k)) {
      out[k] = newReading[k];
    }
  }
  var i = 0;
  for (i = 0; i < METRICS_PRIMED_FIELDS.length; i++) {
    var f = METRICS_PRIMED_FIELDS[i];
    if ((out[f] === null || out[f] === undefined) &&
        oldReading[f] !== null && oldReading[f] !== undefined) {
      out[f] = oldReading[f];
    }
  }
  // Rate fields are nested one level down (net.down_bps, disk.read_bps),
  // primed by the collector exactly like cpu/gpu usage, for the same reason.
  var nested = [
    { container: "net", fields: ["down_bps", "up_bps"] },
    { container: "disk", fields: ["read_bps", "write_bps"] }
  ];
  for (i = 0; i < nested.length; i++) {
    var c = nested[i].container;
    if (!out[c] || typeof out[c] !== "object" || !oldReading[c] || typeof oldReading[c] !== "object") {
      continue;
    }
    var merged = {};
    var ck = "";
    for (ck in out[c]) {
      if (Object.prototype.hasOwnProperty.call(out[c], ck)) {
        merged[ck] = out[c][ck];
      }
    }
    var j = 0;
    for (j = 0; j < nested[i].fields.length; j++) {
      var nf = nested[i].fields[j];
      if ((merged[nf] === null || merged[nf] === undefined) &&
          oldReading[c][nf] !== null && oldReading[c][nf] !== undefined) {
        merged[nf] = oldReading[c][nf];
      }
    }
    out[c] = merged;
  }
  return out;
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

function metricsThreshold(prefs, key, fallback) {
  var v = null;
  if (prefs && typeof prefs === "object") {
    v = metricsNum(prefs[key]);
  }
  if (v === null) {
    return fallback;
  }
  return v;
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

// Build the metric catalog in default bar order:
// CPU usage, CPU temp, GPU usage, GPU temp, memory, fans as found.
// `groupModes` carries each device's already-resolved ("inherit" already
// substituted by the caller) display mode, needed only to decide whether
// that device's own "show clocks" option applies (digits mode only).
function metrics(reading, groupModes, prefs) {
  var out = [];
  if (reading === null || reading === undefined) {
    return out;
  }
  if (typeof reading !== "object" || metricsIsArray(reading)) {
    return out;
  }
  var gm = (groupModes && typeof groupModes === "object" && !metricsIsArray(groupModes)) ? groupModes : {};
  var p = (prefs && typeof prefs === "object" && !metricsIsArray((prefs))) ? prefs : {};
  var unit = (p.unit === "F" || p.unit === "f") ? "F" : "C";
  var pgCpu = metricsGroupOf(p, "cpu");
  var pgGpu = metricsGroupOf(p, "gpu");
  var pgMem = metricsGroupOf(p, "mem");
  var pgFan = metricsGroupOf(p, "fan");
  var ramFormat = (pgMem.ramFormat === "used") ? "used" : "percent";
  var showRpm = pgFan.showRpm === true;
  var warnU = metricsThreshold(p, "warnUsage", 70);
  var critU = metricsThreshold(p, "critUsage", 90);
  var warnT = metricsThreshold(p, "warnTemp", 75);
  var critT = metricsThreshold(p, "critTemp", 90);
  var useClocksCpu = pgCpu.showClocks === true && (gm.cpu || "digits") === "digits";
  var useClocksGpu = pgGpu.showClocks === true && (gm.gpu || "digits") === "digits";

  var cpuP = metricsNum(reading.cpu);
  if (cpuP !== null) {
    var cpuMhz = metricsNum(reading.cpu_mhz);
    var cpuPad = metricsPadPercent(cpuP);
    var bar = cpuPad.text + "%";
    var value = String(Math.round(cpuP)) + " %";
    if (useClocksCpu && cpuMhz !== null) {
      var short = metricsClockShort(cpuMhz);
      var long = metricsClockLong(cpuMhz);
      if (short !== null && long !== null) {
        bar = bar + " " + short;
        value = value + " · " + long;
      }
    }
    out.push({
      key: "cpu_usage",
      device: "cpu",
      kind: "usage",
      label: "CPU usage",
      glyph: GLYPH.cpu,
      bar: bar,
      value: value,
      severity: metricsRamp(cpuP, warnU, critU),
      dim: false,
      percent: cpuP,
      ratio: cpuP / 100,
      padLen: cpuPad.padLen,
      tempC: null,
      rpm: null,
      mhz: cpuMhz,
      unit: unit,
      ramFormat: ramFormat,
      cpuModel: metricsStr(reading.cpu_model),
      cpuCores: metricsNum(reading.cpu_cores),
      loadOne: reading.load ? metricsNum(reading.load.one) : null,
      loadFive: reading.load ? metricsNum(reading.load.five) : null,
      loadFifteen: reading.load ? metricsNum(reading.load.fifteen) : null
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
      severity: metricsRamp(cpuT, warnT, critT),
      dim: false,
      percent: null,
      tempC: cpuT,
      rpm: null,
      mhz: metricsNum(reading.cpu_mhz),
      unit: unit,
      ramFormat: ramFormat,
      cpuModel: metricsStr(reading.cpu_model),
      cpuCores: metricsNum(reading.cpu_cores),
      loadOne: reading.load ? metricsNum(reading.load.one) : null,
      loadFive: reading.load ? metricsNum(reading.load.five) : null,
      loadFifteen: reading.load ? metricsNum(reading.load.fifteen) : null
    });
  }

  var gpuP = metricsNum(reading.gpu);
  if (gpuP !== null) {
    var gpuMhz = metricsNum(reading.gpu_mhz);
    var gpuPad = metricsPadPercent(gpuP);
    var gbar = gpuPad.text + "%";
    var gvalue = String(Math.round(gpuP)) + " %";
    if (useClocksGpu && gpuMhz !== null) {
      var gshort = metricsClockShort(gpuMhz);
      var glong = metricsClockLong(gpuMhz);
      if (gshort !== null && glong !== null) {
        gbar = gbar + " " + gshort;
        gvalue = gvalue + " · " + glong;
      }
    }
    var vramUsed = null;
    var vramTotal = null;
    var watts = null;
    if (reading.gpu_detail && typeof reading.gpu_detail === "object") {
      vramUsed = metricsNum(reading.gpu_detail.vram_used_b);
      vramTotal = metricsNum(reading.gpu_detail.vram_total_b);
      watts = metricsNum(reading.gpu_detail.watts);
    }
    out.push({
      key: "gpu_usage",
      device: "gpu",
      kind: "usage",
      label: "GPU usage",
      glyph: GLYPH.gpu,
      bar: gbar,
      value: gvalue,
      severity: metricsRamp(gpuP, warnU, critU),
      dim: false,
      percent: gpuP,
      ratio: gpuP / 100,
      padLen: gpuPad.padLen,
      tempC: null,
      rpm: null,
      mhz: gpuMhz,
      unit: unit,
      ramFormat: ramFormat,
      vramUsedB: vramUsed,
      vramTotalB: vramTotal,
      watts: watts
    });
  }

  var gpuT = metricsNum(reading.gpu_temp);
  if (gpuT !== null) {
    var gm = metricsNum(reading.gpu_mhz);
    var vu = null;
    var vt = null;
    var w = null;
    if (reading.gpu_detail && typeof reading.gpu_detail === "object") {
      vu = metricsNum(reading.gpu_detail.vram_used_b);
      vt = metricsNum(reading.gpu_detail.vram_total_b);
      w = metricsNum(reading.gpu_detail.watts);
    }
    out.push({
      key: "gpu_temp",
      device: "gpu",
      kind: "temp",
      label: "GPU temp",
      glyph: GLYPH.temp,
      bar: metricsTempBar(gpuT, unit),
      value: metricsTempValue(gpuT, unit),
      severity: metricsRamp(gpuT, warnT, critT),
      dim: false,
      percent: null,
      tempC: gpuT,
      rpm: null,
      mhz: gm,
      unit: unit,
      ramFormat: ramFormat,
      vramUsedB: vu,
      vramTotalB: vt,
      watts: w
    });
  }

  var memP = metricsNum(reading.mem);
  var memUsedKib = metricsNum(reading.mem_used_kib);
  var memTotalKib = metricsNum(reading.mem_total_kib);
  var swapUsedKib = metricsNum(reading.swap_used_kib);
  var swapTotalKib = metricsNum(reading.swap_total_kib);
  var memBar = null;
  var memValue = null;
  var memSev = 0;
  var memPadLen = 0;
  if (ramFormat === "used" && memUsedKib !== null && memTotalKib !== null && memTotalKib > 0) {
    var usedGib = memUsedKib / 1048576;
    var totalGib = memTotalKib / 1048576;
    var pair = metricsGibPair(usedGib, totalGib);
    if (pair !== null) {
      memBar = pair;
      memValue = pair;
    }
  }
  if (memBar === null && memP !== null) {
    var memPad = metricsPadPercent(memP);
    memBar = memPad.text + "%";
    memValue = String(Math.round(memP)) + " %";
    memPadLen = memPad.padLen;
  }
  if (memBar === null && memUsedKib !== null && memTotalKib !== null && memTotalKib > 0) {
    var ug = memUsedKib / 1048576;
    var tg = memTotalKib / 1048576;
    var pr = metricsGibPair(ug, tg);
    if (pr !== null) {
      memBar = pr;
      memValue = pr;
    }
  }
  if (memBar !== null) {
    if (memP !== null) {
      memSev = metricsRamp(memP, warnU, critU);
    } else if (memUsedKib !== null && memTotalKib !== null && memTotalKib > 0) {
      memSev = metricsRamp(memUsedKib / memTotalKib * 100, warnU, critU);
    }
    out.push({
      key: "mem_usage",
      device: "mem",
      kind: "usage",
      label: "Memory usage",
      glyph: GLYPH.mem,
      bar: memBar,
      value: memValue,
      severity: memSev,
      dim: false,
      percent: memP,
      ratio: (memP !== null ? memP
        : (memUsedKib !== null && memTotalKib !== null && memTotalKib > 0
           ? memUsedKib / memTotalKib * 100 : null)) / 100,
      padLen: memPadLen,
      tempC: null,
      rpm: null,
      mhz: null,
      unit: unit,
      ramFormat: ramFormat,
      memUsedKib: memUsedKib,
      memTotalKib: memTotalKib,
      swapUsedKib: swapUsedKib,
      swapTotalKib: swapTotalKib
    });
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
        glyph: GLYPH.net,
        bar: metricsRateShort(netDown),
        value: metricsRateLong(netDown),
        severity: 0,
        dim: false,
        percent: null,
        tempC: null,
        rpm: null,
        mhz: null,
        unit: unit,
        ramFormat: ramFormat,
        iface: netIface
      });
    }
    if (netUp !== null) {
      out.push({
        key: "net_up",
        device: "net",
        kind: "up",
        label: "Net up",
        glyph: GLYPH.net,
        bar: metricsRateShort(netUp),
        value: metricsRateLong(netUp),
        severity: 0,
        dim: false,
        percent: null,
        tempC: null,
        rpm: null,
        mhz: null,
        unit: unit,
        ramFormat: ramFormat,
        iface: netIface
      });
    }
  }

  if (reading.disk && typeof reading.disk === "object") {
    var diskUsedPct = metricsNum(reading.disk.used_pct);
    var diskMount = metricsStr(reading.disk.mount);
    if (diskUsedPct !== null) {
      var diskPad = metricsPadPercent(diskUsedPct);
      out.push({
        key: "disk_usage",
        device: "disk",
        kind: "usage",
        label: "Disk usage",
        glyph: GLYPH.disk,
        bar: diskPad.text + "%",
        value: String(Math.round(diskUsedPct)) + " %",
        severity: metricsRamp(diskUsedPct, warnU, critU),
        dim: false,
        percent: diskUsedPct,
        ratio: diskUsedPct / 100,
        padLen: diskPad.padLen,
        tempC: null,
        rpm: null,
        mhz: null,
        unit: unit,
        ramFormat: ramFormat,
        mount: diskMount
      });
    }
    var diskRead = metricsNum(reading.disk.read_bps);
    var diskWrite = metricsNum(reading.disk.write_bps);
    if (diskRead !== null || diskWrite !== null) {
      var ioTotal = (diskRead || 0) + (diskWrite || 0);
      out.push({
        key: "disk_io",
        device: "disk",
        kind: "io",
        label: "Disk I/O",
        glyph: GLYPH.disk,
        bar: metricsRateShort(ioTotal),
        value: metricsRateLong(ioTotal),
        severity: 0,
        dim: false,
        percent: null,
        tempC: null,
        rpm: null,
        mhz: null,
        unit: unit,
        ramFormat: ramFormat,
        readBps: diskRead,
        writeBps: diskWrite
      });
    }
  }

  var fans = reading.fans;
  if (metricsIsArray(fans) && fans.length > 0) {
    var labels = fanLabels(fans);
    var fi = 0;
    for (fi = 0; fi < fans.length; fi++) {
      var fan = fans[fi];
      var rpm = fan ? metricsNum(fan.rpm) : null;
      if (rpm === null) {
        continue;
      }
      var fid = fan.id ? String(fan.id) : "fan" + String(fi + 1);
      var disp = labels[fi];
      if (disp === undefined || disp === null) {
        disp = fan.label ? String(fan.label) : fid;
      }
      var fbar = null;
      var fvalue = null;
      var fdim = false;
      if (Math.round(rpm) === 0) {
        fbar = "0";
        fvalue = "stopped";
        fdim = true;
      } else {
        if (showRpm) {
          fbar = String(Math.round(rpm)) + " RPM";
        } else {
          fbar = String(Math.round(rpm));
        }
        fvalue = String(Math.round(rpm)) + " RPM";
      }
      out.push({
        key: "fan:" + fid,
        device: "fan",
        kind: "fan",
        label: disp,
        glyph: GLYPH.fan,
        bar: fbar,
        value: fvalue,
        severity: 0,
        dim: fdim,
        percent: null,
        tempC: null,
        rpm: Math.round(rpm),
        mhz: null,
        unit: unit,
        ramFormat: ramFormat,
        chip: metricsStr(fan.chip),
        fanLabel: disp
      });
    }
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
      byKey[migrateKey(m.key)] = m;
      byKey[m.key] = m;
    }
  }
  var seen = {};
  var out = [];
  for (i = 0; i < order.length; i++) {
    var k = migrateKey(order[i]);
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
  if (!metricsIsArray((hidden)) || hidden.length === 0) {
    return false;
  }
  var k = migrateKey(key);
  var i = 0;
  for (i = 0; i < hidden.length; i++) {
    if (migrateKey(hidden[i]) === k) {
      return true;
    }
  }
  return false;
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
  cpu: ["usage", "temp"],
  gpu: ["usage", "temp"],
  mem: ["usage"],
  net: ["down", "up"],
  disk: ["usage", "io"]
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
  var pgCpu = metricsGroupOf(p, "cpu");
  var pgGpu = metricsGroupOf(p, "gpu");
  var pgMem = metricsGroupOf(p, "mem");
  var pgNet = metricsGroupOf(p, "net");
  var pgDisk = metricsGroupOf(p, "disk");
  var pgFan = metricsGroupOf(p, "fan");
  var i = 0;
  for (i = 0; i < allMetrics.length; i++) {
    var m = allMetrics[i];
    if (!m || typeof m.key !== "string") {
      continue;
    }
    var dev = m.device;
    if (dev === "cpu") {
      if (pgCpu.enabled === false) {
        out.push(m.key);
        continue;
      }
      if (m.kind === "usage" && pgCpu.showUsage === false) {
        out.push(m.key);
      }
      if (m.kind === "temp" && pgCpu.showTemp === false) {
        out.push(m.key);
      }
    } else if (dev === "gpu") {
      if (pgGpu.enabled === false) {
        out.push(m.key);
        continue;
      }
      if (m.kind === "usage" && pgGpu.showUsage === false) {
        out.push(m.key);
      }
      if (m.kind === "temp" && pgGpu.showTemp === false) {
        out.push(m.key);
      }
    } else if (dev === "mem") {
      if (pgMem.enabled === false) {
        out.push(m.key);
      }
    } else if (dev === "net") {
      if (pgNet.enabled === false) {
        out.push(m.key);
      }
    } else if (dev === "disk") {
      if (pgDisk.enabled === false) {
        out.push(m.key);
        continue;
      }
      if (m.kind === "usage" && pgDisk.showUsage === false) {
        out.push(m.key);
      }
      if (m.kind === "io" && pgDisk.showIo === false) {
        out.push(m.key);
      }
    } else if (dev === "fan") {
      if (pgFan.enabled === false || isHidden(m.key, pgFan.hidden)) {
        out.push(m.key);
      }
    }
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
