// Metric catalog for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: every helper used here is defined in this file under a
// metrics-prefixed name, so loading order does not matter.

// Nerd Font glyphs by device. Codepoints picked for this project:
// microchip U+F2DB, thermometer_half U+F2C9, expansion_card U+F6FF,
// memory U+F538, fan U+F863.
function metricsIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

var GLYPH = {
  cpu: "",
  temp: "",
  gpu: "",
  mem: "",
  fan: ""
};

// Empty reading. Every schema field is present, values are null
// except the schema version and the fan list.
var EMPTY = {
  schema: 1,
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
  gpu_detail: null
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
    schema: 1,
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
    gpu_detail: null
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

function metricsPickUnit(opts, prefs) {
  if (opts && (opts.unit === "F" || opts.unit === "f")) {
    return "F";
  }
  if (prefs && (prefs.unit === "F" || prefs.unit === "f")) {
    return "F";
  }
  return "C";
}

function metricsPickRamFormat(opts, prefs) {
  if (opts && opts.ramFormat === "used") {
    return "used";
  }
  if (opts && opts.ramFormat === "percent") {
    return "percent";
  }
  if (prefs && prefs.ramFormat === "used") {
    return "used";
  }
  return "percent";
}

function metricsPickMode(opts, prefs) {
  if (opts && (opts.mode === "digits" || opts.mode === "gauges" || opts.mode === "combo")) {
    return opts.mode;
  }
  if (prefs && (prefs.mode === "digits" || prefs.mode === "gauges" || prefs.mode === "combo")) {
    return prefs.mode;
  }
  return "digits";
}

function metricsThreshold(prefs, opts, key, fallback) {
  var v = null;
  if (prefs && typeof prefs === "object") {
    v = metricsNum(prefs[key]);
  }
  if (v === null && opts && typeof opts === "object") {
    v = metricsNum(opts[key]);
  }
  if (v === null) {
    return fallback;
  }
  return v;
}

// Build the metric catalog in default bar order:
// CPU usage, CPU temp, GPU usage, GPU temp, memory, fans as found.
function metrics(reading, opts, prefs) {
  var out = [];
  if (reading === null || reading === undefined) {
    return out;
  }
  if (typeof reading !== "object" || metricsIsArray(reading)) {
    return out;
  }
  var o = (opts && typeof opts === "object" && !metricsIsArray((opts))) ? opts : {};
  var p = (prefs && typeof prefs === "object" && !metricsIsArray((prefs))) ? prefs : {};
  var unit = metricsPickUnit(o, p);
  var ramFormat = metricsPickRamFormat(o, p);
  var mode = metricsPickMode(o, p);
  var showRpm = o.showRpm === true || (o.showRpm === undefined && p.showRpm === true);
  var showClocks = o.showClocks === true || (o.showClocks === undefined && p.showClocks === true);
  var warnU = metricsThreshold(p, o, "warnUsage", 70);
  var critU = metricsThreshold(p, o, "critUsage", 90);
  var warnT = metricsThreshold(p, o, "warnTemp", 75);
  var critT = metricsThreshold(p, o, "critTemp", 90);
  var useClocks = showClocks && mode === "digits";

  var cpuP = metricsNum(reading.cpu);
  if (cpuP !== null) {
    var cpuMhz = metricsNum(reading.cpu_mhz);
    var bar = String(Math.round(cpuP)) + "%";
    var value = String(Math.round(cpuP)) + " %";
    if (useClocks && cpuMhz !== null) {
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
    var gbar = String(Math.round(gpuP)) + "%";
    var gvalue = String(Math.round(gpuP)) + " %";
    if (useClocks && gpuMhz !== null) {
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
    memBar = String(Math.round(memP)) + "%";
    memValue = String(Math.round(memP)) + " %";
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
