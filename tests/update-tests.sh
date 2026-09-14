#!/usr/bin/env bash
# Update tests: a throwaway remote and its clone stand in for GitHub and
# the installed plugin; stubs stand in for the omarchy CLI and the shell
# restart.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE="$SCRIPT_DIR/../scripts/update"

pass() {
  echo "PASS: $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

[[ -x "$UPDATE" ]] || fail "update not found/executable at $UPDATE"
command -v git >/dev/null 2>&1 || fail "git is required"

WORK="$(mktemp -d /tmp/hardwarchy-update.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

quiet_git() {
  git -c user.name=test -c user.email=test@example.com -c init.defaultBranch=main "$@" >/dev/null 2>&1
}

set_version() {
  printf '{\n  "id": "io.github.tymurbogach.hardwarchy",\n  "version": "%s"\n}\n' "$2" > "$1/manifest.json"
}

# The remote carries a manifest and this very script; the plugin clones it.
mkdir -p "$WORK/remote/scripts"
cp "$UPDATE" "$WORK/remote/scripts/update"
set_version "$WORK/remote" "2.1.0"
quiet_git -C "$WORK/remote" init
quiet_git -C "$WORK/remote" add -A
quiet_git -C "$WORK/remote" commit -m "2.1.0"
quiet_git clone "$WORK/remote" "$WORK/plugin" || fail "cannot clone the test remote"
PLUGIN_UPDATE="$WORK/plugin/scripts/update"

[[ "$("$PLUGIN_UPDATE" check)" == "2.1.0" ]] || fail "check: expected the remote's 2.1.0"
pass "check prints the version on the remote's HEAD"

set_version "$WORK/remote" "2.2.0"
quiet_git -C "$WORK/remote" commit -am "2.2.0"
[[ "$("$PLUGIN_UPDATE" check)" == "2.2.0" ]] || fail "check: expected the new 2.2.0"
[[ "$(sed -n 's/.*"version": "\(.*\)".*/\1/p' "$WORK/plugin/manifest.json")" == "2.1.0" ]] \
  || fail "check: must not move the installed copy"
pass "check sees a newer version and leaves the installed copy alone"

mkdir -p "$WORK/copy/scripts"
cp "$UPDATE" "$WORK/copy/scripts/update"
set_version "$WORK/copy" "2.1.0"
out="$("$WORK/copy/scripts/update" check)" || fail "check: a plain copy must not fail"
[[ -z "$out" ]] || fail "check: a plain copy must print nothing, got: $out"
pass "check says nothing for a copy that is not a git clone"

quiet_git -C "$WORK/plugin" remote set-url origin "$WORK/nowhere"
if "$PLUGIN_UPDATE" check >/dev/null 2>&1; then
  fail "check: an unreachable remote must fail"
fi
quiet_git -C "$WORK/plugin" remote set-url origin "$WORK/remote"
pass "check fails when the remote cannot be reached"

# `omarchy plugin update <id>` fast-forwards the clone; the restart
# leaves a mark.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/omarchy" <<EOF
#!/usr/bin/env bash
[[ "\$*" == "plugin update io.github.tymurbogach.hardwarchy" ]] || exit 9
git -C "$WORK/plugin" pull --quiet --ff-only
EOF
cat > "$WORK/bin/omarchy-restart-shell" <<EOF
#!/usr/bin/env bash
touch "$WORK/restarted"
EOF
chmod +x "$WORK/bin/omarchy" "$WORK/bin/omarchy-restart-shell"

PATH="$WORK/bin:$PATH" "$PLUGIN_UPDATE" apply >/dev/null || fail "apply exited non-zero"
[[ -e "$WORK/restarted" ]] || fail "apply: expected a shell restart after the copy moved"
grep -q '"2.2.0"' "$WORK/plugin/manifest.json" || fail "apply: expected the copy at 2.2.0"
pass "apply updates through omarchy and restarts the shell"

rm -f "$WORK/restarted"
PATH="$WORK/bin:$PATH" "$PLUGIN_UPDATE" apply >/dev/null || fail "apply exited non-zero when up to date"
[[ ! -e "$WORK/restarted" ]] || fail "apply: nothing moved, so no restart"
pass "apply leaves the shell alone when nothing moved"

echo "ALL UPDATE TESTS PASSED"
