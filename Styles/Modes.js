// Display modes for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: does not call into Metrics.js, it reimplements the small
// bits it needs under modes-prefixed names.

function modesIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

var MODES = ["digits", "gauges", "combo"];

var MODE_LABELS = {
  digits: "Digits",
  gauges: "Gauges",
  combo: "Combo"
};

function normalizeMode(m) {
  if (m === "digits" || m === "gauges" || m === "combo") {
    return m;
  }
  return "digits";
}

function nextMode(m) {
  var cur = normalizeMode(m);
  if (cur === "digits") {
    return "gauges";
  }
  if (cur === "gauges") {
    return "combo";
  }
  return "digits";
}

function modesIsUsage(m) {
  if (m === null || m === undefined || typeof m !== "object") {
    return false;
  }
  if (m.kind === "usage") {
    return true;
  }
  if (typeof m.key === "string" && m.key.indexOf("usage") >= 0) {
    return true;
  }
  return false;
}

function modesIsTemp(m) {
  if (m === null || m === undefined || typeof m !== "object") {
    return false;
  }
  if (m.kind === "temp") {
    return true;
  }
  if (typeof m.key === "string" && m.key.indexOf("temp") >= 0) {
    return true;
  }
  return false;
}

function modesDevice(m) {
  if (m && typeof m.device === "string" && m.device !== "") {
    return m.device;
  }
  if (m && typeof m.key === "string") {
    if (m.key.indexOf("cpu_") === 0) {
      return "cpu";
    }
    if (m.key.indexOf("gpu_") === 0) {
      return "gpu";
    }
    if (m.key.indexOf("mem") === 0) {
      return "mem";
    }
    if (m.key.indexOf("fan:") === 0) {
      return "fan";
    }
  }
  return "";
}

function modesMetricKey(m) {
  if (m && typeof m.key === "string") {
    return m.key;
  }
  return "";
}

function modesShowDigits(opts) {
  if (opts && typeof opts === "object" && !modesIsArray((opts))) {
    if (opts.showDigits === false) {
      return false;
    }
    if (opts.showDigits === true) {
      return true;
    }
  }
  return true;
}

function modesWordLabels(opts) {
  if (opts && typeof opts === "object" && !modesIsArray((opts))) {
    return opts.wordLabels === true;
  }
  return false;
}

function modesMakeMetricCell(m, words) {
  return {
    cell: "metric",
    key: modesMetricKey(m),
    metric: m,
    bare: words === true
  };
}

function modesMakeGaugeCell(m, withDigits) {
  return {
    cell: "gauge",
    key: modesMetricKey(m),
    metric: m,
    withDigits: withDigits === true
  };
}

// Build strip cells from an already visible and ordered metric list.
// digits: one metric cell per item.
// gauges: usage items become gauge cells, the rest stay metric cells.
// combo: per-device usage plus temp join, lone halves use gauge rules.
function buildStripCells(visible, mode, opts) {
  var list = [];
  if (modesIsArray(visible)) {
    list = visible;
  }
  var norm = normalizeMode(mode);
  var showDigits = modesShowDigits(opts);
  var words = modesWordLabels(opts);
  var out = [];
  var i = 0;

  if (norm === "digits") {
    for (i = 0; i < list.length; i++) {
      if (list[i]) {
        out.push(modesMakeMetricCell(list[i], words));
      }
    }
    return out;
  }

  if (norm === "gauges") {
    for (i = 0; i < list.length; i++) {
      var g = list[i];
      if (!g) {
        continue;
      }
      if (modesIsUsage(g)) {
        out.push(modesMakeGaugeCell(g, showDigits));
      } else {
        out.push(modesMakeMetricCell(g, words));
      }
    }
    return out;
  }

  var byKey = {};
  for (i = 0; i < list.length; i++) {
    var item = list[i];
    if (item && typeof item.key === "string") {
      byKey[item.key] = item;
    }
  }
  var handled = {};
  for (i = 0; i < list.length; i++) {
    var cur = list[i];
    if (!cur || typeof cur.key !== "string") {
      continue;
    }
    if (handled[cur.key]) {
      continue;
    }
    var dev = modesDevice(cur);
    var isUsage = modesIsUsage(cur);
    var isTemp = modesIsTemp(cur);
    if ((dev === "cpu" || dev === "gpu") && (isUsage || isTemp)) {
      var usageKey = dev + "_usage";
      var tempKey = dev + "_temp";
      var usage = byKey[usageKey] || null;
      var temp = byKey[tempKey] || null;
      if (!usage && isUsage) {
        usage = cur;
      }
      if (!temp && isTemp) {
        temp = cur;
      }
      if (usage && temp && !handled[usageKey] && !handled[tempKey]) {
        out.push({
          cell: "joined",
          key: usageKey + "+" + tempKey,
          usage: usage,
          temp: temp
        });
        handled[usageKey] = true;
        handled[tempKey] = true;
        continue;
      }
      handled[cur.key] = true;
      if (isUsage) {
        out.push(modesMakeGaugeCell(cur, showDigits));
      } else {
        out.push(modesMakeMetricCell(cur, words));
      }
      continue;
    }
    handled[cur.key] = true;
    if (isUsage) {
      out.push(modesMakeGaugeCell(cur, showDigits));
    } else {
      out.push(modesMakeMetricCell(cur, words));
    }
  }
  return out;
}

function modesIsHiddenKey(key, hidden) {
  if (!modesIsArray((hidden)) || hidden.length === 0) {
    return false;
  }
  var i = 0;
  for (i = 0; i < hidden.length; i++) {
    var h = hidden[i];
    if (h === key) {
      return true;
    }
    // Accept legacy keys without depending on Metrics.js.
    if ((h === "cpu" && key === "cpu_usage") || (h === "cpu_usage" && key === "cpu")) {
      return true;
    }
    if ((h === "temp" && key === "cpu_temp") || (h === "cpu_temp" && key === "temp")) {
      return true;
    }
    if ((h === "mem" && key === "mem_usage") || (h === "mem_usage" && key === "mem")) {
      return true;
    }
  }
  return false;
}

function modesPlaceholderMetric() {
  if (typeof PLACEHOLDER !== "undefined" && PLACEHOLDER) {
    return PLACEHOLDER;
  }
  return {
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
}

// Full pipeline: filter hidden, order is kept, then build cells.
// An empty result falls back to one dimmed placeholder chip.
function stripCells(allMetrics, hidden, mode, opts) {
  var list = [];
  if (modesIsArray(allMetrics)) {
    list = allMetrics;
  }
  var visible = [];
  var i = 0;
  // Prefer the shared shown() helper when it was loaded in the sandbox.
  if (typeof shown === "function") {
    try {
      visible = shown(list, hidden);
    } catch (e) {
      visible = [];
      for (i = 0; i < list.length; i++) {
        if (list[i] && !modesIsHiddenKey(list[i].key, hidden)) {
          visible.push(list[i]);
        }
      }
    }
  } else {
    for (i = 0; i < list.length; i++) {
      if (list[i] && !modesIsHiddenKey(list[i].key, hidden)) {
        visible.push(list[i]);
      }
    }
  }
  var cells = buildStripCells(visible, mode, opts);
  if (cells.length === 0) {
    var ph = modesPlaceholderMetric();
    cells.push({
      cell: "metric",
      key: "placeholder",
      metric: ph,
      bare: false
    });
  }
  return cells;
}
