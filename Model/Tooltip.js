// Tooltips for the modular HW monitor.
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

function tooltipStr(v) {
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
  return null;
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
    var r = Math.round(n * 10) / 10;
    return r.toFixed(1);
  }
  return String(Math.round(n));
}

function tooltipClockLong(mhz) {
  var n = tooltipNum(mhz);
  if (n === null || n < 0) {
    return null;
  }
  if (n >= 1000) {
    var r = Math.round(n / 1000 * 10) / 10;
    return r.toFixed(1) + " GHz";
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
  var value = tooltipStr(metric.value);
  if (value === null) {
    if (tooltipStr(metric.bar) !== null) {
      value = tooltipStr(metric.bar);
    } else {
      value = "—";
    }
  }
  return label + ": " + value;
}

function tooltipCpuDetails(metric, reading) {
  var lines = [];
  var model = null;
  var cores = null;
  var one = null;
  var five = null;
  var fifteen = null;
  var mhz = null;
  if (metric && typeof metric === "object") {
    model = tooltipStr(metric.cpuModel);
    if (model === null) {
      model = tooltipStr(metric.cpu_model);
    }
    cores = tooltipNum(metric.cpuCores);
    if (cores === null) {
      cores = tooltipNum(metric.cpu_cores);
    }
    one = tooltipNum(metric.loadOne);
    five = tooltipNum(metric.loadFive);
    fifteen = tooltipNum(metric.loadFifteen);
    mhz = tooltipNum(metric.mhz);
    if (mhz === null) {
      mhz = tooltipNum(metric.cpu_mhz);
    }
  }
  if (reading && typeof reading === "object" && !tooltipIsArray((reading))) {
    if (model === null) {
      model = tooltipStr(reading.cpu_model);
    }
    if (cores === null) {
      cores = tooltipNum(reading.cpu_cores);
    }
    if (reading.load && typeof reading.load === "object") {
      if (one === null) {
        one = tooltipNum(reading.load.one);
      }
      if (five === null) {
        five = tooltipNum(reading.load.five);
      }
      if (fifteen === null) {
        fifteen = tooltipNum(reading.load.fifteen);
      }
    }
    if (mhz === null) {
      mhz = tooltipNum(reading.cpu_mhz);
    }
  }
  if (model !== null && cores !== null) {
    lines.push(model + " · " + String(Math.round(cores)) + " cores");
  } else if (model !== null) {
    lines.push(model);
  } else if (cores !== null) {
    lines.push(String(Math.round(cores)) + " cores");
  }
  if (one !== null || five !== null || fifteen !== null) {
    var parts = [];
    if (one !== null) {
      parts.push(one.toFixed(2));
    }
    if (five !== null) {
      parts.push(five.toFixed(2));
    }
    if (fifteen !== null) {
      parts.push(fifteen.toFixed(2));
    }
    if (parts.length > 0) {
      lines.push("Load " + parts.join(" "));
    }
  }
  var clock = tooltipClockLong(mhz);
  if (clock !== null) {
    lines.push(clock);
  }
  return lines;
}

function tooltipGpuDetails(metric, reading) {
  var lines = [];
  var used = null;
  var total = null;
  var watts = null;
  var mhz = null;
  if (metric && typeof metric === "object") {
    used = tooltipNum(metric.vramUsedB);
    if (used === null) {
      used = tooltipNum(metric.vram_used_b);
    }
    total = tooltipNum(metric.vramTotalB);
    if (total === null) {
      total = tooltipNum(metric.vram_total_b);
    }
    watts = tooltipNum(metric.watts);
    mhz = tooltipNum(metric.mhz);
    if (mhz === null) {
      mhz = tooltipNum(metric.gpu_mhz);
    }
  }
  if (reading && typeof reading === "object" && !tooltipIsArray((reading))) {
    if (reading.gpu_detail && typeof reading.gpu_detail === "object") {
      if (used === null) {
        used = tooltipNum(reading.gpu_detail.vram_used_b);
      }
      if (total === null) {
        total = tooltipNum(reading.gpu_detail.vram_total_b);
      }
      if (watts === null) {
        watts = tooltipNum(reading.gpu_detail.watts);
      }
    }
    if (mhz === null) {
      mhz = tooltipNum(reading.gpu_mhz);
    }
  }
  if (used !== null && total !== null && total > 0) {
    var ug = tooltipGib(used / 1073741824);
    var tg = tooltipGib(total / 1073741824);
    if (ug !== null && tg !== null) {
      lines.push("VRAM " + ug + "/" + tg + " GiB");
    }
  } else if (used !== null) {
    var uo = tooltipGib(used / 1073741824);
    if (uo !== null) {
      lines.push("VRAM " + uo + " GiB");
    }
  } else if (total !== null) {
    var to = tooltipGib(total / 1073741824);
    if (to !== null) {
      lines.push("VRAM " + to + " GiB total");
    }
  }
  var wstr = tooltipWatts(watts);
  if (wstr !== null) {
    lines.push(wstr);
  }
  var clock = tooltipClockLong(mhz);
  if (clock !== null) {
    lines.push(clock);
  }
  return lines;
}

function tooltipMemDetails(metric, reading, opts) {
  var lines = [];
  var ramFormat = "percent";
  if (opts && opts.ramFormat === "used") {
    ramFormat = "used";
  } else if (metric && metric.ramFormat === "used") {
    ramFormat = "used";
  } else if (reading && reading.ramFormat === "used") {
    ramFormat = "used";
  }
  var percent = null;
  var usedKib = null;
  var totalKib = null;
  var swapUsed = null;
  var swapTotal = null;
  if (metric && typeof metric === "object") {
    percent = tooltipNum(metric.percent);
    if (percent === null) {
      percent = tooltipNum(metric.mem);
    }
    usedKib = tooltipNum(metric.memUsedKib);
    if (usedKib === null) {
      usedKib = tooltipNum(metric.mem_used_kib);
    }
    totalKib = tooltipNum(metric.memTotalKib);
    if (totalKib === null) {
      totalKib = tooltipNum(metric.mem_total_kib);
    }
    swapUsed = tooltipNum(metric.swapUsedKib);
    if (swapUsed === null) {
      swapUsed = tooltipNum(metric.swap_used_kib);
    }
    swapTotal = tooltipNum(metric.swapTotalKib);
    if (swapTotal === null) {
      swapTotal = tooltipNum(metric.swap_total_kib);
    }
  }
  if (reading && typeof reading === "object" && !tooltipIsArray((reading))) {
    if (percent === null) {
      percent = tooltipNum(reading.mem);
    }
    if (usedKib === null) {
      usedKib = tooltipNum(reading.mem_used_kib);
    }
    if (totalKib === null) {
      totalKib = tooltipNum(reading.mem_total_kib);
    }
    if (swapUsed === null) {
      swapUsed = tooltipNum(reading.swap_used_kib);
    }
    if (swapTotal === null) {
      swapTotal = tooltipNum(reading.swap_total_kib);
    }
    if (ramFormat === "percent" && reading.ramFormat === "used") {
      ramFormat = "used";
    }
  }
  // Show whichever format the headline is not.
  if (ramFormat === "used") {
    if (percent !== null) {
      lines.push(String(Math.round(percent)) + " %");
    }
  } else {
    if (usedKib !== null && totalKib !== null && totalKib > 0) {
      var ug = tooltipGib(usedKib / 1048576);
      var tg = tooltipGib(totalKib / 1048576);
      if (ug !== null && tg !== null) {
        lines.push(ug + "/" + tg + " GiB");
      }
    }
  }
  if (swapTotal !== null && swapTotal > 0) {
    var su = 0;
    if (swapUsed !== null && swapUsed >= 0) {
      su = swapUsed / 1048576;
    }
    var st = swapTotal / 1048576;
    var sus = tooltipGib(su);
    var sts = tooltipGib(st);
    if (sus !== null && sts !== null) {
      lines.push("Swap " + sus + "/" + sts + " GiB");
    }
  }
  return lines;
}

function tooltipDeviceOf(metric) {
  if (metric && typeof metric.device === "string") {
    return metric.device;
  }
  if (metric && typeof metric.key === "string") {
    if (metric.key.indexOf("cpu_") === 0) {
      return "cpu";
    }
    if (metric.key.indexOf("gpu_") === 0) {
      return "gpu";
    }
    if (metric.key.indexOf("mem") === 0) {
      return "mem";
    }
    if (metric.key.indexOf("fan:") === 0) {
      return "fan";
    }
  }
  return "";
}

// One metric tooltip: headline first, then detail lines. Nulls skipped.
function tooltip(metric, reading, opts) {
  if (!metric || typeof metric !== "object") {
    return "";
  }
  var lines = [];
  lines.push(tooltipHeadline(metric));
  var dev = tooltipDeviceOf(metric);
  var extra = [];
  if (dev === "cpu") {
    extra = tooltipCpuDetails(metric, reading);
  } else if (dev === "gpu") {
    extra = tooltipGpuDetails(metric, reading);
  } else if (dev === "mem") {
    extra = tooltipMemDetails(metric, reading, opts);
  }
  var i = 0;
  for (i = 0; i < extra.length; i++) {
    if (extra[i] !== null && extra[i] !== undefined && extra[i] !== "") {
      lines.push(extra[i]);
    }
  }
  return lines.join("\n");
}

// Joined usage plus temp tooltip: both headlines, then one detail block.
function tooltipJoined(usage, temp, reading, opts) {
  var lines = [];
  if (usage && typeof usage === "object") {
    lines.push(tooltipHeadline(usage));
  }
  if (temp && typeof temp === "object") {
    lines.push(tooltipHeadline(temp));
  }
  if (lines.length === 0) {
    return "";
  }
  var first = null;
  if (usage && typeof usage === "object") {
    first = usage;
  } else {
    first = temp;
  }
  var dev = tooltipDeviceOf(first);
  var extra = [];
  if (dev === "cpu") {
    extra = tooltipCpuDetails(first, reading);
    if (extra.length === 0 && temp && temp !== first) {
      extra = tooltipCpuDetails(temp, reading);
    }
    if (reading && extra.length === 0) {
      var both = tooltipCpuDetails(usage, reading);
      var j = 0;
      for (j = 0; j < both.length; j++) {
        extra.push(both[j]);
      }
    }
  } else if (dev === "gpu") {
    // Merge VRAM style details from both halves without duplicating.
    var seen = {};
    var a = tooltipGpuDetails(usage, reading);
    var b = tooltipGpuDetails(temp, reading);
    var k = 0;
    for (k = 0; k < a.length; k++) {
      if (!seen[a[k]]) {
        extra.push(a[k]);
        seen[a[k]] = true;
      }
    }
    for (k = 0; k < b.length; k++) {
      if (!seen[b[k]]) {
        extra.push(b[k]);
        seen[b[k]] = true;
      }
    }
  } else if (dev === "mem") {
    extra = tooltipMemDetails(first, reading, opts);
  }
  var i = 0;
  for (i = 0; i < extra.length; i++) {
    if (extra[i] !== null && extra[i] !== undefined && extra[i] !== "") {
      lines.push(extra[i]);
    }
  }
  return lines.join("\n");
}

// Tooltip for a strip cell. Reading supplies live details when the
// metric alone does not carry them. Opts may hold ramFormat and unit.
function tooltipFor(cell, reading, opts) {
  if (!cell || typeof cell !== "object") {
    return "";
  }
  if (cell.cell === "joined") {
    return tooltipJoined(cell.usage, cell.temp, reading, opts);
  }
  if (cell.cell === "gauge" || cell.cell === "metric") {
    if (cell.metric && typeof cell.metric === "object") {
      if (cell.metric.key === "placeholder") {
        return "No metrics visible";
      }
      return tooltip(cell.metric, reading, opts);
    }
    return "";
  }
  return "";
}
