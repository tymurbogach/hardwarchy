// Pure-logic model tests. Node only, no dependencies.
// Loads each Model and Styles file via vm in one shared sandbox,
// then asserts observable behavior from SPEC sections 2-7 (v2 schema:
// monitor groups, per-group display config, generalized combo pairing).
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
var GROUP_LABELS = S("GROUP_LABELS");
var EMPTY = S("EMPTY");
var LEGACY_KEYS = S("LEGACY_KEYS");
var migrateKey = S("migrateKey");
var parse = S("parse");
var hasReading = S("hasReading");
var mergeReading = S("mergeReading");
var fanLabels = S("fanLabels");
var metricsFn = S("metrics");
var orderKeys = S("orderKeys");
var shown = S("shown");
var PLACEHOLDER = S("PLACEHOLDER");
var isHidden = S("isHidden");
var metricsExpandGroupOrder = S("metricsExpandGroupOrder");
var metricsEffectiveHidden = S("metricsEffectiveHidden");
var metricsGroupRuns = S("metricsGroupRuns");
var MODES = S("MODES");
var MODE_LABELS = S("MODE_LABELS");
var PAIR_KINDS = S("PAIR_KINDS");
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
  eq(part.schema, 2, "parse keeps schema version default");

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

  // mergeReading: one-time grace after a deliberate collector restart —
  // a freshly-primed null cpu/gpu borrows the previous reading's value;
  // every other field always comes from the new reading as-is.
  var before = parse(JSON.stringify({ cpu: 42, gpu: 17, temp: 40, mem: 50 }));
  var justRestarted = parse(JSON.stringify({ cpu: null, gpu: null, temp: 41, mem: 51 }));
  var merged = mergeReading(before, justRestarted);
  eq(merged.cpu, 42, "mergeReading borrows previous cpu when the new one is still priming");
  eq(merged.gpu, 17, "mergeReading borrows previous gpu when the new one is still priming");
  eq(merged.temp, 41, "mergeReading never touches non-primed fields");
  eq(merged.mem, 51, "mergeReading never touches non-primed fields (mem)");

  // mergeReading itself is pure and stateless — it merges whatever pair
  // it's given every time. The "only once per restart" guarantee comes
  // from the caller (BarWidget.qml only merges while its own
  // primingAfterRestart flag is set, clearing it right after), not from
  // this function refusing a second call.
  var stillNull = parse(JSON.stringify({ cpu: null, gpu: null, temp: 41, mem: 51 }));
  eq(mergeReading(stillNull, stillNull).cpu, null, "mergeReading has nothing to borrow when the previous reading was already null");

  eq(mergeReading(null, justRestarted), justRestarted, "mergeReading with no previous reading returns the new one untouched");
  eq(mergeReading(before, null), null, "mergeReading null-safe on the new reading");
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
// metrics(reading, groupModes, prefs): groupModes carries each device's
// already-resolved mode (only cpu/gpu matter, for the clocks option);
// prefs is read directly (prefs.groups.<id>.*, prefs.warnUsage, etc) with
// defensive fallbacks everywhere a field is missing, so tests can pass
// minimal ad-hoc shapes without going through adoptPrefs.
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

function byKey(list, key) {
  var k = 0;
  for (k = 0; k < list.length; k++) {
    if (list[k].key === key) {
      return list[k];
    }
  }
  return null;
}

(function testMetrics() {
  var r = sampleReading();
  var all = metricsFn(r, {}, { warnUsage: 70, critUsage: 90, warnTemp: 75, critTemp: 90 });
  var keys = all.map(function (m) { return m.key; });
  deepEq(keys, ["cpu_usage", "cpu_temp", "gpu_usage", "gpu_temp", "mem_usage", "fan:thinkpad/fan1"], "metrics default order with keys from spec");

  var cpuTemp = byKey(all, "cpu_temp");
  eq(cpuTemp.bar, "46°", "temp bar drops unit letter");
  eq(cpuTemp.value, "46 °C", "temp menu value keeps unit");

  var f = metricsFn(r, {}, { unit: "F" });
  var cpuTempF = byKey(f, "cpu_temp");
  eq(cpuTempF.bar, "115°", "temp bar F conversion without letter");
  eq(cpuTempF.value, "115 °F", "temp value F conversion with unit");

  var clocked = metricsFn(r, { cpu: "digits" }, { groups: { cpu: { showClocks: true } } });
  var cpuUsage = byKey(clocked, "cpu_usage");
  eq(cpuUsage.bar, "12% 3.2G", "clocks appended short in bar");
  eq(cpuUsage.value, "12 % · 3.2 GHz", "clocks appended long in menu");

  var noClockGauge = metricsFn(r, { cpu: "gauges" }, { groups: { cpu: { showClocks: true } } });
  var cpuUsageGauge = byKey(noClockGauge, "cpu_usage");
  eq(cpuUsageGauge.bar, "12%", "clocks hidden when the CPU's own mode isn't digits");

  var clockedGpu = metricsFn(r, { gpu: "digits" }, { groups: { gpu: { showClocks: true } } });
  eq(byKey(clockedGpu, "gpu_usage").bar, "23% 1.5G", "GPU clocks are independent of the CPU's own showClocks");

  var gib = metricsFn(parse(JSON.stringify({
    cpu: null, temp: null, mem: 16, gpu: null, gpu_temp: null, fans: [],
    mem_used_kib: 9500000, mem_total_kib: 64000000
  })), {}, { groups: { mem: { ramFormat: "used" } } });
  var memUsed = byKey(gib, "mem_usage");
  ok(memUsed !== null, "GiB memory metric exists");
  eq(memUsed.bar, "9.1/61G", "GiB pair with one decimal under 10");

  var fallback = metricsFn(parse(JSON.stringify({ mem: 16, fans: [] })), {}, { groups: { mem: { ramFormat: "used" } } });
  var memFall = byKey(fallback, "mem_usage");
  eq(memFall.bar, "16%", "GiB fallback to percent when KiB missing");

  var pct = metricsFn(r, {}, { groups: { mem: { ramFormat: "percent" } } });
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
  var withRpm = metricsFn(r, {}, { groups: { fan: { showRpm: true } } });
  eq(byKey(withRpm, "fan:thinkpad/fan1").bar, "2262 RPM", "fans carry RPM when toggled");

  var hot = metricsFn(parse(JSON.stringify({ cpu: 95, temp: 95 })), {}, { warnUsage: 70, critUsage: 90, warnTemp: 75, critTemp: 90 });
  eq(byKey(hot, "cpu_usage").severity, 1, "usage severity hits 1 at crit");
  eq(byKey(hot, "cpu_temp").severity, 1, "temp severity hits 1 at crit");
  var cool = metricsFn(parse(JSON.stringify({ cpu: 10, temp: 40 })), {}, {});
  eq(byKey(cool, "cpu_usage").severity, 0, "usage severity 0 below warn");
  eq(byKey(cool, "cpu_temp").severity, 0, "temp severity 0 below warn");

  // Usage percentages zero-pad under 10% so the leading digit's width is
  // stable, and report how many of those leading characters are padding.
  var single = metricsFn(parse(JSON.stringify({ cpu: 3, mem: 6 })), {}, {});
  eq(byKey(single, "cpu_usage").bar, "03%", "cpu usage pads under 10%");
  eq(byKey(single, "cpu_usage").padLen, 1, "cpu usage reports one padding char under 10%");
  eq(byKey(single, "mem_usage").bar, "06%", "mem usage pads under 10%");
  eq(byKey(single, "mem_usage").padLen, 1, "mem usage reports one padding char under 10%");
  var double = metricsFn(parse(JSON.stringify({ cpu: 45 })), {}, {});
  eq(byKey(double, "cpu_usage").bar, "45%", "cpu usage at/above 10% is not padded");
  eq(byKey(double, "cpu_usage").padLen, 0, "cpu usage reports no padding at/above 10%");
  var gpuSingle = metricsFn(parse(JSON.stringify({ gpu: 4 })), {}, {});
  eq(byKey(gpuSingle, "gpu_usage").padLen, 1, "gpu usage pads the same way");
  var memGib = metricsFn(parse(JSON.stringify({ mem_used_kib: 500000, mem_total_kib: 64000000 })), {}, { groups: { mem: { ramFormat: "used" } } });
  eq(byKey(memGib, "mem_usage").padLen, 0, "GiB-format memory is never treated as padded (not a plain percentage)");

  ok(GLYPH.cpu && GLYPH.temp && GLYPH.gpu && GLYPH.mem && GLYPH.fan, "GLYPH map has all five entries");
  ok(PLACEHOLDER && PLACEHOLDER.key === "placeholder", "PLACEHOLDER present");
  deepEq(GROUP_LABELS, { cpu: "CPU", gpu: "GPU", mem: "RAM", net: "Net", disk: "Disk", fan: "Fans" }, "GROUP_LABELS short English names");
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

  // Group-order expansion: reusable directly with orderKeys().
  var expanded = metricsExpandGroupOrder(["mem", "cpu"], null);
  deepEq(expanded, ["mem_usage", "cpu_usage", "cpu_temp"], "metricsExpandGroupOrder expands kinds per group in order");
  var withFans = metricsExpandGroupOrder(["fan", "cpu"], ["fan:b", "fan:a"]);
  deepEq(withFans, ["fan:b", "fan:a", "cpu_usage", "cpu_temp"], "metricsExpandGroupOrder uses the fan sub-order verbatim");
  deepEq(metricsExpandGroupOrder(["fan"], null), [], "metricsExpandGroupOrder with no fan order yields nothing (orderKeys appends unknowns)");

  var groupOrdered = orderKeys(all, metricsExpandGroupOrder(["mem", "gpu", "cpu", "fan"], null));
  deepEq(groupOrdered.map(function (m) { return m.key; }),
    ["mem_usage", "gpu_usage", "gpu_temp", "cpu_usage", "cpu_temp", "fan:thinkpad/fan1"],
    "orderKeys + metricsExpandGroupOrder reproduces a full group reorder");

  // Effective hidden derived from prefs.groups.
  var prefsAllOn = adoptPrefs({});
  eq(metricsEffectiveHidden(all, prefsAllOn).length, 0, "effectiveHidden empty when every group enabled");

  var prefsMemOff = adoptPrefs({});
  prefsMemOff.groups.mem.enabled = false;
  deepEq(metricsEffectiveHidden(all, prefsMemOff), ["mem_usage"], "effectiveHidden hides a disabled group's only metric");

  var prefsCpuSplit = adoptPrefs({});
  prefsCpuSplit.groups.cpu.showTemp = false;
  deepEq(metricsEffectiveHidden(all, prefsCpuSplit), ["cpu_temp"], "effectiveHidden hides just one sub-toggle, not the whole group");

  var prefsFanHidden = adoptPrefs({});
  prefsFanHidden.groups.fan.hidden = ["fan:thinkpad/fan1"];
  deepEq(metricsEffectiveHidden(all, prefsFanHidden), ["fan:thinkpad/fan1"], "effectiveHidden respects the fan group's own hidden list");

  // Contiguous per-device runs, the shared clustering both the bar and
  // the menu build their per-group view from.
  var runs = metricsGroupRuns(all);
  deepEq(runs.map(function (r) { return r.device; }), ["cpu", "gpu", "mem", "fan"], "metricsGroupRuns clusters by device in order");
  eq(runs[0].items.length, 2, "metricsGroupRuns keeps cpu's two metrics together");
})();

// ---------- modes ----------
(function testModes() {
  deepEq(MODES, ["digits", "gauges"], "MODES list: Number and Bar, no separate joined mode");
  eq(MODE_LABELS.digits, "Number", "MODE_LABELS digits label");
  eq(MODE_LABELS.gauges, "Bar", "MODE_LABELS gauges label");
  eq(normalizeMode("gauges"), "gauges", "normalizeMode keeps valid");
  eq(normalizeMode("bogus"), "digits", "normalizeMode defaults");
  eq(nextMode("digits"), "gauges", "nextMode digits to gauges");
  eq(nextMode("gauges"), "digits", "nextMode gauges wraps back to digits");
  deepEq(PAIR_KINDS.net, { first: "down", second: "up" }, "PAIR_KINDS declares net's down+up pairing");
  deepEq(PAIR_KINDS.disk, { first: "usage", second: "io" }, "PAIR_KINDS declares disk's usage+io pairing");

  var r = sampleReading();
  var all = metricsFn(r, {}, {});
  var visible = shown(all, []);

  function findCell(cells, key) {
    var k = 0;
    for (k = 0; k < cells.length; k++) {
      if (cells[k].key === key) {
        return cells[k];
      }
    }
    return null;
  }

  // Pairing is unconditional in BOTH modes now: cpu usage+temp and gpu
  // usage+temp always join, whether the mode is Number or Bar. mem and
  // fan have no pair partner, so they stay lone cells either way.
  var digits = buildStripCells(visible, "digits", { showDigits: true, wordLabels: false });
  eq(digits.length, 4, "Number mode still joins pairs: cpu+gpu joined, mem+fan lone (4 cells for 6 metrics)");
  var joinedCpuDigits = findCell(digits, "cpu_usage+cpu_temp");
  ok(joinedCpuDigits !== null && joinedCpuDigits.cell === "joined", "cpu usage+temp join even in Number mode");
  eq(joinedCpuDigits.gaugeFirst, false, "Number mode's joined cell doesn't gauge its first half");
  eq(joinedCpuDigits.bare, false, "joined cell defaults to bare false (icon, not word)");
  ok(digits.every(function (c) { return c.cell !== "gauge"; }), "Number mode never produces a bare gauge cell");

  var words = buildStripCells(visible, "digits", { showDigits: true, wordLabels: true });
  eq(findCell(words, "mem_usage").bare, true, "wordLabels sets bare on a lone (non-joined) metric cell");
  eq(findCell(digits, "mem_usage").bare, false, "digits without words has bare false");
  var joinedCpuWords = findCell(words, "cpu_usage+cpu_temp");
  eq(joinedCpuWords.bare, true, "wordLabels also sets bare on a joined cell (icon never sneaks back in)");
  eq(joinedCpuWords.gaugeFirst, false, "a word-labelled joined cell never gauges its usage half");

  var gauges = buildStripCells(visible, "gauges", { showDigits: true, wordLabels: false });
  var joinedCpuGauges = findCell(gauges, "cpu_usage+cpu_temp");
  ok(joinedCpuGauges !== null && joinedCpuGauges.cell === "joined", "cpu usage+temp still join in Bar mode");
  eq(joinedCpuGauges.gaugeFirst, true, "Bar mode's joined cell gauges its first (usage) half");
  eq(joinedCpuGauges.bare, false, "Bar mode without words keeps bare false");
  var memGauge = findCell(gauges, "mem_usage");
  eq(memGauge.cell, "gauge", "a lone usage-kind metric becomes a gauge cell in Bar mode");
  eq(memGauge.withDigits, true, "gauge carries digits when showDigits");
  var noDigits = buildStripCells(visible, "gauges", { showDigits: false, wordLabels: false });
  eq(findCell(noDigits, "mem_usage").withDigits, false, "gauge without digits variant");
  eq(findCell(gauges, "fan:thinkpad/fan1").cell, "metric", "a fan (not kind usage) never gauges");

  // A word-labelled group wins over Bar mode entirely: no icon+bar ever
  // sneaks back in just because the mode is "gauges" (this is what makes
  // "RAM" default to a word label safe regardless of the chosen mode).
  var gaugeWords = buildStripCells(visible, "gauges", { showDigits: true, wordLabels: true });
  var memGaugeWords = findCell(gaugeWords, "mem_usage");
  eq(memGaugeWords.cell, "metric", "Bar mode + words: lone usage-kind stays a metric cell, not a gauge");
  eq(memGaugeWords.bare, true, "Bar mode + words: lone usage-kind is bare (word label)");
  var joinedCpuGaugeWords = findCell(gaugeWords, "cpu_usage+cpu_temp");
  eq(joinedCpuGaugeWords.bare, true, "Bar mode + words: joined cell is still bare");
  eq(joinedCpuGaugeWords.gaugeFirst, false, "Bar mode + words: joined cell still never gauges");

  var loneReading = parse(JSON.stringify({ cpu: 12, temp: null, fans: [] }));
  var loneMetrics = metricsFn(loneReading, {}, {});
  var loneVisible = shown(loneMetrics, []);
  var loneGauges = buildStripCells(loneVisible, "gauges", { showDigits: true, wordLabels: false });
  eq(loneGauges.length, 1, "lone half falls back to a single cell");
  eq(loneGauges[0].cell, "gauge", "lone usage half uses the gauge rule in Bar mode");
  var loneDigits = buildStripCells(loneVisible, "digits", { showDigits: true, wordLabels: false });
  eq(loneDigits[0].cell, "metric", "lone usage half uses the metric rule in Number mode");
  var loneGaugeWords = buildStripCells(loneVisible, "gauges", { showDigits: true, wordLabels: true });
  eq(loneGaugeWords[0].cell, "metric", "lone usage half (pair-first) also respects words over Bar mode");
  eq(loneGaugeWords[0].bare, true, "lone usage half (pair-first) is bare when words is set");

  var loneTempReading = parse(JSON.stringify({ cpu: null, temp: 50, fans: [] }));
  var loneTempMetrics = metricsFn(loneTempReading, {}, {});
  var loneTempCells = buildStripCells(shown(loneTempMetrics, []), "gauges", { showDigits: true, wordLabels: false });
  eq(loneTempCells[0].cell, "metric", "lone temp half never gauges, in either mode");

  var allHidden = stripCells(all, all.map(function (m) { return m.key; }), "digits", { showDigits: true, wordLabels: false });
  eq(allHidden.length, 1, "all hidden yields placeholder");
  eq(allHidden[0].metric.key, "placeholder", "placeholder fallback metric");

  // The pairing table is data-driven, so a hand-built net/disk-shaped
  // metric list joins exactly like cpu/gpu do.
  var netDown = { key: "net_down", device: "net", kind: "down", label: "Net down", glyph: "", bar: "1.2M", value: "1.2 MB/s", severity: 0, dim: false };
  var netUp = { key: "net_up", device: "net", kind: "up", label: "Net up", glyph: "", bar: "340K", value: "340 KB/s", severity: 0, dim: false };
  var netJoined = buildStripCells([netDown, netUp], "gauges", { showDigits: true, wordLabels: false });
  eq(netJoined.length, 1, "net down+up always join");
  eq(netJoined[0].cell, "joined", "net pair becomes a joined cell");
  eq(netJoined[0].usage.key, "net_down", "net joined cell's first slot is down");
  eq(netJoined[0].temp.key, "net_up", "net joined cell's second slot is up");
  // gaugeFirst just mirrors the mode here; MetricButton is what actually
  // skips drawing a gauge when the metric has no numeric .ratio (down/up
  // never do) — that's confirmed at the QML layer, not this one.

  var diskUsage = { key: "disk_usage", device: "disk", kind: "usage", label: "Disk usage", glyph: "", bar: "63%", value: "63 %", severity: 0, dim: false, ratio: 0.63 };
  var diskIo = { key: "disk_io", device: "disk", kind: "io", label: "Disk I/O", glyph: "", bar: "40K", value: "40 KB/s", severity: 0, dim: false };
  var diskJoined = buildStripCells([diskUsage, diskIo], "digits", { showDigits: true, wordLabels: false });
  eq(diskJoined.length, 1, "disk usage+io always join");
  eq(diskJoined[0].usage.key, "disk_usage", "disk joined cell's first slot is usage (gaugeable, has .ratio)");
  eq(diskJoined[0].gaugeFirst, false, "Number mode: disk joined cell doesn't gauge its usage half");
})();

// ---------- tooltip ----------
(function testTooltip() {
  var r = sampleReading();
  var all = metricsFn(r, {}, {});
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

  var memUsedMetric = byKey(metricsFn(r, {}, { groups: { mem: { ramFormat: "used" } } }), "mem_usage");
  var memUsedTip = tooltip(memUsedMetric, r, { ramFormat: "used" });
  ok(memUsedTip.indexOf("16 %") >= 0, "used headline tooltip shows percent detail");

  var noSwap = tooltip(byKey(metricsFn(parse(JSON.stringify({ mem: 20, fans: [] })), {}, {}), "mem_usage"), parse(JSON.stringify({ mem: 20, fans: [] })), {});
  ok(noSwap.indexOf("Swap") < 0, "tooltip skips swap when unknown");

  var joined = tooltipJoined(cpuUsage, cpuTemp, r, {});
  ok(joined.indexOf("CPU usage:") >= 0 && joined.indexOf("CPU temp:") >= 0, "joined tooltip shows both halves");

  var cells = buildStripCells(shown(all, []), "gauges", { showDigits: true, wordLabels: false });
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

// ---------- prefs (v2) ----------
(function testPrefs() {
  eq(DEFAULTS.version, 2, "DEFAULTS version 2");
  eq(DEFAULTS.defaultMode, "digits", "DEFAULTS defaultMode digits");
  eq(DEFAULTS.showDigits, true, "DEFAULTS showDigits true");
  eq(DEFAULTS.colorIntensity, 100, "DEFAULTS colorIntensity full");
  // Icon-vs-word and temp-color are per-group now, not a global flag —
  // every device but mem defaults to an icon; mem defaults to a word
  // (there's no icon that reads as clearly "RAM" the way a chip does
  // "CPU"), and cpu/gpu default to letting their temp warm normally.
  eq(DEFAULTS.groups.cpu.wordLabel, false, "DEFAULTS cpu group starts as an icon");
  eq(DEFAULTS.groups.gpu.wordLabel, false, "DEFAULTS gpu group starts as an icon");
  eq(DEFAULTS.groups.mem.wordLabel, true, "DEFAULTS mem group starts as a word");
  eq(DEFAULTS.groups.net.wordLabel, false, "DEFAULTS net group starts as an icon");
  eq(DEFAULTS.groups.disk.wordLabel, false, "DEFAULTS disk group starts as an icon");
  eq(DEFAULTS.groups.fan.wordLabel, false, "DEFAULTS fan group starts as an icon");
  eq(DEFAULTS.groups.cpu.tempColor, "primary", "DEFAULTS cpu temp warms normally");
  eq(DEFAULTS.groups.gpu.tempColor, "primary", "DEFAULTS gpu temp warms normally");
  eq(DEFAULTS.warnUsage, 70, "DEFAULTS warnUsage");
  eq(DEFAULTS.critUsage, 90, "DEFAULTS critUsage");
  eq(DEFAULTS.warnTemp, 75, "DEFAULTS warnTemp");
  eq(DEFAULTS.critTemp, 90, "DEFAULTS critTemp");
  deepEq(DEFAULTS.order, ["cpu", "gpu", "mem", "net", "disk", "fan"], "DEFAULTS order is the six groups");
  eq(DEFAULTS.groups.cpu.enabled, true, "DEFAULTS cpu group enabled");
  eq(DEFAULTS.groups.gpu.enabled, true, "DEFAULTS gpu group enabled");
  eq(DEFAULTS.groups.mem.enabled, true, "DEFAULTS mem group enabled");
  eq(DEFAULTS.groups.fan.enabled, true, "DEFAULTS fan group enabled");
  eq(DEFAULTS.groups.net.enabled, false, "DEFAULTS net group starts disabled (opt-in)");
  eq(DEFAULTS.groups.disk.enabled, false, "DEFAULTS disk group starts disabled (opt-in)");
  eq(DEFAULTS.groups.gpu.adapter, "auto", "DEFAULTS gpu adapter auto");

  var corrupt = adoptPrefs("{{{ not json");
  deepEq(corrupt, DEFAULTS, "adoptPrefs corrupt string returns defaults");
  deepEq(adoptPrefs(null), DEFAULTS, "adoptPrefs null returns defaults");
  deepEq(adoptPrefs(42), DEFAULTS, "adoptPrefs number returns defaults");
  deepEq(adoptPrefs({}), DEFAULTS, "adoptPrefs empty object returns defaults (upgraded from v1 shape)");

  var unit = adoptPrefs({ unit: "F" });
  eq(unit.unit, "F", "adoptPrefs keeps F unit");
  eq(adoptPrefs({ unit: "X" }).unit, "C", "adoptPrefs clamps bad unit to C");

  eq(adoptPrefs({ groups: {}, defaultMode: "gauges" }).defaultMode, "gauges", "adoptPrefs keeps valid defaultMode");
  eq(adoptPrefs({ defaultMode: "bogus" }).defaultMode, "digits", "adoptPrefs normalizes bad defaultMode");
  eq(adoptPrefs({ groups: {}, defaultMode: "combo" }).defaultMode, "digits", "adoptPrefs rejects the retired combo mode too");

  eq(adoptPrefs({ groups: {}, colorIntensity: 40 }).colorIntensity, 40, "adoptPrefs keeps a valid colorIntensity");
  eq(adoptPrefs({ groups: {}, colorIntensity: -10 }).colorIntensity, 0, "adoptPrefs clamps colorIntensity low");
  eq(adoptPrefs({ groups: {}, colorIntensity: 500 }).colorIntensity, 100, "adoptPrefs clamps colorIntensity high");
  eq(adoptPrefs({ colorMode: "graphite" }).colorIntensity, 0, "a lone legacy colorMode:graphite still zeroes intensity");

  eq(adoptPrefs({ groups: { cpu: { wordLabel: true } } }).groups.cpu.wordLabel, true, "adoptPrefs keeps a group's wordLabel true");
  eq(adoptPrefs({ groups: { cpu: { wordLabel: "yes" } } }).groups.cpu.wordLabel, false, "adoptPrefs booleans strict: wordLabel falls back to that group's default");
  eq(adoptPrefs({ groups: { cpu: { tempColor: "secondary" } } }).groups.cpu.tempColor, "secondary", "adoptPrefs keeps a valid tempColor");
  eq(adoptPrefs({ groups: { cpu: { tempColor: "bogus" } } }).groups.cpu.tempColor, "primary", "adoptPrefs clamps a bad tempColor to primary");

  var clamped = adoptPrefs({ warnUsage: -5, critUsage: 500, warnTemp: -10, critTemp: 999 });
  eq(clamped.warnUsage, 0, "adoptPrefs clamps usage warn low");
  eq(clamped.critUsage, 100, "adoptPrefs clamps usage crit high");
  eq(clamped.warnTemp, 0, "adoptPrefs clamps temp warn low");
  eq(clamped.critTemp, 150, "adoptPrefs clamps temp crit high");

  var narrowed = adoptPrefs({ warnUsage: 90, critUsage: 90 });
  ok(narrowed.warnUsage < narrowed.critUsage, "adoptPrefs enforces warn less than crit usage");
  var narrowedT = adoptPrefs({ warnTemp: 100, critTemp: 80 });
  ok(narrowedT.warnTemp < narrowedT.critTemp, "adoptPrefs enforces warn less than crit temp");

  // Per-group validation: booleans strict-typed, unknown groups ignored,
  // missing groups filled with defaults.
  var groupStrict = adoptPrefs({ groups: { cpu: { showUsage: 1, showTemp: "yes" }, fan: { showRpm: "true" } } });
  eq(groupStrict.groups.cpu.showUsage, true, "group booleans strict: non-boolean falls back to default (true)");
  eq(groupStrict.groups.cpu.showTemp, true, "group booleans strict: non-boolean falls back to default (true)");
  eq(groupStrict.groups.fan.showRpm, false, "group booleans strict: non-boolean falls back to default (false)");

  var modeStrict = adoptPrefs({ groups: { gpu: { mode: "bogus" } } });
  eq(modeStrict.groups.gpu.mode, "inherit", "group mode normalizes to inherit when invalid");
  eq(adoptPrefs({ groups: { gpu: { mode: "gauges" } } }).groups.gpu.mode, "gauges", "group mode keeps a valid explicit mode");

  eq(adoptPrefs({ groups: { mem: { ramFormat: "used" } } }).groups.mem.ramFormat, "used", "mem group keeps GiB format");
  eq(adoptPrefs({ groups: { mem: { ramFormat: "x" } } }).groups.mem.ramFormat, "percent", "mem group clamps bad ramFormat");

  var missingGroup = adoptPrefs({ groups: { cpu: { enabled: false } } });
  eq(missingGroup.groups.cpu.enabled, false, "explicit group field kept");
  eq(missingGroup.groups.net.enabled, false, "missing group filled with its own defaults, not crashed on");
  ok(missingGroup.groups.disk && typeof missingGroup.groups.disk.showUsage === "boolean", "disk group always present and typed");

  var orderFixed = adoptPrefs({ groups: {}, order: ["fan", "fan", "cpu", "bogus"] });
  deepEq(orderFixed.order, ["fan", "cpu", "gpu", "mem", "net", "disk"], "order dedupes and appends missing groups");

  var seeded = seedPrefs({ unit: "F", mode: "gauges" });
  eq(seeded.unit, "F", "seedPrefs picks unit from a v1-shaped shell object");
  eq(seeded.defaultMode, "gauges", "seedPrefs upgrades a v1-shaped shell object's mode to defaultMode");
  deepEq(seedPrefs(null), DEFAULTS, "seedPrefs null returns defaults");

  // v1 -> v2 upgrade, exercised through adoptPrefs (the single load path).
  var v1 = {
    version: 1,
    hidden: ["cpu_temp", "gpu_usage", "mem_usage", "fan:thinkpad/fan1"],
    order: ["mem_usage", "cpu_usage", "cpu_temp"],
    unit: "F", showRpm: true, mode: "gauges", showDigits: false, wordLabels: true,
    colorMode: "graphite", showClocks: true, ramFormat: "used",
    warnUsage: 60, critUsage: 80, warnTemp: 70, critTemp: 85
  };
  var up = adoptPrefs(v1);
  eq(up.version, 2, "v1 upgrade sets version 2");
  eq(up.defaultMode, "gauges", "v1 mode becomes defaultMode");
  eq(up.unit, "F", "v1 upgrade keeps unit");
  eq(up.colorIntensity, 0, "v1 upgrade maps graphite to zero colorIntensity");
  eq(up.groups.cpu.showTemp, false, "v1 hidden cpu_temp narrows to showTemp false");
  eq(up.groups.cpu.showUsage, true, "v1 upgrade leaves cpu_usage visible");
  eq(up.groups.gpu.showUsage, false, "v1 hidden gpu_usage narrows to showUsage false");
  eq(up.groups.mem.enabled, false, "v1 hidden mem_usage disables the whole mem group");
  eq(up.groups.mem.ramFormat, "used", "v1 ramFormat migrates to groups.mem.ramFormat");
  eq(up.groups.fan.showRpm, true, "v1 showRpm migrates to groups.fan.showRpm");
  deepEq(up.groups.fan.hidden, ["fan:thinkpad/fan1"], "v1 fan hidden keys move to groups.fan.hidden verbatim");
  eq(up.groups.cpu.showClocks, true, "v1 global showClocks migrates to groups.cpu.showClocks");
  eq(up.groups.gpu.showClocks, true, "v1 global showClocks migrates to groups.gpu.showClocks too");
  deepEq(up.order, ["mem", "cpu", "gpu", "net", "disk", "fan"], "v1 order expands to groups, mem first as in the source order");
  eq(up.groups.cpu.wordLabel, true, "v1 global wordLabels:true migrates to groups.cpu.wordLabel");
  eq(up.groups.gpu.wordLabel, true, "v1 global wordLabels:true migrates to groups.gpu.wordLabel");
  eq(up.groups.mem.wordLabel, true, "v1 global wordLabels:true migrates to groups.mem.wordLabel");
  eq(up.groups.net.wordLabel, true, "v1 global wordLabels:true migrates to groups.net.wordLabel");
  eq(up.groups.disk.wordLabel, true, "v1 global wordLabels:true migrates to groups.disk.wordLabel");
  eq(up.groups.fan.wordLabel, true, "v1 global wordLabels:true migrates to groups.fan.wordLabel");

  var upNoWords = adoptPrefs({ version: 1, wordLabels: false });
  eq(upNoWords.groups.cpu.wordLabel, false, "v1 wordLabels:false leaves groups.cpu.wordLabel at its own default");
  eq(upNoWords.groups.mem.wordLabel, true, "v1 wordLabels:false leaves groups.mem.wordLabel at its own default (true)");

  // Legacy metric-key renames still apply during the v1 upgrade.
  var legacyKeys = adoptPrefs({ hidden: ["cpu", "temp", "mem"] });
  eq(legacyKeys.groups.cpu.showUsage, false, "legacy \"cpu\" key migrates and hides cpu usage");
  eq(legacyKeys.groups.cpu.showTemp, false, "legacy \"temp\" key migrates and hides cpu temp");
  eq(legacyKeys.groups.mem.enabled, false, "legacy \"mem\" key migrates and disables the mem group");

  // Pre-1.0 barStyle shape still maps through the same single entry point.
  eq(adoptPrefs({ barStyle: "numbers" }).defaultMode, "digits", "migrate numbers to digits");
  var bars = adoptPrefs({ barStyle: "bars" });
  eq(bars.defaultMode, "gauges", "migrate bars to gauges");
  eq(bars.showDigits, false, "migrate bars without digits");
  var barsDigits = adoptPrefs({ barStyle: "bars+digits" });
  eq(barsDigits.defaultMode, "gauges", "migrate bars+digits to gauges");
  eq(barsDigits.showDigits, true, "migrate bars+digits with digits");
  eq(adoptPrefs({ barStyle: "bar+temp" }).defaultMode, "gauges", "migrate bar+temp to Bar mode (pairing is unconditional now)");
  var labels = adoptPrefs({ barStyle: "labels" });
  eq(labels.defaultMode, "digits", "migrate labels to digits");
  eq(labels.groups.cpu.wordLabel, true, "migrate labels to per-group words (cpu)");
  eq(labels.groups.mem.wordLabel, true, "migrate labels to per-group words (mem)");

  // serialize()/adoptPrefs() round-trip and the exact v2 key order.
  var ser = serialize({ groups: {}, unit: "F", defaultMode: "gauges", warnUsage: 60 });
  var parsedBack = JSON.parse(ser);
  eq(parsedBack.unit, "F", "serialize round trip unit");
  eq(parsedBack.defaultMode, "gauges", "serialize round trip defaultMode");
  var keyOrder = Object.keys(parsedBack);
  deepEq(keyOrder, ["version", "order", "defaultMode", "groups", "unit", "showDigits", "colorIntensity", "warnUsage", "critUsage", "warnTemp", "critTemp"], "serialize stable key order");
  deepEq(Object.keys(parsedBack.groups), ["cpu", "gpu", "mem", "net", "disk", "fan"], "serialize stable group order");
  deepEq(Object.keys(parsedBack.groups.fan), ["enabled", "showRpm", "hidden", "order", "wordLabel"], "serialize stable fan group key order");

  var full = adoptPrefs(v1);
  var roundTrip = adoptPrefs(serialize(full));
  deepEq(roundTrip, full, "serialize/adoptPrefs round trip is stable for an upgraded v1 file");
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
