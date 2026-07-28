#!/usr/bin/env bash
# tests/T-004/contract-shield-smoke.sh
# Pre-written acceptance test for T-004. Do NOT modify this file.
#
# Verifies that contract-shield.sh:
#   (a) denies Edit/Write to protected paths
#   (b) denies Bash write-verbs targeting protected paths
#   (c) allows reads and unprotected writes
#   (d) allows everything when ARBOR_ROLE=architect
#
# Run: bash tests/T-004/contract-shield-smoke.sh
# Expected: exits 0 on success, exits 1 on any failure

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/.claude/hooks/contract-shield.sh"

if [[ ! -f "$SCRIPT" ]]; then
    echo "FAIL: contract-shield.sh not found at $SCRIPT" >&2
    exit 1
fi

if [[ ! -x "$SCRIPT" ]]; then
    echo "FAIL: contract-shield.sh is not executable" >&2
    exit 1
fi

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1" >&2; exit 1; }

# Send an Edit/Write tool event for the given path.
# Optional second arg: ARBOR_ROLE value (empty = not set).
# Returns "deny" when the hook emits a permissionDecision:deny JSON blob,
# "allow" when the hook produces no output (clean pass-through).
run_hook() {
    local file_path="$1"
    local role="${2:-}"
    local output
    output=$(ARBOR_ROLE="$role" bash "$SCRIPT" \
        <<< "{\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${file_path}\"}}" \
        2>/dev/null)
    if [[ -z "$output" ]]; then
        echo "allow"
    else
        echo "$output" | jq -r '.hookSpecificOutput.permissionDecision // "allow"' 2>/dev/null || echo "allow"
    fi
}

# Send a Bash tool event for the given command string.
# Optional second arg: ARBOR_ROLE value.
run_bash_hook() {
    local cmd="$1"
    local role="${2:-}"
    local json_cmd output
    json_cmd=$(printf '%s' "$cmd" | jq -Rs .)
    output=$(ARBOR_ROLE="$role" bash "$SCRIPT" \
        <<< "{\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":${json_cmd}}}" \
        2>/dev/null)
    if [[ -z "$output" ]]; then
        echo "allow"
    else
        echo "$output" | jq -r '.hookSpecificOutput.permissionDecision // "allow"' 2>/dev/null || echo "allow"
    fi
}

echo "Testing contract-shield.sh..."
echo ""
echo "── Edit/Write: protected paths must be denied ──────────────────────────"

RESULT=$(run_hook "contracts/schema.sql")
[[ "$RESULT" == "deny" ]] || fail "contracts/schema.sql should be denied, got: $RESULT"
pass "contracts/schema.sql → deny"

RESULT=$(run_hook "contracts/migrations/0001_init.sql")
[[ "$RESULT" == "deny" ]] || fail "contracts/migrations/0001_init.sql should be denied, got: $RESULT"
pass "contracts/migrations/0001_init.sql → deny"

RESULT=$(run_hook "contracts/pack.schema.json")
[[ "$RESULT" == "deny" ]] || fail "contracts/pack.schema.json should be denied, got: $RESULT"
pass "contracts/pack.schema.json → deny"

RESULT=$(run_hook "Arbor Spec/21 Contracts/C1 SQLite Schema.md")
[[ "$RESULT" == "deny" ]] || fail "Arbor Spec/21 Contracts/C1 SQLite Schema.md should be denied, got: $RESULT"
pass "Arbor Spec/21 Contracts/C1 SQLite Schema.md → deny"

RESULT=$(run_hook "tests/T-001/smoke.test.ts")
[[ "$RESULT" == "deny" ]] || fail "tests/T-001/smoke.test.ts should be denied, got: $RESULT"
pass "tests/T-001/smoke.test.ts → deny"

RESULT=$(run_hook "tests/T-003/pack-loader.test.ts")
[[ "$RESULT" == "deny" ]] || fail "tests/T-003/pack-loader.test.ts should be denied, got: $RESULT"
pass "tests/T-003/pack-loader.test.ts → deny"

echo ""
echo "── Edit/Write: unprotected paths must be allowed ───────────────────────"

RESULT=$(run_hook "src/api/pack-loader.ts")
[[ "$RESULT" == "allow" ]] || fail "src/api/pack-loader.ts should be allowed, got: $RESULT"
pass "src/api/pack-loader.ts → allow"

RESULT=$(run_hook "src-tauri/src/db/mod.rs")
[[ "$RESULT" == "allow" ]] || fail "src-tauri/src/db/mod.rs should be allowed, got: $RESULT"
pass "src-tauri/src/db/mod.rs → allow"

RESULT=$(run_hook "src/App.tsx")
[[ "$RESULT" == "allow" ]] || fail "src/App.tsx should be allowed, got: $RESULT"
pass "src/App.tsx → allow"

echo ""
echo "── Bash write-verb bypasses: all must be denied ────────────────────────"

RESULT=$(run_bash_hook 'echo "-- test" >> contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "echo >> contracts/ should be denied, got: $RESULT"
pass "bash: echo >> contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'cat > contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "cat > contracts/ should be denied, got: $RESULT"
pass "bash: cat > contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'sed -i.bak "1i -- test" contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "sed -i contracts/ should be denied, got: $RESULT"
pass "bash: sed -i contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'cp src/something.ts contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "cp to contracts/ should be denied, got: $RESULT"
pass "bash: cp src/... contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'mv tmp.sql contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "mv to contracts/ should be denied, got: $RESULT"
pass "bash: mv tmp.sql contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'tee contracts/schema.sql < /dev/stdin')
[[ "$RESULT" == "deny" ]] || fail "tee contracts/ should be denied, got: $RESULT"
pass "bash: tee contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'dd if=/dev/stdin of=contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "dd of=contracts/ should be denied, got: $RESULT"
pass "bash: dd of=contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'truncate -s 0 contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "truncate contracts/ should be denied, got: $RESULT"
pass "bash: truncate contracts/schema.sql → deny"

RESULT=$(run_bash_hook "python3 -c \"open('contracts/schema.sql','w').write('x')\"")
[[ "$RESULT" == "deny" ]] || fail "python3 -c open contracts/ should be denied, got: $RESULT"
pass "bash: python3 -c open('contracts/schema.sql','w') → deny"

RESULT=$(run_bash_hook 'git checkout -- contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "git checkout -- contracts/ should be denied, got: $RESULT"
pass "bash: git checkout -- contracts/schema.sql → deny"

RESULT=$(run_bash_hook 'git restore contracts/schema.sql')
[[ "$RESULT" == "deny" ]] || fail "git restore contracts/ should be denied, got: $RESULT"
pass "bash: git restore contracts/schema.sql → deny"

echo ""
echo "── Bash reads of protected paths must be allowed ───────────────────────"

RESULT=$(run_bash_hook 'cat contracts/schema.sql')
[[ "$RESULT" == "allow" ]] || fail "cat contracts/ (read) should be allowed, got: $RESULT"
pass "bash: cat contracts/schema.sql (read, no redirect) → allow"

RESULT=$(run_bash_hook 'diff contracts/schema.sql src-tauri/migrations/0001_init.sql')
[[ "$RESULT" == "allow" ]] || fail "diff contracts/ should be allowed, got: $RESULT"
pass "bash: diff contracts/schema.sql ... (read) → allow"

RESULT=$(run_bash_hook 'pnpm test')
[[ "$RESULT" == "allow" ]] || fail "pnpm test should be allowed, got: $RESULT"
pass "bash: pnpm test → allow"

RESULT=$(run_bash_hook 'cargo test --manifest-path src-tauri/Cargo.toml')
[[ "$RESULT" == "allow" ]] || fail "cargo test should be allowed, got: $RESULT"
pass "bash: cargo test → allow"

echo ""
echo "── ARBOR_ROLE=architect gate: all must be allowed ──────────────────────"

RESULT=$(run_hook "contracts/schema.sql" "architect")
[[ "$RESULT" == "allow" ]] || fail "contracts/schema.sql with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: Edit contracts/schema.sql → allow"

RESULT=$(run_hook "Arbor Spec/21 Contracts/C1 SQLite Schema.md" "architect")
[[ "$RESULT" == "allow" ]] || fail "Arbor Spec/21 Contracts/C1... with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: Edit Arbor Spec/21 Contracts/... → allow"

RESULT=$(run_bash_hook 'echo "-- comment" >> contracts/schema.sql' "architect")
[[ "$RESULT" == "allow" ]] || fail "bash write to contracts/ with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: bash echo >> contracts/schema.sql → allow"

echo ""
echo "All contract-shield smoke tests passed."
exit 0
