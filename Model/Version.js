// Version comparison for the optional menu update action.
// Plain script: top-level var and function only.

function versionText(value) {
  if (typeof value !== "string") return null;
  var text = value.replace(/^\s+|\s+$/g, "");
  return /^v?\d+(\.\d+)*$/.test(text) ? text : null;
}

function versionParts(value) {
  var text = versionText(value);
  return text === null ? null : text.replace(/^v/, "").split(".").map(Number);
}

// Whether `latest` is a newer plain dotted version than `current`.
function isNewer(latest, current) {
  var a = versionParts(latest);
  var b = versionParts(current);
  if (a === null || b === null) return false;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    var x = a[i] || 0;
    var y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}
