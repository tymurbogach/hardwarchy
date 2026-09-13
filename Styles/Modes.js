// Bar cells for Hardwarchy.
// Plain script: top-level var and function only, no imports or exports.
// Standalone: does not call into Metrics.js. Metrics arrive already
// built and filtered, prefs already adopted; this file decides how each
// group's cell draws, one part at a time.

function modesIsArray(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}

function modesIsObject(v) {
  return v !== null && typeof v === "object" && !modesIsArray(v);
}

// The groups whose cell has a load a right-click can cycle, the part that
// holds it, and that part's number toggle.
var LOAD_PARTS = {
  cpu: { part: "load", number: "number" },
  gpu: { part: "load", number: "number" },
  mem: { part: "used", number: "percent" },
  disk: { part: "used", number: "percent" }
};

var LOAD_GROUPS = ["cpu", "gpu", "mem", "disk"];

// The next load a right-click shows: the number, then the bar, then both.
// Only those two toggles move; GiB and the color stay as they are.
function nextLoad(part, numberKey) {
  var src = modesIsObject(part) ? part : {};
  var out = {};
  var k = "";
  for (k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) {
      out[k] = src[k];
    }
  }
  var number = src[numberKey] === true;
  var bar = src.bar === true;
  if (number && !bar) {
    out[numberKey] = false;
    out.bar = true;
  } else if (!number && bar) {
    out[numberKey] = true;
    out.bar = true;
  } else {
    out[numberKey] = true;
    out.bar = false;
  }
  return out;
}

// The group patch a right-click applies, or null for a group with no load.
function cycleLoadPatch(prefs, id) {
  var spec = LOAD_PARTS[id];
  if (!spec) {
    return null;
  }
  var patch = {};
  patch[spec.part] = nextLoad(modesGroup(prefs, id)[spec.part], spec.number);
  return patch;
}

function modesText(v) {
  return typeof v === "string" ? v : "";
}

function modesGroup(prefs, id) {
  if (modesIsObject(prefs) && modesIsObject(prefs.groups) && modesIsObject(prefs.groups[id])) {
    return prefs.groups[id];
  }
  return {};
}

function modesOn(part, key) {
  return modesIsObject(part) && part[key] === true;
}

function modesQuiet(part) {
  return modesIsObject(part) && part.quiet === true;
}

// ---- pieces ----------------------------------------------------------
// A cell is a row of pieces. A piece is what MetricButton draws:
//   kind "mark"   a glyph, a word or a tag, placed by its ink
//   kind "gauge"  a vertical gauge, `ratio` 0..1
//   kind "text"   a reading; `pad` leading chars draw muted unless
//                 `padQuiet` is false
// `gap` is the space before it: "none" (first), "tight" (the iconGap,
// inside one part) or "part" (the partGap, between two parts). A mark
// hugs what it labels; every other part boundary takes the part gap.
// A quiet piece is always muted and never warms.

function modesPiece(kind, text, ratio, pad, quiet, severity) {
  return {
    kind: kind,
    text: text,
    ratio: ratio,
    pad: pad,
    padQuiet: true,
    quiet: quiet === true,
    severity: quiet === true ? 0 : severity,
    gap: "none"
  };
}

function modesMark(text, quiet, severity) {
  var mark = modesPiece("mark", text, -1, 0, quiet, severity);
  mark.isMark = true;
  return mark;
}

// Append one part (a list of pieces) to a cell's pieces, setting gaps.
function modesAddPart(pieces, part) {
  if (part.length === 0) {
    return;
  }
  var prev = pieces.length > 0 ? pieces[pieces.length - 1] : null;
  var i = 0;
  for (i = 0; i < part.length; i++) {
    if (i > 0) {
      part[i].gap = "tight";
    } else if (prev === null) {
      part[i].gap = "none";
    } else {
      part[i].gap = prev.isMark === true && prev.isWord !== true ? "tight" : "part";
    }
    pieces.push(part[i]);
  }
}

// Usage digits, with the pad digit shown muted, shown plain, or dropped.
function modesDigits(m, zero, quiet, severity) {
  var bar = modesText(m.bar);
  var pad = m.padLen || 0;
  if (pad > 0 && modesIsObject(zero) && zero.show === false) {
    return modesPiece("text", bar.substring(pad), -1, 0, quiet, severity);
  }
  var piece = modesPiece("text", bar, -1, pad, quiet, severity);
  piece.padQuiet = !modesIsObject(zero) || zero.quiet !== false;
  return piece;
}

function modesGaugeable(m, vertical) {
  return typeof m.ratio === "number" && isFinite(m.ratio) && vertical !== true;
}

// ---- parts, each a list of parts (a list of piece lists) --------------

// A CPU/GPU load: the bar and the number. A bar with no room (a vertical
// bar) or no ratio falls back to the number.
function modesLoadParts(m, part, zero, vertical) {
  if (!m) {
    return [];
  }
  var quiet = modesQuiet(part);
  var sev = m.severity || 0;
  var gauge = modesOn(part, "bar") && modesGaugeable(m, vertical);
  var main = [];
  if (gauge) {
    main.push(modesPiece("gauge", "", Math.max(0, Math.min(1, m.ratio)), 0, quiet, sev));
  }
  if (modesOn(part, "number") || (modesOn(part, "bar") && !gauge)) {
    main.push(modesDigits(m, zero, quiet, sev));
  }
  return [main];
}

// Space used (memory, swap, VRAM, disk): the bar, the percentage and the
// GiB pair. The GiB pair is its own part, so two numbers never touch.
function modesUsedParts(m, part, zero, vertical) {
  if (!m) {
    return [];
  }
  var quiet = modesQuiet(part);
  var sev = m.severity || 0;
  var gauge = modesOn(part, "bar") && modesGaugeable(m, vertical);
  var gib = modesOn(part, "gib") && modesText(m.gib) !== "";
  var main = [];
  if (gauge) {
    main.push(modesPiece("gauge", "", Math.max(0, Math.min(1, m.ratio)), 0, quiet, sev));
  }
  if (modesOn(part, "percent") || (modesOn(part, "bar") && !gauge && !gib)) {
    main.push(modesDigits(m, zero, quiet, sev));
  }
  var parts = [main];
  if (gib) {
    parts.push([modesPiece("text", m.gib, -1, 0, quiet, sev)]);
  }
  return parts;
}

// A reading shown or not: the clock, the power draw.
function modesShowParts(text, part) {
  if (!modesOn(part, "show") || modesText(text) === "") {
    return [];
  }
  return [[modesPiece("text", text, -1, 0, modesQuiet(part), 0)]];
}

// A reading with an optional mark before it: the temp and its
// thermometer, the net rates and their arrows, the disk rates and their
// R/W tags. Its mark never shows without its value.
function modesMarkedParts(m, part, markKey, text) {
  if (!m || !modesOn(part, "value") || modesText(text) === "") {
    return [];
  }
  var quiet = modesQuiet(part);
  var sev = m.severity || 0;
  var out = [];
  if (modesOn(part, markKey) && modesText(m.glyph) !== "") {
    out.push(modesMark(m.glyph, quiet, sev));
  }
  out.push(modesPiece("text", text, -1, 0, quiet, sev));
  return [out];
}

// The load average: the chosen windows, as one reading.
function modesAvgParts(m, part) {
  if (!m) {
    return [];
  }
  var keys = ["one", "five", "fifteen"];
  var chosen = [];
  var i = 0;
  for (i = 0; i < keys.length; i++) {
    if (modesOn(part, keys[i]) && modesText(m[keys[i]]) !== "") {
      chosen.push(m[keys[i]]);
    }
  }
  if (chosen.length === 0) {
    return [];
  }
  return [[modesPiece("text", chosen.join(" "), -1, 0, modesQuiet(part), 0)]];
}

// The label: the group's glyph, its word, both, or nothing.
function modesLabelPart(first, label) {
  var quiet = modesQuiet(label);
  var out = [];
  if (modesOn(label, "icon") && modesText(first.groupGlyph) !== "") {
    out.push(modesMark(first.groupGlyph, quiet, 0));
  }
  if (modesOn(label, "word") && modesText(first.word) !== "") {
    var word = modesMark(first.word, quiet, 0);
    word.isWord = true;
    out.push(word);
  }
  return out;
}

function modesByKind(items) {
  var out = {};
  var i = 0;
  for (i = 0; i < items.length; i++) {
    if (items[i] && typeof items[i].kind === "string") {
      out[items[i].kind] = items[i];
    }
  }
  return out;
}

// One cell from its label and its readings. A cell with no reading is no
// cell: a lonely label means nothing on a bar. The label warms with the
// hottest reading it names. The metrics ride along for the tooltip.
function modesCell(key, device, metrics, labelPart, parts, dim) {
  var readings = [];
  var i = 0;
  for (i = 0; i < parts.length; i++) {
    readings = readings.concat(parts[i]);
  }
  if (readings.length === 0) {
    return null;
  }
  var severity = 0;
  for (i = 0; i < readings.length; i++) {
    severity = Math.max(severity, readings[i].severity || 0);
  }
  for (i = 0; i < labelPart.length; i++) {
    if (!labelPart[i].quiet) {
      labelPart[i].severity = severity;
    }
  }
  var pieces = [];
  modesAddPart(pieces, labelPart);
  for (i = 0; i < parts.length; i++) {
    modesAddPart(pieces, parts[i]);
  }
  return { key: key, device: device, pieces: pieces, severity: severity, dim: dim === true, metrics: metrics };
}

// The cells of one group, from its visible metrics in order. Every group
// draws one cell, except fans: each fan is its own cell.
function groupCells(items, prefs, id, vertical) {
  var list = modesIsArray(items) ? items.filter(function (m) { return !!m; }) : [];
  if (list.length === 0) {
    return [];
  }
  var g = modesGroup(prefs, id);
  var out = [];
  var cell = null;
  var i = 0;
  if (id === "fan") {
    for (i = 0; i < list.length; i++) {
      var rpmText = modesText(list[i].bar) + (modesOn(g.rpm, "unit") ? " RPM" : "");
      var rpm = modesOn(g.rpm, "value")
        ? [[modesPiece("text", rpmText, -1, 0, modesQuiet(g.rpm), list[i].severity || 0)]]
        : [];
      cell = modesCell(list[i].key, id, [list[i]], modesLabelPart(list[i], g.label), rpm, list[i].dim);
      if (cell) {
        out.push(cell);
      }
    }
    return out;
  }
  var k = modesByKind(list);
  var parts = [];
  if (id === "cpu" || id === "gpu") {
    parts = parts.concat(modesLoadParts(k.usage, g.load, g.zero, vertical));
    parts = parts.concat(modesShowParts(k.usage ? k.usage.clock : "", g.clock));
    var temp = k.temp || null;
    var tempText = temp ? modesText(temp.bar) + (modesOn(g.temp, "unit") ? modesText(temp.unit) : "") : "";
    parts = parts.concat(modesMarkedParts(temp, g.temp, "icon", tempText));
    if (id === "cpu") {
      parts = parts.concat(modesAvgParts(k.avg, g.avg));
    } else {
      parts = parts.concat(modesUsedParts(k.vram, g.vram, g.zero, vertical));
      parts = parts.concat(modesShowParts(k.power ? k.power.bar : "", g.power));
    }
  } else if (id === "mem") {
    parts = parts.concat(modesUsedParts(k.usage, g.used, g.zero, vertical));
    parts = parts.concat(modesUsedParts(k.swap, g.swap, g.zero, vertical));
  } else if (id === "net") {
    parts = parts.concat(modesMarkedParts(k.down, g.down, "icon", k.down ? k.down.bar : ""));
    parts = parts.concat(modesMarkedParts(k.up, g.up, "icon", k.up ? k.up.bar : ""));
  } else if (id === "disk") {
    parts = parts.concat(modesUsedParts(k.usage, g.used, g.zero, vertical));
    parts = parts.concat(modesMarkedParts(k.read, g.read, "tag", k.read ? k.read.bar : ""));
    parts = parts.concat(modesMarkedParts(k.write, g.write, "tag", k.write ? k.write.bar : ""));
  }
  cell = modesCell(id, id, list, modesLabelPart(list[0], g.label), parts, list[0].dim);
  if (cell) {
    out.push(cell);
  }
  return out;
}

// The strip with nothing visible: one dimmed chip that opens the menu,
// never a zero-pixel dead slot.
function placeholderCell() {
  return modesCell("placeholder", "placeholder", [{
    key: "placeholder",
    device: "placeholder",
    kind: "placeholder",
    label: "No metrics visible",
    groupGlyph: "",
    word: "",
    bar: "—",
    value: "All metrics hidden",
    severity: 0,
    dim: true
  }], [], [[modesPiece("text", "—", -1, 0, false, 0)]], true);
}

// Cells for the whole strip from contiguous per-group runs (see
// Metrics.metricsGroupRuns); each run draws with its own group's prefs.
function groupStripCells(runs, prefs, vertical) {
  var out = [];
  var list = modesIsArray(runs) ? runs : [];
  var i = 0;
  for (i = 0; i < list.length; i++) {
    if (list[i] && modesIsArray(list[i].items)) {
      out = out.concat(groupCells(list[i].items, prefs, list[i].device, vertical));
    }
  }
  if (out.length === 0) {
    out.push(placeholderCell());
  }
  return out;
}
