#!/usr/bin/env bash
# Collector tests: fake hwmon tree via MONITOR_HWMON_ROOT, assert schema fields.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSREAD="$SCRIPT_DIR/../scripts/sysread"

PASS_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

[[ -x "$SYSREAD" ]] || fail "sysread not found/executable at $SYSREAD"
command -v python3 >/dev/null 2>&1 || fail "python3 is required for assertions"
command -v mktemp >/dev/null 2>&1 || fail "mktemp is required"

FAKE_ROOT="$(mktemp -d /tmp/fake-hwmon.XXXXXX)"
EMPTY_ROOT="$(mktemp -d /tmp/empty-hwmon.XXXXXX)"
FAKE_BIN="$(mktemp -d /tmp/fake-bin.XXXXXX)"
FAKE_DRM="$(mktemp -d /tmp/fake-drm.XXXXXX)"
OUT_MAIN="$FAKE_ROOT.out.json"
OUT_EMPTY="$FAKE_ROOT.empty.json"

cleanup() {
  rm -rf "$FAKE_ROOT" "$EMPTY_ROOT" "$FAKE_BIN" "$FAKE_DRM"
}
trap cleanup EXIT

# Shadow nvidia-smi with a failing stub so the AMD path is forced
# deterministically even on hosts that have an NVIDIA GPU.
printf '#!/usr/bin/env bash\nexit 1\n' > "$FAKE_BIN/nvidia-smi"
chmod +x "$FAKE_BIN/nvidia-smi"
export PATH="$FAKE_BIN:$PATH"

# --- build fake hwmon tree -----------------------------------------------
# k10temp with preferred Tctl label
mkdir -p "$FAKE_ROOT/hwmon0"
printf 'k10temp\n' > "$FAKE_ROOT/hwmon0/name"
printf '45000\n' > "$FAKE_ROOT/hwmon0/temp1_input"
printf 'Tctl\n' > "$FAKE_ROOT/hwmon0/temp1_label"

# one chip with a labelled and an unlabelled fan
mkdir -p "$FAKE_ROOT/hwmon1"
printf 'thinkpad\n' > "$FAKE_ROOT/hwmon1/name"
printf '2262\n' > "$FAKE_ROOT/hwmon1/fan1_input"
printf 'fan1\n' > "$FAKE_ROOT/hwmon1/fan1_label"
printf '0\n' > "$FAKE_ROOT/hwmon1/fan2_input"
# NOTE: no fan2_label on purpose -> default "Fan 2", stopped fan (0 RPM)

# amdgpu chip answering utilization + temp + clocks + vram + power
mkdir -p "$FAKE_ROOT/hwmon2"
printf 'amdgpu\n' > "$FAKE_ROOT/hwmon2/name"
printf '23\n' > "$FAKE_ROOT/hwmon2/gpu_busy_percent"
printf '61000\n' > "$FAKE_ROOT/hwmon2/temp1_input"
printf 'edge\n' > "$FAKE_ROOT/hwmon2/temp1_label"
printf '1500000000\n' > "$FAKE_ROOT/hwmon2/freq1_input"
printf '1073741824\n' > "$FAKE_ROOT/hwmon2/mem_info_vram_used"
printf '8589934592\n' > "$FAKE_ROOT/hwmon2/mem_info_vram_total"
printf '45000000\n' > "$FAKE_ROOT/hwmon2/power1_input"

# hotter non-preferred decoy: must NOT beat the Tctl preference
mkdir -p "$FAKE_ROOT/hwmon3"
printf 'nvme\n' > "$FAKE_ROOT/hwmon3/name"
printf '70000\n' > "$FAKE_ROOT/hwmon3/temp1_input"
printf 'Composite\n' > "$FAKE_ROOT/hwmon3/temp1_label"

mkdir -p "$EMPTY_ROOT"

# --- run one-shot against the fake tree -----------------------------------
if ! MONITOR_HWMON_ROOT="$FAKE_ROOT" MONITOR_DRM_ROOT="$FAKE_DRM" "$SYSREAD" > "$OUT_MAIN" 2>"$FAKE_ROOT.stderr"; then
  cat "$FAKE_ROOT.stderr" >&2
  fail "sysread one-shot exited non-zero against fake tree"
fi
[[ -s "$OUT_MAIN" ]] || fail "sysread produced no output against fake tree"
# exactly one line?
if [[ "$(wc -l < "$OUT_MAIN")" -ne 1 ]]; then
  fail "sysread one-shot must print exactly one JSON line"
fi
if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$OUT_MAIN"; then
  fail "sysread output is not valid JSON"
fi
pass "one-shot output is one valid JSON line"

# --- assertions via python3 ----------------------------------------------
PY_ASSERT_MAIN="$FAKE_ROOT/assert_main.py"
cat > "$PY_ASSERT_MAIN" <<'PYEOF'
import json, sys

doc = json.load(open(sys.argv[1]))
failures = []

def check(name, cond, detail=""):
    if cond:
        print(f"PASS: {name}")
    else:
        msg = f"FAIL: {name}"
        if detail:
            msg += f" ({detail})"
        print(msg, file=sys.stderr)
        failures.append(name)

check("schema==1", doc.get("schema") == 1, f"got {doc.get('schema')!r}")
check("temp parsed (Tctl preference wins)", doc.get("temp") == 45, f"got {doc.get('temp')!r}")

fans = doc.get("fans")
ok_fans = isinstance(fans, list) and len(fans) == 2
ids = sorted(f.get("id") for f in fans) if ok_fans else []
ok_ids = ok_fans and ids == ["thinkpad/fan1", "thinkpad/fan2"]
check("fans array has stable ids", ok_ids, f"got {fans!r}")
if ok_fans:
    by_id = {f.get("id"): f for f in fans}
    f1 = by_id.get("thinkpad/fan1", {})
    f2 = by_id.get("thinkpad/fan2", {})
    check("labelled fan keeps label", f1.get("label") == "fan1" and f1.get("rpm") == 2262 and f1.get("chip") == "thinkpad", f"got {f1!r}")
    check("unlabelled fan defaults label", f2.get("label") == "Fan 2" and f2.get("rpm") == 0 and f2.get("chip") == "thinkpad", f"got {f2!r}")

check("gpu answered (amd path)", doc.get("gpu") == 23, f"got {doc.get('gpu')!r}")
check("gpu_temp from amdgpu", doc.get("gpu_temp") == 61, f"got {doc.get('gpu_temp')!r}")

gd = doc.get("gpu_detail")
ok_gd = isinstance(gd, dict) and gd.get("vram_used_b") == 1073741824 and gd.get("vram_total_b") == 8589934592
watts = gd.get("watts") if isinstance(gd, dict) else None
ok_watts = isinstance(watts, (int, float)) and 44.0 <= watts <= 46.0
check("gpu_detail has vram", ok_gd, f"got {gd!r}")
check("gpu_detail has watts", ok_watts, f"got {gd!r}")

def num_or_null(v):
    return v is None or isinstance(v, (int, float))
check("clocks present-or-null", num_or_null(doc.get("cpu_mhz")) and num_or_null(doc.get("gpu_mhz")), f"got cpu_mhz={doc.get('cpu_mhz')!r} gpu_mhz={doc.get('gpu_mhz')!r}")
check("gpu_mhz from amdgpu freq", doc.get("gpu_mhz") == 1500, f"got {doc.get('gpu_mhz')!r}")

sys.exit(1 if failures else 0)
PYEOF

if ! python3 "$PY_ASSERT_MAIN" "$OUT_MAIN"; then
  fail "main fake-tree assertions failed (see FAIL lines above)"
fi

# --- empty tree: nulls but valid JSON with fans==[] -----------------------
if ! MONITOR_HWMON_ROOT="$EMPTY_ROOT" MONITOR_DRM_ROOT="$FAKE_DRM" "$SYSREAD" > "$OUT_EMPTY" 2>"$FAKE_ROOT.stderr-empty"; then
  cat "$FAKE_ROOT.stderr-empty" >&2
  fail "sysread one-shot exited non-zero against empty tree"
fi
if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$OUT_EMPTY"; then
  fail "empty-tree output is not valid JSON"
fi

PY_ASSERT_EMPTY="$FAKE_ROOT/assert_empty.py"
cat > "$PY_ASSERT_EMPTY" <<'PYEOF'
import json, sys

doc = json.load(open(sys.argv[1]))
failures = []

def check(name, cond, detail=""):
    if cond:
        print(f"PASS: {name}")
    else:
        print(f"FAIL: {name} ({detail})", file=sys.stderr)
        failures.append(name)

check("empty tree schema==1", doc.get("schema") == 1, f"got {doc.get('schema')!r}")
check("empty tree temp null", doc.get("temp") is None, f"got {doc.get('temp')!r}")
check("empty tree gpu null", doc.get("gpu") is None, f"got {doc.get('gpu')!r}")
check("empty tree gpu_temp null", doc.get("gpu_temp") is None, f"got {doc.get('gpu_temp')!r}")
check("empty tree fans==[]", doc.get("fans") == [], f"got {doc.get('fans')!r}")
check("empty tree gpu_detail null", doc.get("gpu_detail") is None, f"got {doc.get('gpu_detail')!r}")

sys.exit(1 if failures else 0)
PYEOF

if ! python3 "$PY_ASSERT_EMPTY" "$OUT_EMPTY"; then
  fail "empty-tree assertions failed (see FAIL lines above)"
fi

echo "ALL COLLECTOR TESTS PASSED"
