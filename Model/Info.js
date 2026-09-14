// Menu facts for Hardwarchy: the system lines under the title, the info
// rows at the top of a group's card, and the version check behind the
// update button. Input is the `sysread --info` object (raw facts that
// never change) and the live reading (which GPU, link and mount).
// Plain script: top-level var and function only, no imports or exports.
// Standalone: it shares no helper with the other scripts, so load order
// does not matter.

var INFO_GPU_VENDORS = { nvidia: "NVIDIA", amd: "AMD", intel: "Intel" };

// Short maker names, matched on the start of the DMI vendor string.
var INFO_MAKERS = [
  [/^lenovo/i, "Lenovo"], [/^dell/i, "Dell"], [/^(hp|hewlett)/i, "HP"],
  [/^asus/i, "ASUS"], [/^micro-star/i, "MSI"], [/^gigabyte/i, "Gigabyte"],
  [/^acer/i, "Acer"], [/^apple/i, "Apple"], [/^framework/i, "Framework"],
  [/^samsung/i, "Samsung"], [/^microsoft/i, "Microsoft"], [/^razer/i, "Razer"],
  [/^tuxedo/i, "TUXEDO"], [/^system76/i, "System76"], [/^(xiaomi|timi)/i, "Xiaomi"],
  [/^huawei/i, "Huawei"], [/^asrock/i, "ASRock"], [/^(toshiba|dynabook)/i, "Dynabook"],
  [/^qemu/i, "QEMU"], [/^innotek/i, "VirtualBox"]
];

// What a board maker writes into a DMI field it never filled in.
var INFO_DMI_FILLER = /^(to be filled by o\.?e\.?m\.?|default string|system (product )?name|system version|not (applicable|specified)|none|n\/a|o\.?e\.?m\.?|[0x]+|123456789)$/i;

function infoObj(v) {
  return (v && typeof v === "object" && Object.prototype.toString.call(v) !== "[object Array]") ? v : {};
}

function infoList(v) {
  return Object.prototype.toString.call(v) === "[object Array]" ? v : [];
}

// A trimmed string, or null for anything else or blank.
function infoText(v) {
  if (typeof v !== "string") {
    return null;
  }
  var t = v.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
  return t === "" ? null : t;
}

function infoNum(v) {
  return (typeof v === "number" && isFinite(v) && v >= 0) ? v : null;
}

// One `sysread --info` line, or null. Never throws.
function infoParse(text) {
  var doc = null;
  try {
    doc = JSON.parse(String(text));
  } catch (e) {
    return null;
  }
  return (doc && typeof doc === "object" && doc.info === 1) ? doc : null;
}

// ---- formatting ---------------------------------------------------------

// Bytes as GiB (one decimal under 100) or TiB, the plugin's binary units.
function infoSize(bytes) {
  var b = infoNum(bytes);
  if (b === null) {
    return null;
  }
  var gib = b / 1073741824;
  if (gib >= 1024) {
    return (gib / 1024).toFixed(1) + " TiB";
  }
  return (gib < 100 ? gib.toFixed(1) : String(Math.round(gib))) + " GiB";
}

function infoCount(n, one, many) {
  return String(n) + " " + (n === 1 ? one : many);
}

function infoUptime(seconds) {
  var s = infoNum(seconds);
  if (s === null) {
    return null;
  }
  var d = Math.floor(s / 86400);
  var h = Math.floor((s % 86400) / 3600);
  var m = Math.floor((s % 3600) / 60);
  if (d > 0) {
    return "up " + d + " d " + h + " h";
  }
  if (h > 0) {
    return "up " + h + " h " + m + " min";
  }
  return "up " + m + " min";
}

// ---- names --------------------------------------------------------------

function infoDmi(v) {
  var t = infoText(v);
  return (t === null || INFO_DMI_FILLER.test(t)) ? null : t;
}

function infoMaker(vendor) {
  var v = infoDmi(vendor);
  if (v === null) {
    return null;
  }
  for (var i = 0; i < INFO_MAKERS.length; i++) {
    if (INFO_MAKERS[i][0].test(v)) {
      return INFO_MAKERS[i][1];
    }
  }
  return v.split(/[ ,]/)[0];
}

// The machine's name: maker and model. Lenovo keeps the model name
// ("ThinkPad P14s Gen 6") in the version field and a part number in the
// product field; a self-built desktop has only its board to name.
function infoMachine(system) {
  var s = infoObj(system);
  var maker = infoMaker(s.vendor);
  var model = (maker === "Lenovo" && infoDmi(s.version)) || infoDmi(s.product);
  if (model === null) {
    maker = infoMaker(s.board_vendor);
    model = infoDmi(s.board);
  }
  if (model === null) {
    return maker;
  }
  if (maker === null || model.toLowerCase().indexOf(maker.toLowerCase()) === 0) {
    return model;
  }
  return maker + " " + model;
}

// "7.2.3-arch1-3" -> "Linux 7.2.3".
function infoKernel(release) {
  var r = infoText(release);
  if (r === null) {
    return null;
  }
  var m = /^(\d+\.\d+(\.\d+)?)/.exec(r);
  return "Linux " + (m ? m[1] : r);
}

// pci.ids names a device by its codename, with the marketing name in
// brackets when there is one: "Arrow Lake-P [Arc Pro 130T/140T]" ->
// "Intel Arc Pro 130T/140T".
function infoGpuName(gpu) {
  var g = infoObj(gpu);
  var vendor = INFO_GPU_VENDORS[g.source] || null;
  var name = infoText(g.name);
  if (name !== null) {
    var m = /\[([^\]]+)\]/.exec(name);
    if (m) {
      name = m[1];
    }
  } else {
    var pci = infoText(g.pci);
    name = pci === null ? null : "device " + pci;
  }
  if (name === null) {
    return vendor;
  }
  return (vendor === null || name.indexOf(vendor) === 0) ? name : vendor + " " + name;
}

// ---- what the menu shows ------------------------------------------------

// The lines under the menu title: the machine, then kernel and uptime.
// Two fixed lines, so a narrow menu never breaks one mid-phrase.
function infoSystemLines(info, nowSeconds) {
  var s = infoObj(infoObj(info).system);
  var boot = infoNum(s.boot_time);
  var now = infoNum(nowSeconds);
  var second = [];
  var kernel = infoKernel(s.kernel);
  var uptime = (boot !== null && now !== null && now >= boot) ? infoUptime(now - boot) : null;
  if (kernel !== null) {
    second.push(kernel);
  }
  if (uptime !== null) {
    second.push(uptime);
  }
  var lines = [];
  var machine = infoMachine(s);
  if (machine !== null) {
    lines.push(machine);
  }
  if (second.length > 0) {
    lines.push(second.join(" · "));
  }
  return lines;
}

function infoFind(list, field, value) {
  var l = infoList(list);
  for (var i = 0; i < l.length; i++) {
    if (infoObj(l[i])[field] === value) {
      return infoObj(l[i]);
    }
  }
  return null;
}

function infoCpuRows(cpu) {
  var c = infoObj(cpu);
  var cores = infoNum(c.cores);
  var threads = infoNum(c.threads);
  var counts = [];
  if (cores !== null) {
    counts.push(infoCount(cores, "core", "cores"));
  }
  if (threads !== null) {
    counts.push(infoCount(threads, "thread", "threads"));
  }
  var mhz = infoNum(c.max_mhz);
  var kib = infoNum(c.cache_kib);
  var level = infoNum(c.cache_level);
  var cache = null;
  if (kib !== null) {
    cache = kib >= 1024 ? (Math.round(kib / 1024 * 10) / 10) + " MiB" : kib + " KiB";
    if (level !== null) {
      cache += " L" + level;
    }
  }
  var governor = infoText(c.governor);
  var driver = infoText(c.driver);
  return [
    ["model", "Model", infoText(c.model)],
    ["cores", "Cores", counts.length > 0 ? counts.join(" · ") : null],
    ["speed", "Speed", mhz === null ? null : "up to " + (mhz >= 1000 ? (mhz / 1000).toFixed(1) + " GHz" : mhz + " MHz")],
    ["cache", "Cache", cache],
    ["governor", "Governor", governor === null ? null : (driver === null ? governor : governor + " · " + driver)]
  ];
}

// The GPU the reading follows; the only one when the reading names none.
function infoGpuRows(gpus, reading) {
  var list = infoList(gpus);
  var g = infoFind(list, "source", infoObj(reading).gpu_source) || (list.length === 1 ? infoObj(list[0]) : null);
  if (g === null) {
    return [];
  }
  return [
    ["model", "Model", infoGpuName(g)],
    ["driver", "Driver", infoText(g.driver)]
  ];
}

function infoMemRows(mem) {
  var m = infoObj(mem);
  var total = infoNum(m.total_kib);
  var swaps = infoList(m.swaps);
  var parts = [];
  for (var i = 0; i < swaps.length; i++) {
    var sw = infoObj(swaps[i]);
    var size = infoNum(sw.size_kib);
    var kind = infoText(sw.kind);
    if (size !== null && kind !== null) {
      parts.push(kind + " " + infoSize(size * 1024));
    }
  }
  return [
    ["size", "Size", total === null ? null : infoSize(total * 1024)],
    ["swaps", "Swaps", parts.length > 0 ? parts.join(" · ") : null]
  ];
}

function infoNetRows(net, reading) {
  var n = infoFind(net, "iface", infoObj(infoObj(reading).net).iface);
  if (n === null) {
    return [];
  }
  var type = n.virtual === true ? "Virtual" : (n.wireless === true ? "Wi-Fi" : "Ethernet");
  var state = infoText(n.state);
  var mbps = infoNum(n.mbps);
  var parts = [type];
  if (state !== null && state !== "unknown") {
    parts.push(state);
  }
  if (mbps !== null) {
    parts.push(mbps >= 1000 && mbps % 1000 === 0 ? (mbps / 1000) + " Gb/s" : mbps + " Mb/s");
  }
  return [
    ["type", "Type", parts.join(" · ")],
    ["mac", "MAC", infoText(n.mac)]
  ];
}

function infoDiskRows(disks, reading) {
  var d = infoFind(disks, "mount", infoObj(infoObj(reading).disk).mount);
  if (d === null) {
    return [];
  }
  var size = infoSize(d.size_b);
  var device = infoText(d.device);
  return [
    ["drive", "Drive", infoText(d.model)],
    ["size", "Size", size === null ? null : (device === null ? size : size + " · " + device)],
    ["format", "Format", infoText(d.fs)]
  ];
}

// The info rows at the top of one group's card, [{ key, title, value }],
// for the source the reading follows. A fact nobody reported is left out.
function infoRows(id, info, reading) {
  var i = infoObj(info);
  var rows = [];
  if (id === "cpu") {
    rows = infoCpuRows(i.cpu);
  } else if (id === "gpu") {
    rows = infoGpuRows(i.gpus, reading);
  } else if (id === "mem") {
    rows = infoMemRows(i.mem);
  } else if (id === "net") {
    rows = infoNetRows(i.net, reading);
  } else if (id === "disk") {
    rows = infoDiskRows(i.disks, reading);
  }
  var out = [];
  for (var r = 0; r < rows.length; r++) {
    if (rows[r][2] !== null) {
      out.push({ key: "info:" + rows[r][0], title: rows[r][1], value: rows[r][2] });
    }
  }
  return out;
}

// ---- versions -----------------------------------------------------------

function infoVersionParts(v) {
  var t = infoText(v);
  if (t === null || !/^v?\d+(\.\d+)*$/.test(t)) {
    return null;
  }
  return t.replace(/^v/, "").split(".").map(Number);
}

// Whether `latest` is a newer release than `current` ("2.10.0" beats
// "2.9.1"). Anything that is not a plain dotted version is never newer.
function infoNewerVersion(latest, current) {
  var a = infoVersionParts(latest);
  var b = infoVersionParts(current);
  if (a === null || b === null) {
    return false;
  }
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    var x = a[i] || 0;
    var y = b[i] || 0;
    if (x !== y) {
      return x > y;
    }
  }
  return false;
}
