// Display modes for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: does not call into Metrics.js, it reimplements the small
// bits it needs under modes-prefixed names.

function modesIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

// Two states, not three: "Number" or "Bar" for how a usage-like value
// draws. Whether two halves of a device (cpu usage+temp, net down+up,
// disk usage+io) join into one cell no longer depends on this at all —
// see PAIR_KINDS and buildStripCells below — so there is no third
// "joined" mode to pick; a group either shows the pair joined (always,
// when both halves are visible) with the first half as a number or a
// bar, exactly the two axes a user actually wants control over.
var MODES = ["digits", "gauges"];

var MODE_LABELS = {
  digits: "Number",
  gauges: "Bar"
};

// Which two metric kinds combo-mode joins into one cell, per device, and
// the metric-key suffixes that carry them (device + "_" + kind). The
// first kind takes the gauge/intensity slot, the second the digit/detail
// slot — same roles as usage+temp today, generalized to net's down+up and
// disk's usage+io. Whether the first slot actually draws a gauge still
// depends on that metric carrying a numeric `.ratio` (see modesIsUsage) —
// net's "down" has none, so a joined net cell never fakes a progress bar.
var PAIR_KINDS = {
  cpu: { first: "usage", second: "temp" },
  gpu: { first: "usage", second: "temp" },
  net: { first: "down", second: "up" },
  disk: { first: "usage", second: "io" }
};

function modesPairKindsFor(dev) {
  if (Object.prototype.hasOwnProperty.call(PAIR_KINDS, dev)) {
    return PAIR_KINDS[dev];
  }
  return null;
}

function modesKindOf(m) {
  if (m && typeof m.kind === "string") {
    return m.kind;
  }
  return "";
}

function normalizeMode(m) {
  if (m === "digits" || m === "gauges") {
    return m;
  }
  return "digits";
}

function nextMode(m) {
  var cur = normalizeMode(m);
  if (cur === "digits") {
    return "gauges";
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
// Build strip cells from an already visible and ordered metric list.
// Pairing is unconditional: whenever a device's PAIR_KINDS halves are
// both visible, they always join into one cell — that's the only way
// "usage + temp" (or down + up, usage + io) ever reads as one thing
// instead of two separately-labelled values. `mode` only decides
// whether the gaugeable half (kind "usage") draws as a number or a bar,
// for both joined and standalone cells alike.
function buildStripCells(visible, mode, opts) {
  var list = [];
  if (modesIsArray(visible)) {
    list = visible;
  }
  var norm = normalizeMode(mode);
  var useGauge = norm === "gauges";
  var showDigits = modesShowDigits(opts);
  var words = modesWordLabels(opts);
  var out = [];
  var i = 0;

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
    var pair = modesPairKindsFor(dev);
    if (pair !== null) {
      var firstKey = dev + "_" + pair.first;
      var secondKey = dev + "_" + pair.second;
      var firstM = byKey[firstKey] || null;
      var secondM = byKey[secondKey] || null;
      if (!firstM && modesKindOf(cur) === pair.first) {
        firstM = cur;
      }
      if (!secondM && modesKindOf(cur) === pair.second) {
        secondM = cur;
      }
      if (firstM && secondM && !handled[firstKey] && !handled[secondKey]) {
        out.push({
          cell: "joined",
          key: firstKey + "+" + secondKey,
          usage: firstM,
          temp: secondM,
          // A word-labelled group always reads as its label text, never
          // an icon+bar — the bar visual and the icon/word choice both
          // hang off the same glyph slot, so words wins.
          bare: words === true,
          gaugeFirst: useGauge && !words
        });
        handled[firstKey] = true;
        handled[secondKey] = true;
        continue;
      }
      handled[cur.key] = true;
      if (modesKindOf(cur) === pair.first && useGauge && !words) {
        out.push(modesMakeGaugeCell(cur, showDigits));
      } else {
        out.push(modesMakeMetricCell(cur, words));
      }
      continue;
    }
    handled[cur.key] = true;
    if (isUsage && useGauge && !words) {
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
