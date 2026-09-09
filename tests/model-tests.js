// Pure-logic model tests. Node only, no dependencies.
// Loads each Model and Styles file via vm in one shared sandbox,
// then asserts observable behavior from SPEC sections 3, 4 and 7.
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var passed = 0;
var failed = 0;
var failures = [];

function ok(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error("FAIL: " + msg);
  }
}

function eq(actual, expected, msg) {
  var same = actual === expected;
  if (!same) {
    ok(false, msg + " (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")");
  } else {
    ok(true, msg);
  }
}

function approx(actual, expected, eps, msg) {
  var diff = Math.abs(actual - expected);
  ok(diff <= eps, msg + " (expected ~" + expected + ", got " + actual + ")");
}

function deepEq(actual, expected, msg) {
  var a = JSON.stringify(actual);
  var b = JSON.stringify(expected);
  if (a !== b) {
    ok(false, msg + " (expected " + b + ", got " + a + ")");
  } else {
    ok(true, msg);
  }
}

var root = path.join(__dirname, "..");
var files = [
  "Model/Format.js",
  "Model/Severity.js",
  "Model/Metrics.js",
  "Styles/Modes.js",
  "Model/Tooltip.js",
  "Model/Prefs.js"
];

var sandbox = {};
sandbox.console = console;
vm.createContext(sandbox);
var i = 0;
for (i = 0; i < files.length; i++) {
  var full = path.join(root, files[i]);
  var code = fs.readFileSync(full, "utf8");
  try {
    vm.runInContext(code, sandbox, { filename: files[i] });
  } catch (e) {
    console.error("LOAD FAIL " + files[i] + ": " + (e && e.stack || e));
    process.exit(2);
  }
}

function S(name) {
  if (!(name in sandbox)) {
    ok(false, "missing global " + name);
    return undefined;
  }
  ok(true, "global present: " + name);
  return sandbox[name];
}

// Presence of the required API surface.
var numberOrNull = S("numberOrNull");
var celsiusToFahrenheit = S("celsiusToFahrenheit");
var convertTemp = S("convertTemp");
var tempUnitLabel = S("tempUnitLabel");
var formatTemp = S("formatTemp");
var formatTempBar = S("formatTempBar");
var formatGib = S("formatGib");
var formatGibPair = S("formatGibPair");
var formatClockShort = S("formatClockShort");
var formatClockLong = S("formatClockLong");
var formatWatts = S("formatWatts");
var ramp = S("ramp");
var usageSeverity = S("usageSeverity");
var tempSeverity = S("tempSeverity");
var GLYPH = S("GLYPH");
var EMPTY = S("EMPTY");
var LEGACY_KEYS = S("LEGACY_KEYS");
var migrateKey = S("migrateKey");
var parse = S("parse");
var hasReading = S("hasReading");
var fanLabels = S("fanLabels");
var metricsFn = S("metrics");
var orderKeys = S("orderKeys");
var shown = S("shown");
var PLACEHOLDER = S("PLACEHOLDER");
var isHidden = S("isHidden");
var MODES = S("MODES");
var MODE_LABELS = S("MODE_LABELS");
var normalizeMode = S("normalizeMode");
var nextMode = S("nextMode");
var buildStripCells = S("buildStripCells");
var stripCells = S("stripCells");
var tooltip = S("tooltip");
var tooltipJoined = S("tooltipJoined");
var tooltipFor = S("tooltipFor");
var DEFAULTS = S("DEFAULTS");
var adoptPrefs = S("adoptPrefs");
var seedPrefs = S("seedPrefs");
var serialize = S("serialize");
var migrateBarStyle = S("migrateBarStyle");

// ---------- Format ----------
eq(numberOrNull(null), null, "numberOrNull null");
eq(numberOrNull(undefined), null, "numberOrNull undefined");
eq(numberOrNull(NaN), null, "numberOrNull NaN");
eq(numberOrNull(Infinity), null, "numberOrNull Infinity");
eq(numberOrNull(12), 12, "numberOrNull number");
eq(numberOrNull("12"), 12, "numberOrNull numeric string");
eq(numberOrNull(""), null, "numberOrNull empty string");
eq(numberOrNull("abc"), null, "numberOrNull garbage string");
eq(numberOrNull(true), null, "numberOrNull boolean");

eq(celsiusToFahrenheit(0), 32, "C to F freezing");
eq(celsiusToFahrenheit(100), 212, "C to F boiling");
eq(celsiusToFahrenheit(null), null, "C to F null-safe");

eq(convertTemp(45, "C"), 45, "convertTemp C passthrough");
approx(convertTemp(45, "F"), 113, 0.001, "convertTemp C to F");
eq(convertTemp(null, "F"), null, "convertTemp null-safe");
eq(convertTemp(45, "X"), 45, "convertTemp unknown unit defaults to C");

eq(tempUnitLabel("C"), "°C", "unit label C");
eq(tempUnitLabel("F"), "°F", "unit label F");

eq(formatTemp(46, "C"), "46 °C", "formatTemp C menu");
eq(formatTemp(46, "F"), "115 °F", "formatTemp F menu");
eq(formatTemp(null, "C"), null, "formatTemp null-safe");
eq(formatTempBar(46, "C"), "46°", "formatTempBar drops unit letter");
eq(formatTempBar(46, "F"), "115°", "formatTempBar F still converts, no letter");
eq(formatTempBar(null, "C"), null, "formatTempBar null-safe");

eq(formatGib(9.36), "9.4", "GiB one decimal under 10");
eq(formatGib(9.04), "9.0", "GiB keeps trailing zero under 10");
eq(formatGib(62.4), "62", "GiB no decimals at 10 and above");
eq(formatGib(9.95), "10.0", "GiB rounding under 10");
eq(formatGib(null), null, "GiB null-safe");
eq(formatGibPair(9.36, 62.4), "9.4/62G", "GiB pair");
eq(formatGibPair(null, 62), null, "GiB pair null-safe");
eq(formatClockShort(3200), "3.2G", "clock short GHz");
eq(formatClockShort(4000), "4.0G", "clock short keeps one decimal");
eq(formatClockShort(800), "800M", "clock short MHz");
eq(formatClockShort(null), null, "clock short null-safe");
eq(formatClockLong(3200), "3.2 GHz", "clock long GHz");
eq(formatClockLong(800), "800 MHz", "clock long MHz");
eq(formatClockLong(null), null, "clock long null-safe");
eq(formatWatts(45), "45 W", "watts integer");
eq(formatWatts(45.5), "45.5 W", "watts decimal");
eq(formatWatts(null), null, "watts null-safe");

// ---------- Severity ----------
eq(ramp(60, 70, 90), 0, "ramp below warn");
eq(ramp(70, 70, 90), 0, "ramp at warn");
approx(ramp(80, 70, 90), 0.5, 0.0001, "ramp midpoint");
eq(ramp(90, 70, 90), 1, "ramp at crit");
eq(ramp(99, 70, 90), 1, "ramp above crit");
eq(ramp(null, 70, 90), 0, "ramp null-safe");
approx(ramp(50, 40, 60), 0.5, 0.0001, "ramp custom thresholds");

eq(usageSeverity(60), 0, "usage default below warn");
approx(usageSeverity(80), 0.5, 0.0001, "usage default midpoint");
eq(usageSeverity(95), 1, "usage default above crit");
eq(usageSeverity(null), 0, "usage null-safe");
approx(usageSeverity(50, 40, 60), 0.5, 0.0001, "usage custom thresholds");

eq(tempSeverity(70), 0, "temp default below warn");
approx(tempSeverity(82.5), 0.5, 0.0001, "temp default midpoint");
eq(tempSeverity(95), 1, "temp default above crit");
approx(tempSeverity(50, 40, 60), 0.5, 0.0001, "temp custom thresholds");

// ---------- Parse ----------
(function testParse() {
  var e1 = parse("not json at all {{{");
  deepEq(e1, EMPTY, "parse garbage returns EMPTY");
  ok(e1 !== EMPTY, "parse garbage returns a fresh clone, not the EMPTY reference");
  deepEq(parse(""), EMPTY, "parse empty string returns EMPTY");
  deepEq(parse(null), EMPTY, "parse null returns EMPTY");
  deepEq(parse(undefined), EMPTY, "parse undefined returns EMPTY");
  deepEq(parse(42), EMPTY, "parse number returns EMPTY");

  var part = parse('{"cpu": 12}');
  eq(part.cpu, 12, "parse partial cpu");
  eq(part.temp, null, "parse partial missing temp is null");
  eq(part.gpu, null, "parse partial missing gpu is null");
  deepEq(part.fans, [], "parse partial missing fans is empty list");
  eq(part.load, null, "parse partial missing load is null");
  eq(part.gpu_detail, null, "parse partial missing gpu_detail is null");
  eq(part.schema, 1, "parse keeps schema version default");

  var full = parse(JSON.stringify({
    schema: 1,
    cpu: 12,
    temp: 45,
    mem: 16,
    gpu: 23,
    gpu_temp: 61,
    fans: [{ id: "thinkpad/fan1", chip: "thinkpad", label: "fan1", rpm: 2262 }],
    cpu_mhz: 3200,
    gpu_mhz: 1500,
    mem_used_kib: 9500000,
    mem_total_kib: 64000000,
    swap_used_kib: 0,
    swap_total_kib: 8000000,
    cpu_model: "AMD Ryzen 7",
    cpu_cores: 16,
    load: { one: 0.42, five: 0.5, fifteen: 0.55 },
    gpu_detail: { vram_used_b: 1000000, vram_total_b: 8000000, watts: 45 }
  }));
  eq(full.cpu, 12, "parse full cpu");
  eq(full.temp, 45, "parse full temp");
  eq(full.fans.length, 1, "parse full one fan");
  eq(full.fans[0].rpm, 2262, "parse full fan rpm");
  eq(full.load.one, 0.42, "parse load.one");
  eq(full.gpu_detail.watts, 45, "parse gpu_detail watts");

  var badLoad = parse('{"load": "garbage", "gpu_detail": 42}');
  eq(badLoad.load, null, "parse bad load becomes null");
  eq(badLoad.gpu_detail, null, "parse bad gpu_detail becomes null");

  var emptyDetail = parse('{"gpu_detail": {}}');
  eq(emptyDetail.gpu_detail, null, "parse empty gpu_detail becomes null");

  var partialLoad = parse('{"load": {"one": 1.5}}');
  eq(partialLoad.load.one, 1.5, "parse partial load keeps one");
  eq(partialLoad.load.five, null, "parse partial load fills five with null");

  ok(hasReading(full) === true, "hasReading true for full doc");
  ok(hasReading(EMPTY) === false, "hasReading false for EMPTY");
  ok(hasReading(parse("garbage")) === false, "hasReading false for garbage parse");
  ok(hasReading(null) === false, "hasReading false for null");
})();

// ---------- fanLabels ----------
(function testFans() {
  var fans = [
    { id: "a/fan1", chip: "a", label: "fan1", rpm: 1000 },
    { id: "b/fan1", chip: "b", label: "fan1", rpm: 2000 },
    { id: "c/fan2", chip: "c", label: "fan2", rpm: 3000 }
  ];
  var labels = fanLabels(fans);
  eq(labels[0], "fan1 (a)", "duplicate fan label gets chip suffix");
  eq(labels[1], "fan1 (b)", "duplicate fan label gets chip suffix second");
  eq(labels[2], "fan2", "unique fan label has no suffix");
  eq(labels["a/fan1"], "fan1 (a)", "fanLabels maps id to display label");

  var uniq = fanLabels([
    { id: "x/fan1", chip: "x", label: "fan1", rpm: 1 },
    { id: "y/fan2", chip: "y", label: "fan2", rpm: 2 }
  ]);
  eq(uniq[0], "fan1", "all-unique labels unchanged");
  eq(uniq[1], "fan2", "all-unique labels unchanged second");

  var missing = fanLabels([{ id: "z/fan1", chip: "z", label: null, rpm: 5 }]);
  ok(typeof missing[0] === "string" && missing[0].length > 0, "missing label defaults to non-empty Fan N");
})();

// ---------- metrics ----------
function sampleReading() {
  return parse(JSON.stringify({
    schema: 1,
    cpu: 12,
    temp: 46,
    mem: 16,
    gpu: 23,
    gpu_temp: 61,
    fans: [{ id: "thinkpad/fan1", chip: "thinkpad", label: "fan1", rpm: 2262 }],
    cpu_mhz: 3200,
    gpu_mhz: 1500,
    mem_used_kib: 9500000,
    mem_total_kib: 64000000,
    swap_used_kib: 0,
    swap_total_kib: 8000000,
    cpu_model: "AMD Ryzen 7",
    cpu_cores: 16,
    load: { one: 0.42, five: 0.5, fifteen: 0.55 },
    gpu_detail: { vram_used_b: 2147483648, vram_total_b: 8589934592, watts: 45 }
  }));
}

(function testMetrics() {
  var r = sampleReading();
  var all = metricsFn(r, {}, { warnUsage: 70, critUsage: 90, warnTemp: 75, critTemp: 90 });
  var keys = all.map(function (m) { return m.key; });
  deepEq(keys, ["cpu_usage", "cpu_temp", "gpu_usage", "gpu_temp", "mem_usage", "fan:thinkpad/fan1"], "metrics default order with keys from spec");

  function byKey(list, key) {
    var k = 0;
    for (k = 0; k < list.length; k++) {
      if (list[k].key === key) {
        return list[k];
      }
    }
    return null;
  }

  var cpuTemp = byKey(all, "cpu_temp");
  eq(cpuTemp.bar, "46°", "temp bar drops unit letter");
  eq(cpuTemp.value, "46 °C", "temp menu value keeps unit");

  var f = metricsFn(r, { unit: "F" }, {});
  var cpuTempF = byKey(f, "cpu_temp");
  eq(cpuTempF.bar, "115°", "temp bar F conversion without letter");
  eq(cpuTempF.value, "115 °F", "temp value F conversion with unit");

  var clocked = metricsFn(r, { showClocks: true, mode: "digits" }, {});
  var cpuUsage = byKey(clocked, "cpu_usage");
  eq(cpuUsage.bar, "12% 3.2G", "clocks appended short in bar");
  eq(cpuUsage.value, "12 % · 3.2 GHz", "clocks appended long in menu");

  var noClockGauge = metricsFn(r, { showClocks: true, mode: "gauges" }, {});
  var cpuUsageGauge = byKey(noClockGauge, "cpu_usage");
  eq(cpuUsageGauge.bar, "12%", "clocks hidden in gauges mode");

  var gib = metricsFn(parse(JSON.stringify({
    cpu: null, temp: null, mem: 16, gpu: null, gpu_temp: null, fans: [],
    mem_used_kib: 9500000, mem_total_kib: 64000000
  })), { ramFormat: "used" }, {});
  var memUsed = byKey(gib, "mem_usage");
  ok(memUsed !== null, "GiB memory metric exists");
  eq(memUsed.bar, "9.1/61G", "GiB pair with one decimal under 10");

  var fallback = metricsFn(parse(JSON.stringify({ mem: 16, fans: [] })), { ramFormat: "used" }, {});
  var memFall = byKey(fallback, "mem_usage");
  eq(memFall.bar, "16%", "GiB fallback to percent when KiB missing");

  var pct = metricsFn(r, { ramFormat: "percent" }, {});
  eq(byKey(pct, "mem_usage").bar, "16%", "percent memory default");

  var stopped = metricsFn(parse(JSON.stringify({
    fans: [{ id: "a/fan1", chip: "a", label: "fan1", rpm: 0 }]
  })), {}, {});
  eq(stopped.length, 1, "stopped fan still listed");
  eq(stopped[0].bar, "0", "stopped fan bar shows 0");
  eq(stopped[0].value, "stopped", "stopped fan menu shows stopped");
  eq(stopped[0].dim, true, "stopped fan dim flag");
  eq(stopped[0].severity, 0, "stopped fan never warms");

  var bare = metricsFn(r, {}, {});
  var fan = byKey(bare, "fan:thinkpad/fan1");
  eq(fan.bar, "2262", "fans bare RPM by default");
  eq(fan.value, "2262 RPM", "fan menu value carries RPM");
  var withRpm = metricsFn(r, { showRpm: true }, {});
  eq(byKey(withRpm, "fan:thinkpad/fan1").bar, "2262 RPM", "fans carry RPM when toggled");

  var hot = metricsFn(parse(JSON.stringify({ cpu: 95, temp: 95 })), {}, { warnUsage: 70, critUsage: 90, warnTemp: 75, critTemp: 90 });
  eq(byKey(hot, "cpu_usage").severity, 1, "usage severity hits 1 at crit");
  eq(byKey(hot, "cpu_temp").severity, 1, "temp severity hits 1 at crit");
  var cool = metricsFn(parse(JSON.stringify({ cpu: 10, temp: 40 })), {}, {});
  eq(byKey(cool, "cpu_usage").severity, 0, "usage severity 0 below warn");
  eq(byKey(cool, "cpu_temp").severity, 0, "temp severity 0 below warn");

  ok(GLYPH.cpu && GLYPH.temp && GLYPH.gpu && GLYPH.mem && GLYPH.fan, "GLYPH map has all five entries");
  ok(PLACEHOLDER && PLACEHOLDER.key === "placeholder", "PLACEHOLDER present");
  eq(migrateKey("cpu"), "cpu_usage", "migrateKey cpu");
  eq(migrateKey("temp"), "cpu_temp", "migrateKey temp");
  eq(migrateKey("mem"), "mem_usage", "migrateKey mem");
  eq(migrateKey("cpu_usage"), "cpu_usage", "migrateKey passthrough");
})();

// ---------- ordering ----------
(function testOrdering() {
  var r = sampleReading();
  var all = metricsFn(r, {}, {});
  var reordered = orderKeys(all, ["mem_usage", "cpu_usage"]);
  eq(reordered[0].key, "mem_usage", "orderKeys honors user order first");
  eq(reordered[1].key, "cpu_usage", "orderKeys honors user order second");
  eq(reordered.length, all.length, "orderKeys keeps all metrics");
  eq(reordered[2].key, "cpu_temp", "orderKeys appends unknown keys in default order");

  var ignored = orderKeys(all, ["nope", "cpu_temp"]);
  eq(ignored[0].key, "cpu_temp", "orderKeys ignores unknown order entries");
  ok(ignored.length === all.length, "orderKeys length stable with unknown entries");

  var visible = shown(all, ["cpu_temp"]);
  ok(visible.every(function (m) { return m.key !== "cpu_temp"; }), "shown filters hidden");
  eq(shown(all, []).length, all.length, "shown empty hidden keeps all");
  ok(isHidden("cpu_temp", ["cpu_temp"]) === true, "isHidden direct");
  ok(isHidden("cpu_usage", ["cpu"]) === true, "isHidden migrates legacy keys");
  ok(isHidden("cpu_usage", []) === false, "isHidden false when not hidden");
})();

// ---------- modes ----------
(function testModes() {
  deepEq(MODES, ["digits", "gauges", "combo"], "MODES list");
  eq(MODE_LABELS.digits, "Digits", "MODE_LABELS digits");
  eq(normalizeMode("gauges"), "gauges", "normalizeMode keeps valid");
  eq(normalizeMode("bogus"), "digits", "normalizeMode defaults");
  eq(nextMode("digits"), "gauges", "nextMode digits to gauges");
  eq(nextMode("gauges"), "combo", "nextMode gauges to combo");
  eq(nextMode("combo"), "digits", "nextMode combo wraps");

  var r = sampleReading();
  var all = metricsFn(r, {}, {});
  var visible = shown(all, []);

  var digits = buildStripCells(visible, "digits", { showDigits: true, wordLabels: false });
  eq(digits.length, visible.length, "digits one cell per metric");
  ok(digits.every(function (c) { return c.cell === "metric"; }), "digits all metric cells");

  var words = buildStripCells(visible, "digits", { showDigits: true, wordLabels: true });
  ok(words.every(function (c) { return c.bare === true; }), "wordLabels sets bare on metric cells");
  ok(digits.every(function (c) { return c.bare === false; }), "digits without words has bare false");

  var gauges = buildStripCells(visible, "gauges", { showDigits: true, wordLabels: false });
  function findCell(cells, key) {
    var k = 0;
    for (k = 0; k < cells.length; k++) {
      if (cells[k].key === key) {
        return cells[k];
      }
    }
    return null;
  }
  var cpuGauge = findCell(gauges, "cpu_usage");
  eq(cpuGauge.cell, "gauge", "gauges usage becomes gauge");
  eq(cpuGauge.withDigits, true, "gauge carries digits when showDigits");
  var noDigits = buildStripCells(visible, "gauges", { showDigits: false, wordLabels: false });
  eq(findCell(noDigits, "cpu_usage").withDigits, false, "gauge without digits variant");
  eq(findCell(gauges, "cpu_temp").cell, "metric", "gauges temp stays metric");
  eq(findCell(gauges, "fan:thinkpad/fan1").cell, "metric", "gauges fan stays metric");

  var combo = buildStripCells(visible, "combo", { showDigits: true, wordLabels: false });
  var joinedCpu = findCell(combo, "cpu_usage+cpu_temp");
  ok(joinedCpu !== null && joinedCpu.cell === "joined", "combo joins cpu usage and temp");
  eq(joinedCpu.usage.key, "cpu_usage", "joined keeps usage half");
  eq(joinedCpu.temp.key, "cpu_temp", "joined keeps temp half");
  var joinedGpu = findCell(combo, "gpu_usage+gpu_temp");
  ok(joinedGpu !== null, "combo joins gpu halves");

  var loneReading = parse(JSON.stringify({ cpu: 12, temp: null, fans: [] }));
  var loneMetrics = metricsFn(loneReading, {}, {});
  var loneVisible = shown(loneMetrics, []);
  var loneCombo = buildStripCells(loneVisible, "combo", { showDigits: true, wordLabels: false });
  eq(loneCombo.length, 1, "lone half falls back to single cell");
  eq(loneCombo[0].cell, "gauge", "lone usage half uses gauge rule");

  var loneTempReading = parse(JSON.stringify({ cpu: null, temp: 50, fans: [] }));
  var loneTempMetrics = metricsFn(loneTempReading, {}, {});
  var loneTempCombo = buildStripCells(shown(loneTempMetrics, []), "combo", { showDigits: true, wordLabels: false });
  eq(loneTempCombo[0].cell, "metric", "lone temp half uses metric rule");

  var allHidden = stripCells(all, all.map(function (m) { return m.key; }), "digits", { showDigits: true, wordLabels: false });
  eq(allHidden.length, 1, "all hidden yields placeholder");
  eq(allHidden[0].metric.key, "placeholder", "placeholder fallback metric");
})();

// ---------- tooltip ----------
(function testTooltip() {
  var r = sampleReading();
  var all = metricsFn(r, {}, {});
  function byKey(list, key) {
    var k = 0;
    for (k = 0; k < list.length; k++) {
      if (list[k].key === key) {
        return list[k];
      }
    }
    return null;
  }
  var cpuUsage = byKey(all, "cpu_usage");
  var cpuTemp = byKey(all, "cpu_temp");
  var gpuUsage = byKey(all, "gpu_usage");
  var memMetric = byKey(all, "mem_usage");

  var t = tooltip(cpuUsage, r, {});
  var lines = t.split("\n");
  eq(lines[0], "CPU usage: 12 %", "tooltip headline first");
  ok(t.indexOf("AMD Ryzen 7") >= 0, "tooltip shows CPU model");
  ok(t.indexOf("16 cores") >= 0, "tooltip shows core count");
  ok(t.indexOf("Load") >= 0, "tooltip shows load average");
  ok(t.indexOf("GHz") >= 0, "tooltip shows clocks");
  ok(t.indexOf("null") < 0, "tooltip skips nulls silently");

  var bare = tooltip(cpuUsage, null, {});
  ok(bare.split("\n")[0].indexOf("CPU usage:") === 0, "tooltip without reading still headlines");

  var g = tooltip(gpuUsage, r, {});
  ok(g.indexOf("VRAM") >= 0, "tooltip shows VRAM");
  ok(g.indexOf("45 W") >= 0, "tooltip shows watts");
  ok(g.indexOf("GHz") >= 0, "tooltip shows GPU clock");

  var memPct = tooltip(memMetric, r, { ramFormat: "percent" });
  ok(memPct.indexOf("GiB") >= 0, "memory tooltip shows non-headline GiB format");
  ok(memPct.indexOf("Swap") >= 0, "memory tooltip shows swap when known");

  var memUsedMetric = byKey(metricsFn(r, { ramFormat: "used" }, {}), "mem_usage");
  var memUsedTip = tooltip(memUsedMetric, r, { ramFormat: "used" });
  ok(memUsedTip.indexOf("16 %") >= 0, "used headline tooltip shows percent detail");

  var noSwap = tooltip(byKey(metricsFn(parse(JSON.stringify({ mem: 20, fans: [] })), {}, {}), "mem_usage"), parse(JSON.stringify({ mem: 20, fans: [] })), {});
  ok(noSwap.indexOf("Swap") < 0, "tooltip skips swap when unknown");

  var joined = tooltipJoined(cpuUsage, cpuTemp, r, {});
  ok(joined.indexOf("CPU usage:") >= 0 && joined.indexOf("CPU temp:") >= 0, "joined tooltip shows both halves");

  var cells = buildStripCells(shown(all, []), "combo", { showDigits: true, wordLabels: false });
  var joinedCell = null;
  var q = 0;
  for (q = 0; q < cells.length; q++) {
    if (cells[q].cell === "joined") {
      joinedCell = cells[q];
      break;
    }
  }
  var cellTip = tooltipFor(joinedCell, r, { ramFormat: "percent" });
  ok(cellTip.indexOf("CPU usage:") >= 0, "tooltipFor joined dispatches");

  var metricCell = { cell: "metric", key: cpuTemp.key, metric: cpuTemp, bare: false };
  var singleTip = tooltipFor(metricCell, r, {});
  ok(singleTip.indexOf("CPU temp:") === 0, "tooltipFor metric dispatches");
})();

// ---------- prefs ----------
(function testPrefs() {
  eq(DEFAULTS.version, 1, "DEFAULTS version 1");
  eq(DEFAULTS.mode, "digits", "DEFAULTS mode digits");
  eq(DEFAULTS.showDigits, true, "DEFAULTS showDigits true");
  eq(DEFAULTS.wordLabels, false, "DEFAULTS wordLabels false");
  eq(DEFAULTS.colorMode, "auto", "DEFAULTS colorMode auto");
  eq(DEFAULTS.warnUsage, 70, "DEFAULTS warnUsage");
  eq(DEFAULTS.critUsage, 90, "DEFAULTS critUsage");
  eq(DEFAULTS.warnTemp, 75, "DEFAULTS warnTemp");
  eq(DEFAULTS.critTemp, 90, "DEFAULTS critTemp");

  var corrupt = adoptPrefs("{{{ not json");
  deepEq(corrupt, DEFAULTS, "adoptPrefs corrupt string returns defaults");
  deepEq(adoptPrefs(null), DEFAULTS, "adoptPrefs null returns defaults");
  deepEq(adoptPrefs(42), DEFAULTS, "adoptPrefs number returns defaults");

  var unit = adoptPrefs({ unit: "F" });
  eq(unit.unit, "F", "adoptPrefs keeps F unit");
  eq(adoptPrefs({ unit: "X" }).unit, "C", "adoptPrefs clamps bad unit to C");

  var strict = adoptPrefs({ showRpm: 1, showDigits: 0, wordLabels: "yes", showClocks: "true" });
  eq(strict.showRpm, false, "adoptPrefs booleans strict showRpm");
  eq(strict.showDigits, true, "adoptPrefs booleans strict showDigits default");
  eq(strict.wordLabels, false, "adoptPrefs booleans strict wordLabels");
  eq(strict.showClocks, false, "adoptPrefs booleans strict showClocks");

  eq(adoptPrefs({ mode: "combo" }).mode, "combo", "adoptPrefs keeps valid mode");
  eq(adoptPrefs({ mode: "bogus" }).mode, "digits", "adoptPrefs normalizes bad mode");

  eq(adoptPrefs({ colorMode: "graphite" }).colorMode, "graphite", "adoptPrefs keeps graphite");
  eq(adoptPrefs({ colorMode: "pink" }).colorMode, "auto", "adoptPrefs clamps bad colorMode");

  eq(adoptPrefs({ ramFormat: "used" }).ramFormat, "used", "adoptPrefs keeps GiB memory");
  eq(adoptPrefs({ ramFormat: "x" }).ramFormat, "percent", "adoptPrefs clamps bad ramFormat");

  var clamped = adoptPrefs({ warnUsage: -5, critUsage: 500, warnTemp: -10, critTemp: 999 });
  eq(clamped.warnUsage, 0, "adoptPrefs clamps usage warn low");
  eq(clamped.critUsage, 100, "adoptPrefs clamps usage crit high");
  eq(clamped.warnTemp, 0, "adoptPrefs clamps temp warn low");
  eq(clamped.critTemp, 150, "adoptPrefs clamps temp crit high");

  var narrowed = adoptPrefs({ warnUsage: 90, critUsage: 90 });
  ok(narrowed.warnUsage < narrowed.critUsage, "adoptPrefs enforces warn less than crit usage");
  var narrowedT = adoptPrefs({ warnTemp: 100, critTemp: 80 });
  ok(narrowedT.warnTemp < narrowedT.critTemp, "adoptPrefs enforces warn less than crit temp");

  var seeded = seedPrefs({ unit: "F", mode: "combo" });
  eq(seeded.unit, "F", "seedPrefs picks unit from shell object");
  eq(seeded.mode, "combo", "seedPrefs picks mode from shell object");
  deepEq(seedPrefs(null), DEFAULTS, "seedPrefs null returns defaults");

  var migratedHidden = adoptPrefs({ hidden: ["cpu", "temp", "mem", "gpu_usage"] });
  deepEq(migratedHidden.hidden, ["cpu_usage", "cpu_temp", "mem_usage", "gpu_usage"], "adoptPrefs migrates legacy hidden keys");

  eq(migrateBarStyle({ barStyle: "numbers" }).mode, "digits", "migrate numbers to digits");
  var bars = migrateBarStyle({ barStyle: "bars" });
  eq(bars.mode, "gauges", "migrate bars to gauges");
  eq(bars.showDigits, false, "migrate bars without digits");
  var barsDigits = migrateBarStyle({ barStyle: "bars+digits" });
  eq(barsDigits.mode, "gauges", "migrate bars+digits to gauges");
  eq(barsDigits.showDigits, true, "migrate bars+digits with digits");
  eq(migrateBarStyle({ barStyle: "bar+temp" }).mode, "combo", "migrate bar+temp to combo");
  var labels = migrateBarStyle({ barStyle: "labels" });
  eq(labels.mode, "digits", "migrate labels to digits");
  eq(labels.wordLabels, true, "migrate labels to words");

  var legacyFile = migrateBarStyle({
    unit: "F",
    showRpm: true,
    barStyle: "bars+digits",
    showClocks: true,
    ramFormat: "used",
    hidden: ["cpu", "temp"]
  });
  eq(legacyFile.version, 1, "migrate legacy file sets version 1");
  eq(legacyFile.unit, "F", "migrate legacy file keeps unit");
  eq(legacyFile.mode, "gauges", "migrate legacy file maps style");
  deepEq(legacyFile.hidden, ["cpu_usage", "cpu_temp"], "migrate legacy file migrates hidden keys");

  var ser = serialize({ unit: "F", mode: "combo", warnUsage: 60 });
  var parsedBack = JSON.parse(ser);
  eq(parsedBack.unit, "F", "serialize round trip unit");
  eq(parsedBack.mode, "combo", "serialize round trip mode");
  var keyOrder = Object.keys(parsedBack);
  deepEq(keyOrder, ["version", "hidden", "order", "unit", "showRpm", "mode", "showDigits", "wordLabels", "colorMode", "showClocks", "ramFormat", "warnUsage", "critUsage", "warnTemp", "critTemp"], "serialize stable key order");
})();

console.log("PASS " + passed + " assertions, FAIL " + failed);
if (failed > 0) {
  console.error(failures.length + " failures:");
  var f = 0;
  for (f = 0; f < failures.length; f++) {
    console.error(" - " + failures[f]);
  }
  process.exit(1);
}
