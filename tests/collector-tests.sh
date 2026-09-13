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

# --- fake /proc/net/dev: only eth0 should win (lo/docker0/veth excluded) --
FAKE_NET_DEV="$FAKE_ROOT.net-dev"
cat > "$FAKE_NET_DEV" <<'NETEOF'
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo:    1000      10    0    0    0     0          0         0     1000      10    0    0    0     0       0          0
docker0:    5000      50    0    0    0     0          0         0     6000      60    0    0    0     0       0          0
veth123:    7000      70    0    0    0     0          0         0     8000      80    0    0    0     0       0          0
   eth0:  900000     900    0    0    0     0          0         0   100000     100    0    0    0     0       0          0
NETEOF

# --- fake /proc/diskstats: only the whole disk "sda" should be counted ----
FAKE_DISKSTATS="$FAKE_ROOT.diskstats"
cat > "$FAKE_DISKSTATS" <<'DISKEOF'
   8       0 sda 100 0 5000 10 200 0 6000 20 0 0 0 0 0 0 0
   8       1 sda1 50 0 2000 5 100 0 3000 10 0 0 0 0 0 0 0
   7       0 loop0 10 0 500 1 5 0 500 1 0 0 0 0 0 0 0
 253       0 dm-0 20 0 800 2 10 0 900 3 0 0 0 0 0 0 0
DISKEOF

# --- fake /proc/mounts: real filesystems only, one mount per device -------
FAKE_MOUNTS="$FAKE_ROOT.mounts"
cat > "$FAKE_MOUNTS" <<'MOUNTEOF'
proc /proc proc rw 0 0
/dev/mapper/root / btrfs rw 0 0
tmpfs /tmp tmpfs rw 0 0
/dev/mapper/root /home btrfs rw 0 0
/dev/nvme0n1p1 /boot vfat rw 0 0
/dev/sdb1 /mnt/my\040disk ext4 rw 0 0
MOUNTEOF

# --- run one-shot against the fake tree -----------------------------------
if ! MONITOR_HWMON_ROOT="$FAKE_ROOT" MONITOR_DRM_ROOT="$FAKE_DRM" \
    MONITOR_NET_DEV_FILE="$FAKE_NET_DEV" MONITOR_DISKSTATS_PATH="$FAKE_DISKSTATS" \
    MONITOR_ROOT_MOUNT="$FAKE_ROOT" MONITOR_MOUNTS_FILE="$FAKE_MOUNTS" \
    "$SYSREAD" > "$OUT_MAIN" 2>"$FAKE_ROOT.stderr"; then
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

check("schema==2", doc.get("schema") == 2, f"got {doc.get('schema')!r}")
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

net = doc.get("net")
ok_net = isinstance(net, dict) and net.get("iface") == "eth0"
check("net picks the busiest real interface, not lo/docker/veth", ok_net, f"got {net!r}")
if ok_net:
    # One-shot priming reads the same static fixture twice with nothing
    # changing in between, so the delta -- and therefore the rate -- is
    # deterministically zero rather than null.
    check("net rate is a real zero, not still priming", net.get("down_bps") == 0 and net.get("up_bps") == 0, f"got {net!r}")

disk = doc.get("disk")
ok_disk = isinstance(disk, dict) and disk.get("mount") == sys.argv[2]
check("disk reports the configured mount", ok_disk, f"got {disk!r}")
if ok_disk:
    used_pct = disk.get("used_pct")
    check("disk used_pct is a real percentage (can't fake statvfs, so range-check only)",
          isinstance(used_pct, int) and 0 <= used_pct <= 100, f"got {used_pct!r}")
    check("disk I/O only counts the whole disk (sda), not sda1/loop0/dm-0",
          disk.get("read_bps") == 0 and disk.get("write_bps") == 0, f"got {disk!r}")
    used_b, total_b = disk.get("used_b"), disk.get("total_b")
    check("disk reports used and total bytes", isinstance(used_b, int) and isinstance(total_b, int) and 0 <= used_b <= total_b,
          f"got used_b={used_b!r} total_b={total_b!r}")
    check("disk lists real mounts, one per device, spaces decoded",
          disk.get("mounts") == ["/", "/boot", "/mnt/my disk"], f"got {disk.get('mounts')!r}")

check("gpu_source is the one that answered", doc.get("gpu_source") == "amd", f"got {doc.get('gpu_source')!r}")
check("gpu_sources lists every answering source", doc.get("gpu_sources") == ["amd"], f"got {doc.get('gpu_sources')!r}")
if ok_net:
    check("net lists the real interfaces only", net.get("ifaces") == ["eth0"], f"got {net.get('ifaces')!r}")

sys.exit(1 if failures else 0)
PYEOF

if ! python3 "$PY_ASSERT_MAIN" "$OUT_MAIN" "$FAKE_ROOT"; then
  fail "main fake-tree assertions failed (see FAIL lines above)"
fi

# --- empty tree: nulls but valid JSON with fans==[] -----------------------
if ! MONITOR_HWMON_ROOT="$EMPTY_ROOT" MONITOR_DRM_ROOT="$FAKE_DRM" \
    MONITOR_NET_DEV_FILE="$EMPTY_ROOT/no-such-net-dev" \
    MONITOR_DISKSTATS_PATH="$EMPTY_ROOT/no-such-diskstats" \
    MONITOR_ROOT_MOUNT="$EMPTY_ROOT" \
    "$SYSREAD" > "$OUT_EMPTY" 2>"$FAKE_ROOT.stderr-empty"; then
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

check("empty tree schema==2", doc.get("schema") == 2, f"got {doc.get('schema')!r}")
check("empty tree temp null", doc.get("temp") is None, f"got {doc.get('temp')!r}")
check("empty tree gpu null", doc.get("gpu") is None, f"got {doc.get('gpu')!r}")
check("empty tree gpu_temp null", doc.get("gpu_temp") is None, f"got {doc.get('gpu_temp')!r}")
check("empty tree fans==[]", doc.get("fans") == [], f"got {doc.get('fans')!r}")
check("empty tree net null (no readable /proc/net/dev)", doc.get("net") is None, f"got {doc.get('net')!r}")
empty_disk = doc.get("disk")
ok_empty_disk = isinstance(empty_disk, dict) and empty_disk.get("read_bps") is None and empty_disk.get("write_bps") is None
check("empty tree disk I/O null (no readable diskstats), usage still answers", ok_empty_disk, f"got {empty_disk!r}")
check("empty tree gpu_detail null", doc.get("gpu_detail") is None, f"got {doc.get('gpu_detail')!r}")

sys.exit(1 if failures else 0)
PYEOF

if ! python3 "$PY_ASSERT_EMPTY" "$OUT_EMPTY"; then
  fail "empty-tree assertions failed (see FAIL lines above)"
fi

# --- choices from the widget: interface, GPU source, mount ---------------
FAKE_NET_DEV2="$FAKE_ROOT.net-dev2"
cat > "$FAKE_NET_DEV2" <<'NETEOF'
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo:    1000      10    0    0    0     0          0         0     1000      10    0    0    0     0       0          0
   eth0:  900000     900    0    0    0     0          0         0   100000     100    0    0    0     0       0          0
  wlan0:    5000      50    0    0    0     0          0         0     5000      50    0    0    0     0       0          0
NETEOF
FAKE_DRM2="$FAKE_DRM/with-intel"
mkdir -p "$FAKE_DRM2/card0/engine/rcs0"
printf '1000\n' > "$FAKE_DRM2/card0/engine/rcs0/busy_time"

run_choice() {
  MONITOR_HWMON_ROOT="$FAKE_ROOT" MONITOR_DRM_ROOT="$FAKE_DRM2" \
    MONITOR_NET_DEV_FILE="$FAKE_NET_DEV2" MONITOR_DISKSTATS_PATH="$FAKE_DISKSTATS" \
    MONITOR_MOUNTS_FILE="$FAKE_MOUNTS" "$@" "$SYSREAD"
}

PY_FIELD="$FAKE_ROOT/field.py"
cat > "$PY_FIELD" <<'PYEOF'
import json, sys
doc = json.loads(sys.stdin.read())
for path in sys.argv[1:]:
    v = doc
    for k in path.split("."):
        v = v.get(k) if isinstance(v, dict) else None
    print(json.dumps(v))
PYEOF

chosen="$(run_choice env MONITOR_NET_IFACE=wlan0 MONITOR_GPU=intel MONITOR_ROOT_MOUNT=/no/such/mount \
  | python3 "$PY_FIELD" net.iface net.ifaces gpu_source gpu_sources disk.mount | tr '\n' ' ')"
[[ "$chosen" == '"wlan0" ["eth0", "wlan0"] "intel" ["amd", "intel"] "/" ' ]] \
  || fail "widget choices: expected wlan0/intel and a / fallback, got: $chosen"
pass "the collector reads the interface, GPU and mount the widget chose (a gone mount falls back to /)"

fallback="$(run_choice env MONITOR_NET_IFACE=nope MONITOR_GPU=nvidia \
  | python3 "$PY_FIELD" net.iface gpu_source | tr '\n' ' ')"
[[ "$fallback" == '"eth0" "amd" ' ]] \
  || fail "unknown choices: expected the automatic eth0/amd picks, got: $fallback"
pass "an interface or GPU the machine lacks falls back to the automatic pick"

# --- only what the widget asks for --------------------------------------
only="$(run_choice env MONITOR_READ=temp,fans \
  | python3 "$PY_FIELD" cpu mem load gpu net disk | tr '\n' ' ')"
[[ "$only" == 'null null null null null null ' ]] \
  || fail "MONITOR_READ=temp,fans: expected every other reading null, got: $only"
asked="$(run_choice env MONITOR_READ=temp,fans | python3 "$PY_FIELD" temp fans | tr '\n' ' ')"
[[ "$asked" != null* && "$asked" != *' [] ' ]] \
  || fail "MONITOR_READ=temp,fans: expected a temp and the fans, got: $asked"
pass "MONITOR_READ reads the providers it names and nothing else"

none="$(run_choice env MONITOR_READ=none | python3 "$PY_FIELD" temp fans gpu disk gpu_source | tr '\n' ' ')"
[[ "$none" == 'null [] null null "amd" ' ]] \
  || fail "MONITOR_READ=none: expected no reading but the startup GPU pick, got: $none"
pass "MONITOR_READ=none reads nothing"

echo "ALL COLLECTOR TESTS PASSED"
