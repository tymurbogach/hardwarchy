// Tooltips for Hardwarchy.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: formatting helpers are duplicated here under
// tooltip-prefixed names so load order does not matter.

function tooltipIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

function tooltipNum(v) {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === "number") {
    return isFinite(v) ? v : null;
  }
  if (typeof v === "string") {
    var t = v.replace(/^\s+|\s+$/g, "");
    if (t === "") {
      return null;
    }
    var n = Number(t);
    return isFinite(n) ? n : null;
  }
  return null;
}

function tooltipStr(v) {
  if (typeof v !== "string") {
    return null;
  }
  var t = v.replace(/^\s+|\s+$/g, "");
  return t === "" ? null : t;
}

function tooltipGib(gib) {
  var n = tooltipNum(gib);
  if (n === null) {
    return null;
  }
  if (n < 0) {
    n = 0;
  }
  if (n < 10) {
    return (Math.round(n * 10) / 10).toFixed(1);
  }
  return String(Math.round(n));
}

function tooltipClockLong(mhz) {
  var n = tooltipNum(mhz);
  if (n === null || n < 0) {
    return null;
  }
  if (n >= 1000) {
    return (Math.round(n / 1000 * 10) / 10).toFixed(1) + " GHz";
  }
  return String(Math.round(n)) + " MHz";
}

function tooltipWatts(w) {
  var n = tooltipNum(w);
  if (n === null) {
    return null;
  }
  if (n < 0) {
    n = 0;
  }
  var r = Math.round(n * 10) / 10;
  if (r === Math.round(r)) {
    return String(Math.round(r)) + " W";
  }
  return r.toFixed(1) + " W";
}

function tooltipHeadline(metric) {
  if (!metric || typeof metric !== "object") {
    return "";
  }
  var label = tooltipStr(metric.label) || tooltipStr(metric.key) || "Metric";
  var value = tooltipStr(metric.value) || tooltipStr(metric.bar) || "—";
  return label + ": " + value;
}

function tooltipReading(reading) {
  return (reading && typeof reading === "object" && !tooltipIsArray(reading)) ? reading : {};
}

// Detail lines per device. `shown` holds the metric kinds the cell
// already headlines, so a detail never repeats a headline.
function tooltipCpuDetails(first, reading, shown) {
  var r = tooltipReading(reading);
  var lines = [];
  var model = tooltipStr(first.cpuModel) || tooltipStr(r.cpu_model);
  var cores = tooltipNum(first.cpuCores);
  if (cores === null) {
    cores = tooltipNum(r.cpu_cores);
  }
  if (model !== null && cores !== null) {
    lines.push(model + " · " + String(Math.round(cores)) + " cores");
  } else if (model !== null) {
    lines.push(model);
  } else if (cores !== null) {
    lines.push(String(Math.round(cores)) + " cores");
  }
  if (!shown.avg && r.load && typeof r.load === "object") {
    var parts = [r.load.one, r.load.five, r.load.fifteen]
      .map(tooltipNum)
      .filter(function (v) { return v !== null; })
      .map(function (v) { return v.toFixed(2); });
    if (parts.length > 0) {
      lines.push("Load " + parts.join(" "));
    }
  }
  var mhz = tooltipNum(first.mhz);
  if (mhz === null) {
    mhz = tooltipNum(r.cpu_mhz);
  }
  var clock = tooltipClockLong(mhz);
  if (clock !== null && !(shown.usage && first.clock)) {
    lines.push(clock);
  }
  return lines;
}

function tooltipGpuDetails(first, reading, shown) {
  var r = tooltipReading(reading);
  var detail = (r.gpu_detail && typeof r.gpu_detail === "object") ? r.gpu_detail : {};
  var lines = [];
  var source = tooltipStr(r.gpu_source);
  if (source !== null) {
    lines.push("Source " + source);
  }
  var used = tooltipNum(detail.vram_used_b);
  var total = tooltipNum(detail.vram_total_b);
  if (!shown.vram && used !== null && total !== null && total > 0) {
    lines.push("VRAM " + tooltipGib(used / 1073741824) + "/" + tooltipGib(total / 1073741824) + " GiB");
  }
  var watts = tooltipWatts(detail.watts);
  if (!shown.power && watts !== null) {
    lines.push(watts);
  }
  var clock = tooltipClockLong(r.gpu_mhz);
  if (clock !== null && !(shown.usage && first.clock)) {
    lines.push(clock);
  }
  return lines;
}

function tooltipMemDetails(first, reading, shown) {
  var r = tooltipReading(reading);
  var lines = [];
  var su = tooltipNum(r.swap_used_kib);
  var st = tooltipNum(r.swap_total_kib);
  // Nulls are skipped: without a used value there is nothing truthful
  // to print, so a missing swap stays silent instead of reading 0.0.
  if (!shown.swap && st !== null && st > 0 && su !== null && su >= 0) {
    lines.push("Swap " + tooltipGib(su / 1048576) + "/" + tooltipGib(st / 1048576) + " GiB");
  }
  return lines;
}

function tooltipNetDetails(first) {
  var iface = tooltipStr(first.iface);
  return iface !== null ? ["Interface " + iface] : [];
}

function tooltipDiskDetails(first, shown) {
  var lines = [];
  var mount = tooltipStr(first.mount);
  if (mount !== null) {
    lines.push("Mount " + mount);
  }
  if (shown.read || shown.write) {
    lines.push("Read and write count every physical disk");
  }
  return lines;
}

function tooltipDeviceOf(metric) {
  if (metric && typeof metric.device === "string") {
    return metric.device;
  }
  return "";
}

// A tooltip for a list of metrics from one group: every headline first,
// then that group's detail lines once. Nulls are skipped silently.
function tooltipCell(metrics, device, reading) {
  var list = tooltipIsArray(metrics) ? metrics.filter(function (m) { return m && typeof m === "object"; }) : [];
  if (list.length === 0) {
    return "";
  }
  var lines = [];
  var shown = {};
  var i = 0;
  for (i = 0; i < list.length; i++) {
    lines.push(tooltipHeadline(list[i]));
    shown[list[i].kind] = true;
  }
  var extra = [];
  if (device === "cpu") {
    extra = tooltipCpuDetails(list[0], reading, shown);
  } else if (device === "gpu") {
    extra = tooltipGpuDetails(list[0], reading, shown);
  } else if (device === "mem") {
    extra = tooltipMemDetails(list[0], reading, shown);
  } else if (device === "net") {
    extra = tooltipNetDetails(list[0]);
  } else if (device === "disk") {
    extra = tooltipDiskDetails(list[0], shown);
  }
  for (i = 0; i < extra.length; i++) {
    if (extra[i] && lines.indexOf(extra[i]) < 0) {
      lines.push(extra[i]);
    }
  }
  return lines.join("\n");
}

// One metric's tooltip: its headline, then its group's detail lines.
function tooltip(metric, reading) {
  return tooltipCell([metric], tooltipDeviceOf(metric), reading);
}

// Tooltip for a strip cell, from every metric it draws.
function tooltipFor(cell, reading) {
  if (!cell || typeof cell !== "object" || !tooltipIsArray(cell.metrics)) {
    return "";
  }
  if (cell.key === "placeholder") {
    return "No metrics visible";
  }
  return tooltipCell(cell.metrics, cell.device, reading);
}
