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
echo "── jq-missing path: fail-closed (must deny) ────────────────────────────"

# Build a PATH that excludes every directory containing a jq executable.
# This simulates jq not being installed without touching the real system.
_path_without_jq() {
    local result="" dir
    while IFS= read -r dir; do
        [[ -n "$dir" && -x "${dir}/jq" ]] || result="${result:+${result}:}${dir}"
    done < <(printf '%s' "$PATH" | tr ':' '\n')
    printf '%s' "$result"
}

# Run the hook with jq removed from PATH; parse output with grep (not jq).
# Outputs two lines: the hook's exit code, then "deny" or "allow".
# A deny is only effective when exit 0 (Claude Code only processes JSON on exit 0;
# exit 1 is non-blocking and causes the tool call to proceed — fails open).
# ARBOR_ROLE is explicitly cleared so the architect gate does not bypass the check.
run_hook_no_jq() {
    local file_path="$1"
    local output exit_code
    # || captures non-zero exit without triggering set -e
    output=$(ARBOR_ROLE="" PATH="$(_path_without_jq)" bash "$SCRIPT" \
        <<< "{\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"${file_path}\"}}" \
        2>/dev/null) && exit_code=0 || exit_code=$?
    printf '%d\n' "$exit_code"
    if echo "$output" | grep -qE '"permissionDecision"[[:space:]]*:[[:space:]]*"deny"'; then
        echo "deny"
    else
        echo "allow"
    fi
}

# Protected path: must be denied (fail-closed).
mapfile -t _out < <(run_hook_no_jq "contracts/schema.sql")
NO_JQ_EXIT="${_out[0]:-1}"; RESULT="${_out[1]:-allow}"
[[ "$RESULT" == "deny" ]] || fail "jq-missing + contracts/schema.sql should be denied (fail-closed), got: $RESULT"
[[ "$NO_JQ_EXIT" -eq 0 ]] || fail "jq-missing + contracts/schema.sql: hook must exit 0 (got $NO_JQ_EXIT) — exit 1 is non-blocking; Claude Code ignores JSON and fails open"
pass "jq-missing: Edit contracts/schema.sql → deny (fail-closed, exit 0)"

# Unprotected path: must also be denied when jq is missing (fail-closed, not path-aware).
mapfile -t _out < <(run_hook_no_jq "src/App.tsx")
NO_JQ_EXIT="${_out[0]:-1}"; RESULT="${_out[1]:-allow}"
[[ "$RESULT" == "deny" ]] || fail "jq-missing + src/App.tsx should be denied (fail-closed, any path), got: $RESULT"
[[ "$NO_JQ_EXIT" -eq 0 ]] || fail "jq-missing + src/App.tsx: hook must exit 0 (got $NO_JQ_EXIT) — exit 1 is non-blocking; Claude Code ignores JSON and fails open"
pass "jq-missing: Edit src/App.tsx → deny (fail-closed, any path, exit 0)"

echo ""
echo "── Allow-list bypass: shield must deny regardless of permissions.allow ───"
# settings.json permissions.allow includes Edit(**) and Write(**), which suppress
# the interactive prompt for all file paths. PreToolUse hooks fire independently
# of the permission allow-list — they run before permission checks and cannot be
# bypassed by allow-list entries. The shield must block protected writes even when
# the allow-list would otherwise permit them without prompting.

RESULT=$(run_hook "contracts/schema.sql")
[[ "$RESULT" == "deny" ]] || fail "contracts/schema.sql must be denied even though Edit(**) is in permissions.allow, got: $RESULT"
pass "allow-list bypass: Edit(**) in permissions.allow does not bypass shield for contracts/schema.sql"

RESULT=$(run_hook "Arbor Spec/21 Contracts/C1 SQLite Schema.md")
[[ "$RESULT" == "deny" ]] || fail "Arbor Spec/21 Contracts/... must be denied even though Edit(**) is in permissions.allow, got: $RESULT"
pass "allow-list bypass: Edit(**) in permissions.allow does not bypass shield for Arbor Spec/21 Contracts/..."

RESULT=$(run_hook "tests/T-001/smoke.test.ts")
[[ "$RESULT" == "deny" ]] || fail "tests/T-001/smoke.test.ts must be denied even though Edit(**) is in permissions.allow, got: $RESULT"
pass "allow-list bypass: Edit(**) in permissions.allow does not bypass shield for tests/T-001/smoke.test.ts"

echo ""
echo "── Narrowed test pattern: fixtures allow / test files deny (both directions) ──"
# The test-file pattern was narrowed from tests/T-*/ (entire directory) to
# tests/T-NNN/*.test.ts|*.rs|*.sh (top-level test files only).
# Fixtures in subdirs (tests/T-NNN/fixtures/**) are now implementer-writable.

# Fixture files must be ALLOWED
RESULT=$(run_hook "tests/T-003/fixtures/valid-pack/pack.json")
[[ "$RESULT" == "allow" ]] || fail "tests/T-003/fixtures/valid-pack/pack.json should be allowed (fixture, not a test file), got: $RESULT"
pass "tests/T-003/fixtures/valid-pack/pack.json → allow (fixture)"

RESULT=$(run_hook "tests/T-003/fixtures/invalid-pack/pack.json")
[[ "$RESULT" == "allow" ]] || fail "tests/T-003/fixtures/invalid-pack/pack.json should be allowed (fixture, not a test file), got: $RESULT"
pass "tests/T-003/fixtures/invalid-pack/pack.json → allow (fixture)"

RESULT=$(run_hook "tests/T-003/fixtures/some-dir/nested.json")
[[ "$RESULT" == "allow" ]] || fail "tests/T-003/fixtures/some-dir/nested.json should be allowed (nested fixture), got: $RESULT"
pass "tests/T-003/fixtures/some-dir/nested.json → allow (nested fixture)"

# Actual test files (*.test.ts, *.sh) must still be DENIED
RESULT=$(run_hook "tests/T-004/contract-shield-smoke.sh")
[[ "$RESULT" == "deny" ]] || fail "tests/T-004/contract-shield-smoke.sh should be denied (test script), got: $RESULT"
pass "tests/T-004/contract-shield-smoke.sh → deny (test script)"

# Bash: redirect to fixture path must be ALLOWED
RESULT=$(run_bash_hook 'echo "{}" > tests/T-003/fixtures/valid-pack/pack.json')
[[ "$RESULT" == "allow" ]] || fail "bash echo > tests/T-003/fixtures/... should be allowed (fixture path), got: $RESULT"
pass "bash: echo > tests/T-003/fixtures/valid-pack/pack.json → allow (fixture path)"

# Bash: write-verb targeting test file must be DENIED
RESULT=$(run_bash_hook 'sed -i "s/x/y/" tests/T-003/pack-loader.test.ts')
[[ "$RESULT" == "deny" ]] || fail "bash sed -i tests/T-003/pack-loader.test.ts should be denied (test file), got: $RESULT"
pass "bash: sed -i tests/T-003/pack-loader.test.ts → deny (test file)"

# Bash: mkdir targeting test file path must be DENIED (mkdir is now a write verb)
RESULT=$(run_bash_hook 'mkdir tests/T-003/pack-loader.test.ts')
[[ "$RESULT" == "deny" ]] || fail "bash mkdir tests/T-003/pack-loader.test.ts should be denied, got: $RESULT"
pass "bash: mkdir tests/T-003/pack-loader.test.ts → deny (mkdir + test file pattern)"

# Bash: mkdir for a fixture dir must be ALLOWED (fixture path — pattern not matched)
RESULT=$(run_bash_hook 'mkdir -p tests/T-003/fixtures/valid-pack')
[[ "$RESULT" == "allow" ]] || fail "bash mkdir -p tests/T-003/fixtures/valid-pack should be allowed (fixture dir), got: $RESULT"
pass "bash: mkdir -p tests/T-003/fixtures/valid-pack → allow (fixture dir, not a test file path)"

echo ""
echo "── .claude/ self-protection: protected paths must be denied ─────────────"
# contract-shield.sh explicitly lists .claude/hooks/, .claude/settings.json,
# .claude/agents/, and .claude/skills/ as self-protection targets.
# These were verified in ad-hoc probes but were absent from this enumerated suite,
# so a regex refactor could silently drop them. Added 2026-08-02.

RESULT=$(run_hook ".claude/settings.json")
[[ "$RESULT" == "deny" ]] || fail ".claude/settings.json should be denied (self-protection), got: $RESULT"
pass ".claude/settings.json → deny"

RESULT=$(run_hook ".claude/hooks/contract-shield.sh")
[[ "$RESULT" == "deny" ]] || fail ".claude/hooks/contract-shield.sh should be denied (self-protection), got: $RESULT"
pass ".claude/hooks/contract-shield.sh → deny"

RESULT=$(run_hook ".claude/agents/implementer.md")
[[ "$RESULT" == "deny" ]] || fail ".claude/agents/implementer.md should be denied (self-protection), got: $RESULT"
pass ".claude/agents/implementer.md → deny"

RESULT=$(run_hook ".claude/skills/write-ticket/SKILL.md")
[[ "$RESULT" == "deny" ]] || fail ".claude/skills/write-ticket/SKILL.md should be denied (self-protection), got: $RESULT"
pass ".claude/skills/write-ticket/SKILL.md → deny"

RESULT=$(run_bash_hook 'echo "# tamper" >> .claude/hooks/contract-shield.sh')
[[ "$RESULT" == "deny" ]] || fail "bash echo >> .claude/hooks/ should be denied (self-protection), got: $RESULT"
pass "bash: echo >> .claude/hooks/contract-shield.sh → deny"

RESULT=$(run_hook ".claude/settings.json" "architect")
[[ "$RESULT" == "allow" ]] || fail ".claude/settings.json with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: Edit .claude/settings.json → allow"

echo ""
echo "All contract-shield smoke tests passed."
exit 0
