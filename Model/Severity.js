// Severity ramp for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports.
// Thresholds are plain numbers. Missing values never warm.

// Default thresholds from the spec.
var SEVERITY_DEFAULT_WARN_USAGE = 70;
var SEVERITY_DEFAULT_CRIT_USAGE = 90;
var SEVERITY_DEFAULT_WARN_TEMP = 75;
var SEVERITY_DEFAULT_CRIT_TEMP = 90;

// Clean a value to a finite number or null without depending on Format.js.
function severityNum(v) {
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

// Linear ramp 0 below warn to 1 at critical. Null-safe, always 0..1.
function ramp(value, warn, crit) {
  var v = severityNum(value);
  var w = severityNum(warn);
  var c = severityNum(crit);
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

// Usage severity in percent. Defaults 70 warn and 90 crit.
function usageSeverity(p, warnU, critU) {
  var w = severityNum(warnU);
  var c = severityNum(critU);
  if (w === null) {
    w = SEVERITY_DEFAULT_WARN_USAGE;
  }
  if (c === null) {
    c = SEVERITY_DEFAULT_CRIT_USAGE;
  }
  return ramp(p, w, c);
}

// Temperature severity in Celsius. Defaults 75 warn and 90 crit.
function tempSeverity(t, warnT, critT) {
  var w = severityNum(warnT);
  var c = severityNum(critT);
  if (w === null) {
    w = SEVERITY_DEFAULT_WARN_TEMP;
  }
  if (c === null) {
    c = SEVERITY_DEFAULT_CRIT_TEMP;
  }
  return ramp(t, w, c);
}
