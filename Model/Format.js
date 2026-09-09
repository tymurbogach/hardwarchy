// Format helpers for the modular HW monitor.
// Plain script: top-level var and function only, no imports or exports,
// so it loads both as a QML pragma library and in node via vm.
// All values are numbers or null. Missing sensor data stays null.

var FORMAT_GIB_PER_KIB = 1048576;
var FORMAT_GIB_PER_BYTE = 1073741824;

// Return a finite number or null. Accepts numbers and numeric strings.
function numberOrNull(v) {
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

// Celsius to Fahrenheit, null-safe.
function celsiusToFahrenheit(c) {
  var n = numberOrNull(c);
  if (n === null) {
    return null;
  }
  return n * 9 / 5 + 32;
}

// Convert a Celsius reading to the requested unit ("C" or "F").
function convertTemp(c, unit) {
  var n = numberOrNull(c);
  if (n === null) {
    return null;
  }
  if (unit === "F" || unit === "f") {
    return celsiusToFahrenheit(n);
  }
  return n;
}

// Unit label with degree sign for menu and tooltip text.
function tempUnitLabel(unit) {
  if (unit === "F" || unit === "f") {
    return "°F";
  }
  return "°C";
}

// Menu and tooltip temperature, for example "46 °C" or "115 °F".
function formatTemp(celsius, unit) {
  var v = convertTemp(celsius, unit);
  if (v === null) {
    return null;
  }
  return String(Math.round(v)) + " " + tempUnitLabel(unit);
}

// Bar temperature, unit letter dropped next to the thermometer,
// for example "46°". Still converts to Fahrenheit when asked.
function formatTempBar(celsius, unit) {
  var v = convertTemp(celsius, unit);
  if (v === null) {
    return null;
  }
  return String(Math.round(v)) + "°";
}

// GiB value: one decimal under 10, no decimals at 10 and above.
function formatGib(gib) {
  var n = numberOrNull(gib);
  if (n === null) {
    return null;
  }
  if (n < 0) {
    n = 0;
  }
  if (n < 10) {
    var rounded = Math.round(n * 10) / 10;
    return rounded.toFixed(1);
  }
  return String(Math.round(n));
}

// GiB pair for memory read-outs, for example "9.4/62G".
function formatGibPair(usedGib, totalGib) {
  var u = numberOrNull(usedGib);
  var t = numberOrNull(totalGib);
  if (u === null || t === null) {
    return null;
  }
  var us = formatGib(u);
  var ts = formatGib(t);
  if (us === null || ts === null) {
    return null;
  }
  return us + "/" + ts + "G";
}

// KiB to GiB, null-safe.
function kibToGib(kib) {
  var n = numberOrNull(kib);
  if (n === null) {
    return null;
  }
  return n / FORMAT_GIB_PER_KIB;
}

// Bytes to GiB, null-safe. Used for VRAM fields.
function bytesToGib(b) {
  var n = numberOrNull(b);
  if (n === null) {
    return null;
  }
  return n / FORMAT_GIB_PER_BYTE;
}

// KiB pair directly, for example "9.4/62G".
function formatKibPair(usedKib, totalKib) {
  var u = kibToGib(usedKib);
  var t = kibToGib(totalKib);
  if (u === null || t === null) {
    return null;
  }
  return formatGibPair(u, t);
}

// Short clock for the bar, for example "3.2G" or "800M".
function formatClockShort(mhz) {
  var n = numberOrNull(mhz);
  if (n === null) {
    return null;
  }
  if (n < 0) {
    return null;
  }
  if (n >= 1000) {
    var ghz = n / 1000;
    var r = Math.round(ghz * 10) / 10;
    return r.toFixed(1) + "G";
  }
  return String(Math.round(n)) + "M";
}

// Long clock for the menu, for example "3.2 GHz" or "800 MHz".
function formatClockLong(mhz) {
  var n = numberOrNull(mhz);
  if (n === null) {
    return null;
  }
  if (n < 0) {
    return null;
  }
  if (n >= 1000) {
    var ghz = n / 1000;
    var r = Math.round(ghz * 10) / 10;
    return r.toFixed(1) + " GHz";
  }
  return String(Math.round(n)) + " MHz";
}

// Power read-out, for example "45 W" or "45.5 W".
function formatWatts(w) {
  var n = numberOrNull(w);
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

// Bar percent, for example "12%".
function formatPercentBar(p) {
  var n = numberOrNull(p);
  if (n === null) {
    return null;
  }
  return String(Math.round(n)) + "%";
}

// Menu percent with a space, for example "12 %".
function formatPercentMenu(p) {
  var n = numberOrNull(p);
  if (n === null) {
    return null;
  }
  return String(Math.round(n)) + " %";
}
