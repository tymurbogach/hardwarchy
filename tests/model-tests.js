// Pure-logic model tests. Node only, no dependencies.
// Loads each Model and Styles file via vm in one shared sandbox,
// then asserts observable behavior from SPEC sections 2-7 (v2 schema:
// monitor groups, one part per piece of a cell, per-group alerts).
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
var isHidden = S("isHidden");
var metricsExpandGroupOrder = S("metricsExpandGroupOrder");
var metricsEffectiveHidden = S("metricsEffectiveHidden");
var metricsReadList = S("metricsReadList");
var metricsGroupRuns = S("metricsGroupRuns");
var LOAD_GROUPS = S("LOAD_GROUPS");
var nextLoad = S("nextLoad");
var cycleLoadPatch = S("cycleLoadPatch");
var groupCells = S("groupCells");
var groupStripCells = S("groupStripCells");
var placeholderCell = S("placeholderCell");
var tooltip = S("tooltip");
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
  eq(part.gpu_source, null, "parse partial missing gpu_source is null");
  deepEq(part.gpu_sources, [], "parse partial missing gpu_sources is empty");

  var full = parse(JSON.stringify({
    schema: 1,
    cpu: 12,
    temp: 45,
    fans: [{ id: "thinkpad/fan1", chip: "thinkpad", label: "fan1", rpm: 2262 }],
    load: { one: 0.42, five: 0.5, fifteen: 0.55 },
    gpu_detail: { vram_used_b: 1000000, vram_total_b: 8000000, watts: 45 },
    gpu_source: "amd",
    gpu_sources: ["amd", "intel", 3, ""],
    net: { iface: "wlan0", ifaces: ["wlan0", "eth0", null], down_bps: 10, up_bps: 20 },
    disk: { mount: "/", mounts: ["/", "/boot"], used_pct: 63, used_b: 300, total_b: 500, read_bps: 1, write_bps: 2 }
  }));
  eq(full.cpu, 12, "parse full cpu");
  eq(full.temp, 45, "parse full temp");
  eq(full.fans[0].rpm, 2262, "parse full fan rpm");
  eq(full.load.one, 0.42, "parse load.one");
  eq(full.gpu_detail.watts, 45, "parse gpu_detail watts");
  eq(full.gpu_source, "amd", "parse gpu_source");
  deepEq(full.gpu_sources, ["amd", "intel"], "parse gpu_sources keeps only non-empty strings");
  deepEq(full.net.ifaces, ["wlan0", "eth0"], "parse net interfaces");
  deepEq(full.disk.mounts, ["/", "/boot"], "parse disk mounts");
  eq(full.disk.used_b + "/" + full.disk.total_b, "300/500", "parse disk bytes");

  var badLoad = parse('{"load": "garbage", "gpu_detail": 42}');
  eq(badLoad.load, null, "parse bad load becomes null");
  eq(badLoad.gpu_detail, null, "parse bad gpu_detail becomes null");
  eq(parse('{"gpu_detail": {}}').gpu_detail, null, "parse empty gpu_detail becomes null");
  var partialLoad = parse('{"load": {"one": 1.5}}');
  eq(partialLoad.load.one, 1.5, "parse partial load keeps one");
  eq(partialLoad.load.five, null, "parse partial load fills five with null");

  ok(hasReading(full) === true, "hasReading true for full doc");
  ok(hasReading(EMPTY) === false, "hasReading false for EMPTY");
  ok(hasReading(parse("garbage")) === false, "hasReading false for garbage parse");
  ok(hasReading(null) === false, "hasReading false for null");

  // mergeReading: one-time grace after a deliberate collector restart.
  var before = parse(JSON.stringify({ cpu: 42, gpu: 17, temp: 40, mem: 50 }));
  var justRestarted = parse(JSON.stringify({ cpu: null, gpu: null, temp: 41, mem: 51 }));
  var merged = mergeReading(before, justRestarted);
  eq(merged.cpu, 42, "mergeReading borrows previous cpu when the new one is still priming");
  eq(merged.gpu, 17, "mergeReading borrows previous gpu when the new one is still priming");
  eq(merged.temp, 41, "mergeReading never touches non-primed fields");
  eq(merged.mem, 51, "mergeReading never touches non-primed fields (mem)");
  var stillNull = parse(JSON.stringify({ cpu: null, gpu: null, temp: 41, mem: 51 }));
  eq(mergeReading(stillNull, stillNull).cpu, null, "mergeReading has nothing to borrow when the previous reading was already null");
  eq(mergeReading(null, justRestarted), justRestarted, "mergeReading with no previous reading returns the new one untouched");
  eq(mergeReading(before, null), null, "mergeReading null-safe on the new reading");
})();

// ---------- fanLabels ----------
(function testFans() {
  var labels = fanLabels([
    { id: "a/fan1", chip: "a", label: "fan1", rpm: 1000 },
    { id: "b/fan1", chip: "b", label: "fan1", rpm: 2000 },
    { id: "c/fan2", chip: "c", label: "fan2", rpm: 3000 }
  ]);
  eq(labels[0], "fan1 (a)", "duplicate fan label gets chip suffix");
  eq(labels[1], "fan1 (b)", "duplicate fan label gets chip suffix second");
  eq(labels[2], "fan2", "unique fan label has no suffix");
  eq(labels["a/fan1"], "fan1 (a)", "fanLabels maps id to display label");
  var missing = fanLabels([{ id: "z/fan1", chip: "z", label: null, rpm: 5 }]);
  ok(typeof missing[0] === "string" && missing[0].length > 0, "missing label defaults to non-empty Fan N");
})();

// ---------- metrics ----------
// metrics(reading, prefs): prefs is read directly (prefs.groups.<id>.*)
// with defensive fallbacks everywhere a field is missing.
function sampleReading() {
  return parse(JSON.stringify({
    schema: 2,
    cpu: 12,
    temp: 46,
    mem: 16,
    gpu: 23,
    gpu_temp: 61,
    gpu_source: "amd",
    gpu_sources: ["amd"],
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
    gpu_detail: { vram_used_b: 2147483648, vram_total_b: 8589934592, watts: 45 },
    net: { iface: "wlan0", ifaces: ["wlan0", "eth0"], down_bps: 1258291, up_bps: 348160 },
    disk: { mount: "/", mounts: ["/", "/boot"], used_pct: 63, used_b: 322122547200, total_b: 536870912000, read_bps: 40960, write_bps: 12288 }
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

// Adopted defaults with some fields of one group replaced.
function prefsWith(id, fields) {
  var p = adoptPrefs({});
  for (var k in fields) {
    p.groups[id][k] = fields[k];
  }
  return p;
}

(function testMetrics() {
  var r = sampleReading();
  var all = metricsFn(r, {});
  deepEq(all.map(function (m) { return m.key; }), [
    "cpu_usage", "cpu_temp", "cpu_avg",
    "gpu_usage", "gpu_temp", "gpu_vram", "gpu_power",
    "mem_usage", "mem_swap",
    "net_down", "net_up",
    "disk_usage", "disk_read", "disk_write",
    "fan:thinkpad/fan1"
  ], "every reading becomes a metric, in bar order");

  var cpuTemp = byKey(all, "cpu_temp");
  eq(cpuTemp.bar, "46°", "temp bar drops unit letter");
  eq(cpuTemp.value, "46 °C", "temp menu value keeps unit");
  eq(cpuTemp.unit, "C", "a temp carries its unit letter");
  eq(cpuTemp.glyph, GLYPH.temp, "a temp carries its thermometer");
  eq(cpuTemp.groupGlyph, GLYPH.cpu, "a temp's cell label is its group's glyph");
  eq(byKey(metricsFn(r, { unit: "F" }), "cpu_temp").bar, "115°", "temp bar F conversion without letter");

  var avg = byKey(all, "cpu_avg");
  eq(avg.bar, "0.42 0.50 0.55", "load average bar");
  eq(avg.one + "/" + avg.five + "/" + avg.fifteen, "0.42/0.50/0.55", "each load window");
  eq(avg.value, "0.42 · 0.50 · 0.55", "load average menu value");

  var vram = byKey(all, "gpu_vram");
  eq(vram.bar, "25%", "VRAM percentage");
  eq(vram.gib, "2.0/8.0G", "VRAM GiB pair");
  approx(vram.ratio, 0.25, 1e-9, "VRAM ratio for the bar");
  eq(byKey(all, "gpu_power").bar, "45W", "GPU power bar");
  eq(byKey(all, "gpu_power").value, "45 W", "GPU power menu value");

  var mem = byKey(all, "mem_usage");
  eq(mem.bar, "16%", "memory percentage");
  eq(mem.gib, "9.1/61G", "memory GiB pair");
  eq(mem.value, "16 % · 9.1/61 GiB", "memory menu value carries both");
  eq(byKey(metricsFn(parse(JSON.stringify({ mem_used_kib: 500000, mem_total_kib: 64000000 })), {}), "mem_usage").bar, "01%",
    "memory percentage from KiB when the percentage is missing");
  var swap = byKey(all, "mem_swap");
  eq(swap.bar + " " + swap.gib, "00% 0.0/7.6G", "swap percentage and GiB");

  eq(byKey(all, "net_down").bar + " " + byKey(all, "net_up").bar, "1.2M 340K", "net rates");
  eq(byKey(all, "net_down").glyph, GLYPH.down, "net down carries its arrow");
  eq(byKey(all, "net_down").iface, "wlan0", "net metrics carry their interface");

  var disk = byKey(all, "disk_usage");
  eq(disk.bar + " " + disk.gib, "63% 300/500G", "disk used percentage and GiB");
  eq(disk.label, "Disk used", "disk space is labelled used, not load");
  eq(byKey(all, "disk_read").bar + " " + byKey(all, "disk_write").bar, "40K 12K", "disk read and write, apart");
  eq(byKey(all, "disk_read").glyph + byKey(all, "disk_write").glyph, "RW", "disk rates carry R and W tags");

  // The clock is its own field whenever the group's clock part shows.
  var clocked = metricsFn(r, { groups: { cpu: { clock: { show: true } } } });
  eq(byKey(clocked, "cpu_usage").bar, "12%", "usage bar keeps only the digits");
  eq(byKey(clocked, "cpu_usage").clock, "3.2G", "clock short form in its own field");
  eq(byKey(clocked, "cpu_usage").value, "12 % · 3.2 GHz", "clock long form appended in menu");
  eq(byKey(all, "cpu_usage").clock, null, "no clock unless the group asks");

  eq(byKey(all, "cpu_usage").word, "CPU", "word label is the group's short name");
  eq(byKey(all, "mem_usage").word, "RAM", "RAM word label");

  // Fans: their own names, their own RPM alerts, stopped ones dimmed.
  var fan = byKey(all, "fan:thinkpad/fan1");
  eq(fan.bar, "2262", "fans draw bare RPM; the unit is a piece");
  eq(fan.value, "2262 RPM", "fan menu value carries RPM");
  eq(fan.word, "fan1", "a fan's word is its own label");
  eq(fan.severity, 0, "a fan under its warn RPM stays cool");
  var named = byKey(metricsFn(r, { groups: { fan: { names: { "fan:thinkpad/fan1": "CPU fan" } } } }), "fan:thinkpad/fan1");
  eq(named.label + "/" + named.word + "/" + named.autoLabel, "CPU fan/CPU fan/fan1", "a fan's own name wins over its label");
  approx(byKey(metricsFn(r, { groups: { fan: { warnRpm: 2000, critRpm: 2524 } } }), "fan:thinkpad/fan1").severity, 0.5, 1e-9,
    "a fan warms on its own RPM thresholds");
  var stopped = metricsFn(parse(JSON.stringify({ fans: [{ id: "a/fan1", chip: "a", label: "fan1", rpm: 0 }] })), {});
  eq(stopped[0].bar + "/" + stopped[0].value + "/" + stopped[0].dim + "/" + stopped[0].severity, "0/stopped/true/0",
    "a stopped fan draws 0, reads stopped, dims and never warms");

  // Thresholds are per group, with 70/90 % and 75/90 ° when missing.
  var hotReading = parse(JSON.stringify({ cpu: 95, temp: 95, gpu: 95, gpu_temp: 95 }));
  eq(byKey(metricsFn(hotReading, {}), "cpu_temp").severity, 1, "temp severity hits 1 at crit");
  var tuned = metricsFn(hotReading, { groups: { gpu: { warnTemp: 75, critTemp: 100 }, cpu: { warnUsage: 90, critUsage: 100 } } });
  approx(byKey(tuned, "gpu_temp").severity, 0.8, 1e-9, "a GPU with a higher crit warms less at the same temp");
  approx(byKey(tuned, "cpu_usage").severity, 0.5, 1e-9, "the CPU's own usage thresholds apply");

  var single = metricsFn(parse(JSON.stringify({ cpu: 3 })), {});
  eq(byKey(single, "cpu_usage").bar + "/" + byKey(single, "cpu_usage").padLen, "03%/1", "usage pads under 10% and reports the pad");

  ok(GLYPH.cpu && GLYPH.temp && GLYPH.gpu && GLYPH.mem && GLYPH.fan && GLYPH.down && GLYPH.up, "GLYPH map has every glyph");
  deepEq(GROUP_LABELS, { cpu: "CPU", gpu: "GPU", mem: "RAM", net: "Net", disk: "Disk", fan: "Fans" }, "GROUP_LABELS short English names");
  eq(migrateKey("cpu"), "cpu_usage", "migrateKey cpu");
  eq(migrateKey("cpu_usage"), "cpu_usage", "migrateKey passthrough");
})();

// ---------- ordering and visibility ----------
(function testOrdering() {
  var r = sampleReading();
  var all = metricsFn(r, {});
  var reordered = orderKeys(all, ["mem_usage", "cpu_usage"]);
  eq(reordered[0].key + "," + reordered[1].key, "mem_usage,cpu_usage", "orderKeys honors user order first");
  eq(reordered.length, all.length, "orderKeys keeps all metrics");
  ok(isHidden("cpu_usage", ["cpu"]) === true, "isHidden migrates legacy keys");

  deepEq(metricsExpandGroupOrder(["mem", "cpu"], null), ["mem_usage", "mem_swap", "cpu_usage", "cpu_temp", "cpu_avg"],
    "metricsExpandGroupOrder expands every kind of a group in order");
  deepEq(metricsExpandGroupOrder(["fan", "disk"], ["fan:b"]), ["fan:b", "disk_usage", "disk_read", "disk_write"],
    "fans follow their own order; disk expands to used, read, write");

  var defaults = adoptPrefs({});
  deepEq(metricsEffectiveHidden(all, defaults),
    ["cpu_avg", "gpu_vram", "gpu_power", "mem_swap", "net_down", "net_up", "disk_usage", "disk_read", "disk_write"],
    "by default the extra readings are off and Net and Disk start disabled");

  function hiddenWith(id, fields) {
    return metricsEffectiveHidden(all, prefsWith(id, fields)).filter(function (k) { return k.indexOf(id) === 0; });
  }
  deepEq(hiddenWith("cpu", { temp: { icon: true, value: false } }), ["cpu_temp", "cpu_avg"], "a temp without its value draws nothing");
  deepEq(hiddenWith("cpu", { load: { bar: false, number: false } }), ["cpu_usage", "cpu_avg"], "no bar and no number hides the usage");
  deepEq(hiddenWith("cpu", { load: { bar: false, number: false }, clock: { show: true } }), ["cpu_avg"], "the clock keeps the usage metric");
  deepEq(hiddenWith("cpu", { avg: { five: true } }), [], "one load window is enough to show the average");
  deepEq(hiddenWith("gpu", { vram: { gib: true }, power: { show: true } }), [], "VRAM and power switch on alone");
  deepEq(hiddenWith("net", { enabled: true, up: { icon: true, value: false } }), ["net_up"], "net up without its value is hidden");
  deepEq(hiddenWith("disk", { enabled: true, read: { value: false } }), ["disk_read"], "disk read hides on its own");

  var stoppedFans = metricsFn(parse(JSON.stringify({ fans: [
    { id: "a/fan1", chip: "a", label: "fan1", rpm: 0 }, { id: "a/fan2", chip: "a", label: "fan2", rpm: 900 }
  ] })), {});
  deepEq(metricsEffectiveHidden(stoppedFans, prefsWith("fan", { showStopped: false })), ["fan:a/fan1"], "stopped fans can hide themselves");
  deepEq(metricsEffectiveHidden(stoppedFans, prefsWith("fan", { showStopped: true })), [], "stopped fans show by default");
  deepEq(metricsEffectiveHidden(stoppedFans, prefsWith("fan", { hidden: ["fan:a/fan2"] })), ["fan:a/fan2"], "a fan hides by its id");

  deepEq(metricsReadList(defaults), ["cpu", "temp", "gpu", "mem", "load", "fans"],
    "by default the collector skips the clock, Net and Disk");
  function reads(id, fields) {
    return metricsReadList(prefsWith(id, fields));
  }
  deepEq(reads("cpu", { enabled: false }), ["gpu", "mem", "fans"], "a group switched off is not read");
  ok(reads("cpu", { temp: { icon: true, value: false } }).indexOf("temp") < 0, "a temp that draws nothing is not read");
  ok(reads("cpu", { clock: { show: true } }).indexOf("clocks") >= 0, "the clock is read while it shows");
  var ioOnly = reads("disk", { enabled: true, used: { bar: false, percent: false, gib: false }, write: { value: false } });
  ok(ioOnly.indexOf("io") >= 0 && ioOnly.indexOf("disk") < 0, "disk read alone reads the I/O, not the space");
  ok(reads("fan", { rpm: { value: false } }).indexOf("fans") < 0, "fans without a value are not read");
  deepEq(metricsReadList(adoptPrefs({ groups: { cpu: { enabled: false }, gpu: { enabled: false },
    mem: { enabled: false }, fan: { enabled: false } } })), [], "everything off reads nothing");

  var runs = metricsGroupRuns(all);
  deepEq(runs.map(function (x) { return x.device; }), ["cpu", "gpu", "mem", "net", "disk", "fan"], "metricsGroupRuns clusters by device in order");
})();

// ---------- cells ----------
(function testCells() {
  var r = sampleReading();

  // Cells come from the metrics of the same prefs, as on the bar.
  function cellsOf(prefs, id, reading, vertical) {
    var all = metricsFn(reading || r, prefs);
    var items = shown(all, []).filter(function (m) { return m.device === id; });
    return groupCells(items, prefs, id, vertical);
  }
  function cellOf(prefs, id, reading, vertical) {
    return cellsOf(prefs, id, reading, vertical)[0];
  }
  function texts(cell) {
    return cell.pieces.map(function (p) { return p.kind === "gauge" ? "#" : p.text; }).join("|");
  }
  function gaps(cell) {
    return cell.pieces.map(function (p) { return p.gap; }).join(",");
  }
  var d = adoptPrefs({});

  var cpu = cellOf(d, "cpu");
  eq(cpu.key + "/" + cpu.device, "cpu/cpu", "a group's cell is keyed by the group");
  eq(texts(cpu), GLYPH.cpu + "|12%|46°", "default CPU: icon, number, temp");
  eq(gaps(cpu), "none,tight,part", "an icon hugs the load; the temp is a new part");
  deepEq(cpu.metrics.map(function (m) { return m.key; }), ["cpu_usage", "cpu_temp", "cpu_avg"], "the cell carries its metrics for the tooltip");
  eq(texts(cellOf(d, "gpu")), GLYPH.gpu + "|23%|61°", "default GPU");
  eq(texts(cellOf(d, "mem")), "RAM|16%", "default RAM: a word and a number");
  eq(gaps(cellOf(d, "mem")), "none,part", "a word is its own part");
  var net = cellOf(d, "net");
  eq(texts(net), GLYPH.net + "|" + GLYPH.down + "|1.2M|" + GLYPH.up + "|340K", "default Net: each rate after its arrow");
  eq(gaps(net), "none,tight,tight,part,tight", "each arrow hugs its rate; up is a new part");
  eq(texts(cellOf(d, "disk")), GLYPH.disk + "|63%|R|40K|W|12K", "default Disk: used, then tagged read and write");
  eq(texts(cellOf(d, "fan")), GLYPH.fan + "|2262", "default fan");

  // Load: bar and number add up; both on draws both.
  var bar = cellOf(prefsWith("cpu", { load: { bar: true, number: false } }), "cpu");
  eq(texts(bar), GLYPH.cpu + "|#|46°", "load bar only");
  approx(bar.pieces[1].ratio, 0.12, 1e-9, "the gauge carries the usage ratio");
  var both = cellOf(prefsWith("cpu", { load: { bar: true, number: true } }), "cpu");
  eq(texts(both), GLYPH.cpu + "|#|12%|46°", "bar and number both on: gauge then digits");
  eq(gaps(both), "none,tight,tight,part", "a gauge hugs its own digits");
  eq(texts(cellOf(prefsWith("cpu", { load: { bar: true, number: false } }), "cpu", null, true)), GLYPH.cpu + "|12%|46°",
    "a vertical bar draws digits instead of a gauge");

  // Label: icon and word add up too.
  var iconWord = cellOf(prefsWith("cpu", { label: { icon: true, word: true } }), "cpu");
  eq(texts(iconWord), GLYPH.cpu + "|CPU|12%|46°", "icon and word both on");
  eq(gaps(iconWord), "none,tight,part,part", "the icon hugs the word; the word stands apart");
  eq(texts(cellOf(prefsWith("cpu", { label: { icon: false, word: false } }), "cpu")), "12%|46°", "no label at all");

  // Clock, temp and load average.
  var clockOn = prefsWith("cpu", { clock: { show: true, quiet: false } });
  eq(texts(cellOf(clockOn, "cpu")), GLYPH.cpu + "|12%|3.2G|46°", "the clock is its own part after the load");
  var clockQuiet = prefsWith("cpu", { clock: { show: true, quiet: true } });
  eq(cellOf(clockQuiet, "cpu").pieces[2].quiet, true, "a quiet clock draws muted");
  var clockOnly = prefsWith("cpu", { load: { bar: false, number: false }, clock: { show: true } });
  eq(texts(cellOf(clockOnly, "cpu")), GLYPH.cpu + "|3.2G|46°", "no load, but the clock stays");
  var tempFull = cellOf(prefsWith("cpu", { temp: { icon: true, value: true, unit: true } }), "cpu");
  eq(texts(tempFull), GLYPH.cpu + "|12%|" + GLYPH.temp + "|46°C", "thermometer, value and unit letter");
  eq(gaps(tempFull), "none,tight,part,tight", "the thermometer hugs its temp");
  eq(texts(cellOf(prefsWith("cpu", { temp: { icon: true, value: false } }), "cpu")), GLYPH.cpu + "|12%", "an icon never shows without its value");
  eq(texts(cellOf(prefsWith("cpu", { avg: { one: true, fifteen: true } }), "cpu")), GLYPH.cpu + "|12%|46°|0.42 0.55", "the chosen load windows");

  // The leading zero: muted, plain, or dropped.
  var low = parse(JSON.stringify({ cpu: 3, temp: 50 }));
  var zq = cellOf(d, "cpu", low).pieces[1];
  ok(zq.text === "03%" && zq.pad === 1 && zq.padQuiet === true, "zero quiet: the pad digit draws muted");
  var zn = cellOf(prefsWith("cpu", { zero: { show: true, quiet: false } }), "cpu", low).pieces[1];
  ok(zn.text === "03%" && zn.pad === 1 && zn.padQuiet === false, "zero regular: the pad digit takes the digits' color");
  var zh = cellOf(prefsWith("cpu", { zero: { show: false, quiet: true } }), "cpu", low).pieces[1];
  ok(zh.text === "3%" && zh.pad === 0, "zero off: the pad digit goes");

  // Color: every reading warms by its own severity; quiet never warms.
  var hot = parse(JSON.stringify({ cpu: 10, temp: 95 }));
  var hotCell = cellOf(d, "cpu", hot);
  eq(hotCell.pieces[1].severity + "/" + hotCell.pieces[2].severity + "/" + hotCell.pieces[0].severity, "0/1/1",
    "a cool load stays cool beside a hot temp; the label warms with the hottest");
  var quietTemp = cellOf(prefsWith("cpu", { temp: { value: true, quiet: true } }), "cpu", hot);
  ok(quietTemp.pieces[2].quiet && quietTemp.severity === 0, "a quiet temp is muted and never warms its cell");
  var quietLabel = cellOf(prefsWith("cpu", { label: { icon: true, quiet: true } }), "cpu", hot);
  ok(quietLabel.pieces[0].quiet && quietLabel.pieces[0].severity === 0, "a quiet label stays muted even beside a hot temp");
  var quietLoad = cellOf(prefsWith("cpu", { load: { bar: true, number: true, quiet: true } }), "cpu");
  ok(quietLoad.pieces[1].quiet && quietLoad.pieces[2].quiet, "a quiet load mutes its gauge and its digits");

  // Space used: bar, percent and GiB add up; GiB is its own part.
  var memBoth = cellOf(prefsWith("mem", { used: { percent: true, gib: true } }), "mem");
  eq(texts(memBoth), "RAM|16%|9.1/61G", "percent and GiB both on");
  eq(gaps(memBoth), "none,part,part", "two numbers never touch");
  eq(texts(cellOf(prefsWith("mem", { used: { bar: true } }), "mem")), "RAM|#", "memory as a bar only");
  eq(texts(cellOf(prefsWith("mem", { used: { bar: true, gib: true } }), "mem")), "RAM|#|9.1/61G", "bar and GiB");
  eq(texts(cellOf(prefsWith("mem", { swap: { percent: true } }), "mem")), "RAM|16%|00%", "swap after memory");
  eq(texts(cellOf(prefsWith("gpu", { vram: { bar: true, gib: true }, power: { show: true } }), "gpu")),
    GLYPH.gpu + "|23%|61°|#|2.0/8.0G|45W", "VRAM bar and GiB, then power");

  // Net and disk: each rate, each mark, each color on its own.
  eq(texts(cellOf(prefsWith("net", { down: { icon: false, value: true }, up: { value: false } }), "net")), GLYPH.net + "|1.2M",
    "net down without its arrow, up hidden");
  eq(texts(cellOf(prefsWith("disk", { read: { tag: false, value: true } }), "disk")), GLYPH.disk + "|63%|40K|W|12K", "disk read without its tag");
  eq(cellOf(prefsWith("disk", { write: { tag: true, value: true, quiet: true } }), "disk").pieces[5].quiet, true, "disk write can be quiet");

  // Fans: RPM with or without its unit, each fan its own cell.
  eq(texts(cellOf(prefsWith("fan", { rpm: { value: true, unit: true } }), "fan")), GLYPH.fan + "|2262 RPM", "RPM with its unit");
  eq(texts(cellOf(prefsWith("fan", { label: { icon: false, word: true } }), "fan")), "fan1|2262", "a fan's word is its own label");
  eq(cellOf(d, "fan").key, "fan:thinkpad/fan1", "a fan cell is keyed by the fan");

  // A group with every reading off draws no cell, not a lonely label.
  eq(cellsOf(prefsWith("cpu", { load: { bar: false, number: false }, temp: { value: false } }), "cpu").length, 0,
    "no reading, no cell");
  eq(groupCells([], d, "cpu").length, 0, "no metrics, no cell");

  // Right-click: number, bar, both, number again.
  var next = cycleLoadPatch(d, "cpu").load;
  eq(next.bar + "/" + next.number, "true/false", "right-click: number to bar");
  var third = nextLoad(next, "number");
  eq(third.bar + "/" + third.number, "true/true", "right-click: bar to both");
  var back = nextLoad(third, "number");
  eq(back.bar + "/" + back.number, "false/true", "right-click: both back to number");
  eq(nextLoad({ bar: false, number: false }, "number").number, true, "right-click brings a hidden load back as a number");
  var memNext = cycleLoadPatch(d, "mem").used;
  eq(memNext.bar + "/" + memNext.percent + "/" + memNext.gib, "true/false/false", "right-click on memory cycles its percentage");
  eq(cycleLoadPatch(d, "net"), null, "net has no load to cycle");
  deepEq(LOAD_GROUPS, ["cpu", "gpu", "mem", "disk"], "LOAD_GROUPS: the groups with a load");

  var strip = groupStripCells(metricsGroupRuns(shown(metricsFn(r, d), [])), d, false);
  deepEq(strip.map(function (c) { return c.key; }), ["cpu", "gpu", "mem", "net", "disk", "fan:thinkpad/fan1"], "one cell per group, one per fan");
  var empty = groupStripCells([], d, false);
  eq(empty.length + "/" + empty[0].key + "/" + empty[0].dim + "/" + texts(empty[0]), "1/placeholder/true/—", "no runs yields one dimmed placeholder");
  deepEq(placeholderCell(), empty[0], "placeholderCell is the same cell");
})();

// ---------- tooltip ----------
(function testTooltip() {
  var r = sampleReading();
  var all = metricsFn(r, {});
  var d = adoptPrefs({});
  function cellFor(id) {
    return groupCells(all.filter(function (m) { return m.device === id; }), d, id, false)[0];
  }

  var t = tooltip(byKey(all, "cpu_usage"), r);
  var lines = t.split("\n");
  eq(lines[0], "CPU usage: 12 %", "tooltip headline first");
  ok(t.indexOf("AMD Ryzen 7 · 16 cores") >= 0, "tooltip shows CPU model and cores");
  ok(t.indexOf("Load 0.42 0.50 0.55") >= 0, "tooltip shows load average");
  ok(t.indexOf("3.2 GHz") >= 0, "tooltip shows the clock");
  ok(t.indexOf("null") < 0, "tooltip skips nulls silently");

  var cpuTip = tooltipFor(cellFor("cpu"), r);
  ok(cpuTip.indexOf("CPU usage:") >= 0 && cpuTip.indexOf("CPU temp:") >= 0, "a CPU cell headlines every metric");
  ok(cpuTip.indexOf("Load average: 0.42 · 0.50 · 0.55") >= 0, "the load average headlines once");
  ok(cpuTip.indexOf("Load 0.42") < 0, "and never repeats as a detail line");
  var gpuTip = tooltipFor(cellFor("gpu"), r);
  ok(gpuTip.indexOf("Source amd") >= 0, "a GPU tooltip names its source");
  ok(gpuTip.indexOf("GPU memory: 25 % · 2.0/8.0 GiB") >= 0, "a GPU tooltip shows VRAM");
  ok(gpuTip.indexOf("GPU power: 45 W") >= 0, "a GPU tooltip shows power");
  var memTip = tooltipFor(cellFor("mem"), r);
  ok(memTip.indexOf("Memory used: 16 % · 9.1/61 GiB") === 0, "a memory tooltip shows both formats");
  ok(memTip.indexOf("Swap: 0 % · 0.0/7.6 GiB") >= 0, "and swap");
  ok(tooltipFor(cellFor("net"), r).indexOf("Interface wlan0") >= 0, "a net tooltip names its interface");
  var diskTip = tooltipFor(cellFor("disk"), r);
  ok(diskTip.indexOf("Mount /") >= 0 && diskTip.indexOf("every physical disk") >= 0, "a disk tooltip names its mount and what I/O counts");
  ok(diskTip.indexOf("Disk read: 40 KB/s") >= 0 && diskTip.indexOf("Disk write: 12 KB/s") >= 0, "read and write apart");
  eq(tooltipFor(placeholderCell(), r), "No metrics visible", "the placeholder explains itself");
})();

// ---------- prefs (v2) ----------
(function testPrefs() {
  deepEq(Object.keys(DEFAULTS), ["version", "order", "groups", "unit", "colorIntensity", "gaps", "refresh"], "DEFAULTS top level");
  eq(DEFAULTS.version, 2, "DEFAULTS version 2");
  deepEq(Object.keys(DEFAULTS.groups.cpu),
    ["enabled", "label", "load", "zero", "clock", "temp", "avg", "warnUsage", "critUsage", "warnTemp", "critTemp"], "CPU fields in bar order");
  deepEq(Object.keys(DEFAULTS.groups.gpu),
    ["enabled", "adapter", "label", "load", "zero", "clock", "temp", "vram", "power", "warnUsage", "critUsage", "warnTemp", "critTemp"], "GPU fields");
  deepEq(Object.keys(DEFAULTS.groups.mem), ["enabled", "label", "used", "zero", "swap", "warnUsage", "critUsage"], "memory fields");
  deepEq(Object.keys(DEFAULTS.groups.net), ["enabled", "iface", "label", "down", "up"], "net fields");
  deepEq(Object.keys(DEFAULTS.groups.disk), ["enabled", "mount", "label", "used", "zero", "read", "write", "warnUsage", "critUsage"], "disk fields");
  deepEq(Object.keys(DEFAULTS.groups.fan),
    ["enabled", "label", "rpm", "showStopped", "warnRpm", "critRpm", "hidden", "order", "names"], "fan fields");
  deepEq(DEFAULTS.groups.cpu.label, { icon: true, word: false, quiet: false }, "CPU starts as an icon");
  deepEq(DEFAULTS.groups.cpu.load, { bar: false, number: true, quiet: false }, "CPU load starts as a number");
  deepEq(DEFAULTS.groups.cpu.zero, { show: true, quiet: true }, "the leading zero starts shown and quiet");
  deepEq(DEFAULTS.groups.cpu.temp, { icon: false, value: true, unit: false, quiet: false }, "the temp starts bare");
  deepEq(DEFAULTS.groups.mem.label, { icon: false, word: true, quiet: false }, "RAM starts as a word");
  deepEq(DEFAULTS.groups.disk.read, { tag: true, value: true, quiet: false }, "disk read starts tagged");
  eq(DEFAULTS.groups.net.iface + " " + DEFAULTS.groups.disk.mount + " " + DEFAULTS.groups.gpu.adapter, "auto / auto", "sources start automatic");
  eq(DEFAULTS.groups.net.enabled + "/" + DEFAULTS.groups.disk.enabled, "false/false", "Net and Disk start off");
  deepEq(DEFAULTS.gaps, { icon: 2, part: 5, metric: 10 }, "default gaps");
  eq(DEFAULTS.refresh, 3, "default refresh");

  deepEq(adoptPrefs("{{{ not json"), DEFAULTS, "adoptPrefs corrupt string returns defaults");
  deepEq(adoptPrefs(null), DEFAULTS, "adoptPrefs null returns defaults");
  deepEq(adoptPrefs({}), DEFAULTS, "adoptPrefs empty object returns defaults");

  // Validation: every toggle on its own, every field clamped or dropped.
  var v = adoptPrefs({ groups: { cpu: { load: { bar: true, number: "yes", extra: true }, temp: 3 } } }).groups.cpu;
  deepEq(v.load, { bar: true, number: true, quiet: false }, "a bad toggle falls back on its own; unknown toggles drop");
  deepEq(v.temp, DEFAULTS.groups.cpu.temp, "a part that is not an object falls back whole");
  ok(!("mode" in adoptPrefs({ groups: { cpu: { mode: "gauges", load: {} } } }).groups.cpu), "unknown group fields drop");
  eq(adoptPrefs({ groups: { gpu: { adapter: "intel" } } }).groups.gpu.adapter, "intel", "a known GPU source is kept");
  eq(adoptPrefs({ groups: { gpu: { adapter: "matrox" } } }).groups.gpu.adapter, "auto", "an unknown GPU source falls back to auto");
  eq(adoptPrefs({ groups: { net: { iface: "wlan0" } } }).groups.net.iface, "wlan0", "an interface name is kept");
  eq(adoptPrefs({ groups: { net: { iface: "we ird/" } } }).groups.net.iface, "auto", "a bad interface name falls back to auto");
  eq(adoptPrefs({ groups: { disk: { mount: "/home" } } }).groups.disk.mount, "/home", "a mount point is kept");
  eq(adoptPrefs({ groups: { disk: { mount: "home" } } }).groups.disk.mount, "/", "a relative mount falls back to /");
  deepEq(adoptPrefs({ groups: { fan: { names: { "fan:a/fan1": "  CPU fan ", "fan:a/fan2": "", "cpu": "x", "fan:a/fan3": "x".repeat(30) } } } }).groups.fan.names,
    { "fan:a/fan1": "CPU fan" }, "fan names are trimmed, and empty, long or non-fan names drop");
  var limits = adoptPrefs({ groups: { cpu: { warnUsage: -5, critUsage: 500, warnTemp: 100, critTemp: 80 }, fan: { warnRpm: 99999, critRpm: 99999 } } }).groups;
  eq(limits.cpu.warnUsage + "/" + limits.cpu.critUsage, "0/100", "usage thresholds clamp");
  ok(limits.cpu.warnTemp < limits.cpu.critTemp, "warn stays under crit");
  eq(limits.fan.warnRpm + "/" + limits.fan.critRpm, "19999/20000", "RPM thresholds clamp and keep warn under crit");
  deepEq(adoptPrefs({ groups: {}, gaps: { icon: -1, part: 99, metric: "12" } }).gaps, { icon: 0, part: 20, metric: 12 }, "gaps clamp");
  eq(adoptPrefs({ groups: {}, refresh: 0 }).refresh, 1, "refresh clamps low");
  eq(adoptPrefs({ groups: {}, refresh: 60 }).refresh, 10, "refresh clamps high");
  eq(adoptPrefs({ groups: {}, colorIntensity: 500 }).colorIntensity, 100, "colorIntensity clamps");
  deepEq(adoptPrefs({ groups: {}, order: ["fan", "fan", "cpu", "bogus"] }).order, ["fan", "cpu", "gpu", "mem", "net", "disk"],
    "order dedupes and appends missing groups");

  // shell.json seeds are v1-shaped; a v1 gauge carried its digits.
  var seeded = seedPrefs({ unit: "F", mode: "gauges", iconGap: 3 });
  eq(seeded.unit, "F", "seedPrefs picks unit from a v1-shaped shell object");
  deepEq(seeded.groups.cpu.load, { bar: true, number: true, quiet: false }, "a v1 gauges seed becomes bar and number");
  eq(seeded.gaps.icon, 3, "a shell.json gap seeds the prefs");
  deepEq(seedPrefs({ mode: "gauges", showDigits: false }).groups.cpu.load, { bar: true, number: false, quiet: false }, "gauges without digits is a bar");
  deepEq(seedPrefs(null), DEFAULTS, "seedPrefs null returns defaults");

  // v1 -> v2, through adoptPrefs (the single load path).
  var v1 = {
    version: 1,
    hidden: ["cpu_temp", "gpu_usage", "mem_usage", "fan:thinkpad/fan1"],
    order: ["mem_usage", "cpu_usage", "cpu_temp"],
    unit: "F", showRpm: true, mode: "gauges", showDigits: false, wordLabels: true,
    colorMode: "graphite", showClocks: true, ramFormat: "used",
    warnUsage: 60, critUsage: 80, warnTemp: 70, critTemp: 85
  };
  var up = adoptPrefs(v1);
  deepEq(up.groups.cpu.load, { bar: true, number: false, quiet: false }, "v1 gauges without digits becomes a bar");
  eq(up.groups.cpu.temp.value, false, "v1 hidden cpu_temp switches the temp off");
  deepEq(up.groups.gpu.load, { bar: false, number: false, quiet: false }, "v1 hidden gpu_usage switches the GPU load off");
  eq(up.groups.mem.enabled, false, "v1 hidden mem_usage disables memory");
  deepEq(up.groups.mem.used, { bar: true, percent: false, gib: false, quiet: false }, "v1 memory as a bar");
  eq(up.groups.cpu.clock.show && up.groups.gpu.clock.show, true, "v1 showClocks turns both clocks on");
  eq(up.groups.fan.rpm.unit, true, "v1 showRpm becomes the RPM unit");
  deepEq(up.groups.fan.hidden, ["fan:thinkpad/fan1"], "v1 fan hidden keys carry over");
  ok(["cpu", "gpu", "mem", "net", "disk", "fan"].every(function (id) { return up.groups[id].label.word && !up.groups[id].label.icon; }),
    "v1 wordLabels becomes a word label everywhere");
  eq(up.groups.cpu.warnUsage + "/" + up.groups.gpu.critTemp + "/" + up.groups.mem.warnUsage, "60/85/60", "v1 thresholds seed every group");
  eq(up.unit + "/" + up.colorIntensity, "F/0", "v1 unit and graphite");
  deepEq(up.order, ["mem", "cpu", "gpu", "net", "disk", "fan"], "v1 order expands to groups");
  deepEq(adoptPrefs({ version: 1, mode: "digits", ramFormat: "used" }).groups.mem.used, { bar: false, percent: false, gib: true, quiet: false },
    "v1 memory in GiB");
  deepEq(adoptPrefs({ barStyle: "bar+temp" }).groups.cpu.load, { bar: true, number: false, quiet: false }, "barStyle bar+temp");
  deepEq(adoptPrefs({ barStyle: "labels" }).groups.cpu.label, { icon: false, word: true, quiet: false }, "barStyle labels");
  var legacyKeys = adoptPrefs({ hidden: ["cpu", "temp"] });
  ok(!legacyKeys.groups.cpu.load.number && !legacyKeys.groups.cpu.temp.value, "legacy cpu/temp keys hide those pieces");

  // The mode draft: a top-level defaultMode, one boolean per piece.
  var modes = adoptPrefs({
    version: 2, defaultMode: "gauges",
    groups: {
      cpu: { enabled: true, mode: "digits", showUsage: true, showTemp: true, showClocks: true, wordLabel: false, tempColor: "secondary" },
      gpu: { enabled: true, mode: "inherit", showUsage: true, showTemp: false, wordLabel: true },
      mem: { enabled: false, mode: "inherit", ramFormat: "used" },
      disk: { enabled: false, mode: "digits", showUsage: true, showIo: false },
      fan: { enabled: false, showRpm: true, hidden: ["fan:a/fan1"] }
    },
    unit: "C", colorIntensity: 80, warnUsage: 65, critUsage: 85, warnTemp: 80, critTemp: 95
  });
  eq(modes.groups.cpu.load.number && !modes.groups.cpu.load.bar, true, "mode draft digits becomes a number");
  eq(modes.groups.cpu.clock.show + "/" + modes.groups.cpu.temp.quiet, "true/true", "mode draft clock and quiet temp");
  eq(modes.groups.gpu.load.bar + "/" + modes.groups.gpu.temp.value + "/" + modes.groups.gpu.label.word, "true/false/true",
    "mode draft inherit follows the default mode; showTemp and wordLabel carry over");
  deepEq(modes.groups.mem.used, { bar: true, percent: false, gib: false, quiet: false }, "mode draft memory inherits the bar");
  eq(modes.groups.disk.read.value + "/" + modes.groups.disk.write.value, "false/false", "mode draft showIo false hides disk activity");
  eq(modes.groups.fan.rpm.unit + "/" + modes.groups.fan.hidden.join(), "true/fan:a/fan1", "mode draft fans");
  eq(modes.groups.cpu.critTemp + "/" + modes.groups.disk.warnUsage + "/" + modes.colorIntensity, "95/65/80", "mode draft thresholds and color");

  // The word draft: one word per piece (the file this build replaces).
  var words = adoptPrefs({
    version: 2, order: ["cpu", "gpu", "mem", "net", "disk", "fan"],
    groups: {
      cpu: { enabled: true, label: "icon", load: "bar", zero: "quiet", clock: "on", temp: "plain", tempColor: "secondary", warnTemp: 80, critTemp: 95 },
      gpu: { enabled: true, adapter: "auto", label: "none", load: "both", zero: "normal", clock: "quiet", temp: "icon", tempColor: "primary" },
      mem: { enabled: false, label: "icon", load: "number", zero: "hide", ramFormat: "used" },
      net: { enabled: true, label: "word", down: "plain", up: "off" },
      disk: { enabled: false, label: "icon", load: "bar", activity: "quiet", warnUsage: 60, critUsage: 95 },
      fan: { enabled: false, label: "icon", rpmUnit: "on", hidden: ["fan:a/fan1"], order: null }
    },
    unit: "C", colorIntensity: 70
  });
  var wc = words.groups.cpu;
  eq([wc.load.bar, wc.load.number, wc.zero.show, wc.zero.quiet, wc.clock.show, wc.clock.quiet, wc.temp.icon, wc.temp.value, wc.temp.quiet].join(),
    "true,false,true,true,true,false,false,true,true", "word draft CPU: bar, quiet zero, clock on, quiet bare temp");
  eq(wc.warnTemp + "/" + wc.critTemp, "80/95", "word draft keeps its own thresholds");
  var wg = words.groups.gpu;
  eq([wg.label.icon, wg.label.word, wg.load.bar, wg.load.number, wg.zero.quiet, wg.clock.quiet, wg.temp.icon].join(),
    "false,false,true,true,false,true,true", "word draft GPU: no label, both, plain zero, quiet clock, temp icon");
  deepEq(words.groups.mem.used, { bar: false, percent: false, gib: true, quiet: false }, "word draft memory in GiB");
  eq(words.groups.mem.zero.show, false, "word draft hidden zero");
  eq(words.groups.net.label.word + "/" + words.groups.net.down.icon + "/" + words.groups.net.up.value, "true/false/false", "word draft net");
  eq(words.groups.disk.read.quiet + "/" + words.groups.disk.write.value + "/" + words.groups.disk.warnUsage, "true/true/60", "word draft disk activity quiet");
  eq(words.groups.fan.rpm.unit + "/" + words.groups.fan.hidden.join() + "/" + words.colorIntensity, "true/fan:a/fan1/70", "word draft fans and color");

  // serialize()/adoptPrefs() round trips with the exact key order.
  var parsedBack = JSON.parse(serialize({ groups: {}, unit: "F" }));
  deepEq(Object.keys(parsedBack), ["version", "order", "groups", "unit", "colorIntensity", "gaps", "refresh"], "serialize stable key order");
  deepEq(Object.keys(parsedBack.groups.cpu.load), ["bar", "number", "quiet"], "a part keeps its toggle order");
  deepEq(adoptPrefs(serialize(up)), up, "round trip of an upgraded v1 file");
  deepEq(adoptPrefs(serialize(words)), words, "round trip of an upgraded word draft");
  deepEq(adoptPrefs(serialize(modes)), modes, "round trip of an upgraded mode draft");
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
