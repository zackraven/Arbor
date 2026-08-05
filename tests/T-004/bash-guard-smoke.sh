#!/usr/bin/env bash
# tests/T-004/bash-guard-smoke.sh
# Acceptance smoke test for bash-guard.sh.
# Do NOT modify this file.
#
# Verifies that bash-guard.sh:
#   (a) denies interpreter/tool invocations that bypass path-string analysis
#       (node, python, make, touch, bare bash/sh, non-test bash/sh)
#   (b) allows safe commands (pnpm, cargo, git, ls, mkdir, rmdir, ...)
#   (c) allows mkdir for fixture paths AND for test-file-pattern paths
#       (bash-guard is command-class only; path checks are contract-shield's job)
#   (d) allows everything when ARBOR_ROLE=architect
#   (e) denies all commands when jq is missing (fail-closed)
#
# ── Hook composition note ────────────────────────────────────────────────────
# bash-guard and contract-shield are complementary layers that must NOT
# duplicate each other's logic:
#
#   bash-guard    → command-class guard (denies dangerous interpreters regardless
#                   of their arguments, because runtime writes are invisible to
#                   path-string analysis)
#   contract-shield → path guard (denies write verbs, including mkdir, when the
#                   target path matches a protected pattern)
#
# For mkdir specifically:
#   mkdir -p tests/T-009/fixtures/foo → bash-guard: ALLOW; contract-shield: ALLOW
#   mkdir tests/T-009/x.test.ts       → bash-guard: ALLOW; contract-shield: DENY
#
# This file tests bash-guard in isolation. The contract-shield mkdir cases are
# covered by tests/T-004/contract-shield-smoke.sh (lines matching "mkdir").
#
# Run: bash tests/T-004/bash-guard-smoke.sh
# Expected: exits 0 on success, exits 1 on any failure

set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/../.." && pwd)/.claude/hooks/bash-guard.sh"

if [[ ! -f "$SCRIPT" ]]; then
    echo "FAIL: bash-guard.sh not found at $SCRIPT" >&2
    exit 1
fi

if [[ ! -x "$SCRIPT" ]]; then
    echo "FAIL: bash-guard.sh is not executable" >&2
    exit 1
fi

pass() { echo "  PASS: $1"; }
fail() { echo "  FAIL: $1" >&2; exit 1; }

# Send a Bash tool event for the given command string.
# Optional second arg: ARBOR_ROLE value (empty = not set).
# Returns "deny" when the hook emits permissionDecision:deny, "allow" otherwise.
run_guard() {
    local cmd="$1"
    local role="${2:-}"
    local json_cmd output
    json_cmd=$(printf '%s' "$cmd" | jq -Rs .)
    output=$(ARBOR_ROLE="$role" bash "$SCRIPT" \
        <<< "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":${json_cmd}}}" \
        2>/dev/null)
    if [[ -z "$output" ]]; then
        echo "allow"
    else
        echo "$output" | jq -r '.hookSpecificOutput.permissionDecision // "allow"' 2>/dev/null || echo "allow"
    fi
}

# Build a PATH that excludes every directory containing a jq executable.
_path_without_jq() {
    local result="" dir
    while IFS= read -r dir; do
        [[ -n "$dir" && -x "${dir}/jq" ]] || result="${result:+${result}:}${dir}"
    done < <(printf '%s' "$PATH" | tr ':' '\n')
    printf '%s' "$result"
}

# Run the guard with jq absent. Outputs two lines: exit code, then allow/deny.
run_guard_no_jq() {
    local cmd="$1"
    local json_cmd output exit_code
    json_cmd=$(printf '%s' "$cmd" | jq -Rs .)
    output=$(ARBOR_ROLE="" PATH="$(_path_without_jq)" bash "$SCRIPT" \
        <<< "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":${json_cmd}}}" \
        2>/dev/null) && exit_code=0 || exit_code=$?
    printf '%d\n' "$exit_code"
    if echo "$output" | grep -qE '"permissionDecision"[[:space:]]*:[[:space:]]*"deny"'; then
        echo "deny"
    else
        echo "allow"
    fi
}

echo "Testing bash-guard.sh..."
echo ""
echo "── Denied commands: interpreters and dangerous tools ────────────────────"

RESULT=$(run_guard 'node temp.mjs')
[[ "$RESULT" == "deny" ]] || fail "'node' should be denied, got: $RESULT"
pass "node temp.mjs → deny"

RESULT=$(run_guard 'nodejs script.js')
[[ "$RESULT" == "deny" ]] || fail "'nodejs' should be denied, got: $RESULT"
pass "nodejs script.js → deny"

RESULT=$(run_guard 'python3 -c "print(1)"')
[[ "$RESULT" == "deny" ]] || fail "'python3' should be denied, got: $RESULT"
pass "python3 -c ... → deny"

RESULT=$(run_guard 'python script.py')
[[ "$RESULT" == "deny" ]] || fail "'python' should be denied, got: $RESULT"
pass "python script.py → deny"

RESULT=$(run_guard 'make build')
[[ "$RESULT" == "deny" ]] || fail "'make' should be denied, got: $RESULT"
pass "make build → deny"

RESULT=$(run_guard 'touch src/new-file.ts')
[[ "$RESULT" == "deny" ]] || fail "'touch' should be denied, got: $RESULT"
pass "touch src/new-file.ts → deny"

RESULT=$(run_guard 'bash')
[[ "$RESULT" == "deny" ]] || fail "bare 'bash' (interactive) should be denied, got: $RESULT"
pass "bash (bare, interactive) → deny"

RESULT=$(run_guard 'sh')
[[ "$RESULT" == "deny" ]] || fail "bare 'sh' (interactive) should be denied, got: $RESULT"
pass "sh (bare, interactive) → deny"

RESULT=$(run_guard 'bash tools/some-script.sh')
[[ "$RESULT" == "deny" ]] || fail "'bash tools/...' (non-test) should be denied, got: $RESULT"
pass "bash tools/some-script.sh → deny (non-test script)"

RESULT=$(run_guard 'sh tools/setup.sh')
[[ "$RESULT" == "deny" ]] || fail "'sh tools/...' (non-test) should be denied, got: $RESULT"
pass "sh tools/setup.sh → deny (non-test script)"

echo ""
echo "── Compound commands: deny if any subcommand is forbidden ───────────────"

RESULT=$(run_guard 'pnpm build && node postprocess.mjs')
[[ "$RESULT" == "deny" ]] || fail "pnpm build && node ... should be denied (node in tail), got: $RESULT"
pass "pnpm build && node postprocess.mjs → deny (node in tail)"

RESULT=$(run_guard 'git status; python3 dump.py')
[[ "$RESULT" == "deny" ]] || fail "git status; python3 ... should be denied, got: $RESULT"
pass "git status; python3 dump.py → deny (python3 in tail)"

RESULT=$(run_guard 'MSYS_NO_PATHCONV=1 node temp.mjs')
[[ "$RESULT" == "deny" ]] || fail "env-prefixed 'node' should be denied, got: $RESULT"
pass "MSYS_NO_PATHCONV=1 node temp.mjs → deny (env-prefix stripped)"

echo ""
echo "── Allowed commands ─────────────────────────────────────────────────────"

RESULT=$(run_guard 'pnpm test')
[[ "$RESULT" == "allow" ]] || fail "pnpm test should be allowed, got: $RESULT"
pass "pnpm test → allow"

RESULT=$(run_guard 'pnpm lint')
[[ "$RESULT" == "allow" ]] || fail "pnpm lint should be allowed, got: $RESULT"
pass "pnpm lint → allow"

RESULT=$(run_guard 'cargo test --manifest-path src-tauri/Cargo.toml')
[[ "$RESULT" == "allow" ]] || fail "cargo test should be allowed, got: $RESULT"
pass "cargo test → allow"

RESULT=$(run_guard 'cargo clippy -- -D warnings')
[[ "$RESULT" == "allow" ]] || fail "cargo clippy should be allowed, got: $RESULT"
pass "cargo clippy → allow"

RESULT=$(run_guard 'git status')
[[ "$RESULT" == "allow" ]] || fail "git status should be allowed, got: $RESULT"
pass "git status → allow"

RESULT=$(run_guard 'git diff --name-only HEAD')
[[ "$RESULT" == "allow" ]] || fail "git diff should be allowed, got: $RESULT"
pass "git diff --name-only HEAD → allow"

RESULT=$(run_guard 'ls tests/T-003/fixtures/')
[[ "$RESULT" == "allow" ]] || fail "ls should be allowed, got: $RESULT"
pass "ls tests/T-003/fixtures/ → allow"

RESULT=$(run_guard 'jq . contracts/pack.schema.json')
[[ "$RESULT" == "allow" ]] || fail "jq (read) should be allowed, got: $RESULT"
pass "jq . contracts/pack.schema.json → allow (read-only)"

RESULT=$(run_guard 'bash tests/T-004/contract-shield-smoke.sh')
[[ "$RESULT" == "allow" ]] || fail "bash tests/T-004/... should be allowed (test script), got: $RESULT"
pass "bash tests/T-004/contract-shield-smoke.sh → allow (test script)"

RESULT=$(run_guard 'bash tests/T-003/pack-loader.test.ts')
# Note: this path is unusual (bash running a .ts) but bash-guard only checks the
# first non-env token (bash) and the second token (path starting with tests/T-).
[[ "$RESULT" == "allow" ]] || fail "bash tests/T-003/... should be allowed by bash-guard, got: $RESULT"
pass "bash tests/T-003/pack-loader.test.ts → allow (tests/T-* prefix)"

echo ""
echo "── mkdir both directions: bash-guard is command-class only ──────────────"
# bash-guard does NOT deny mkdir — path checking for mkdir is contract-shield's job.
# Both cases below must PASS bash-guard. The composition result differs:
#
#   mkdir -p tests/T-009/fixtures/foo  → bash-guard: ALLOW; contract-shield: ALLOW
#   mkdir tests/T-009/x.test.ts        → bash-guard: ALLOW; contract-shield: DENY
#
# The contract-shield DENY direction for mkdir is tested in contract-shield-smoke.sh.

RESULT=$(run_guard 'mkdir -p tests/T-009/fixtures/foo')
[[ "$RESULT" == "allow" ]] || fail "mkdir fixture dir should be allowed by bash-guard, got: $RESULT"
pass "mkdir -p tests/T-009/fixtures/foo → allow (bash-guard: command-class only)"

RESULT=$(run_guard 'mkdir tests/T-009/x.test.ts')
[[ "$RESULT" == "allow" ]] || fail "mkdir test-file-pattern path should be allowed by bash-guard (contract-shield denies it), got: $RESULT"
pass "mkdir tests/T-009/x.test.ts → allow (bash-guard: no path check; contract-shield will deny)"

RESULT=$(run_guard 'mkdir -p tests/T-003/fixtures/valid-pack')
[[ "$RESULT" == "allow" ]] || fail "mkdir fixture subdir should be allowed by bash-guard, got: $RESULT"
pass "mkdir -p tests/T-003/fixtures/valid-pack → allow (bash-guard)"

RESULT=$(run_guard 'rmdir tests/T-009/fixtures/empty-dir')
[[ "$RESULT" == "allow" ]] || fail "rmdir should be allowed by bash-guard, got: $RESULT"
pass "rmdir tests/T-009/fixtures/empty-dir → allow (bash-guard)"

echo ""
echo "── Denied commands: file-modifying git subcommands and patch ──────────"

RESULT=$(run_guard 'git apply foo.patch')
[[ "$RESULT" == "deny" ]] || fail "'git apply' should be denied, got: $RESULT"
pass "git apply foo.patch → deny"

RESULT=$(run_guard 'git am < mbox')
[[ "$RESULT" == "deny" ]] || fail "'git am' should be denied, got: $RESULT"
pass "git am < mbox → deny"

RESULT=$(run_guard 'git stash pop')
[[ "$RESULT" == "deny" ]] || fail "'git stash pop' should be denied, got: $RESULT"
pass "git stash pop → deny"

RESULT=$(run_guard 'git stash apply')
[[ "$RESULT" == "deny" ]] || fail "'git stash apply' should be denied, got: $RESULT"
pass "git stash apply → deny"

RESULT=$(run_guard 'patch -p1 < diff.patch')
[[ "$RESULT" == "deny" ]] || fail "'patch' should be denied, got: $RESULT"
pass "patch -p1 < diff.patch → deny"

RESULT=$(run_guard 'pnpm build && git apply fix.patch')
[[ "$RESULT" == "deny" ]] || fail "compound with 'git apply' in tail should be denied, got: $RESULT"
pass "pnpm build && git apply fix.patch → deny (compound, git apply in tail)"

echo ""
echo "── Allowed commands: safe git subcommands ─────────────────────────────"

RESULT=$(run_guard 'git stash')
[[ "$RESULT" == "allow" ]] || fail "'git stash' (bare) should be allowed, got: $RESULT"
pass "git stash → allow (stashing is safe)"

RESULT=$(run_guard 'git stash list')
[[ "$RESULT" == "allow" ]] || fail "'git stash list' should be allowed, got: $RESULT"
pass "git stash list → allow"

RESULT=$(run_guard 'git stash drop')
[[ "$RESULT" == "allow" ]] || fail "'git stash drop' should be allowed, got: $RESULT"
pass "git stash drop → allow"

RESULT=$(run_guard 'git log --oneline -5')
[[ "$RESULT" == "allow" ]] || fail "'git log' should be allowed, got: $RESULT"
pass "git log --oneline -5 → allow"

echo ""
echo "── ARBOR_ROLE=architect gate: git apply allowed for architect ─────────"

RESULT=$(run_guard 'git apply foo.patch' "architect")
[[ "$RESULT" == "allow" ]] || fail "'git apply' with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: git apply foo.patch → allow"

echo ""
echo "── ARBOR_ROLE=architect gate: all must be allowed ───────────────────────"

RESULT=$(run_guard 'node script.mjs' "architect")
[[ "$RESULT" == "allow" ]] || fail "node with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: node script.mjs → allow"

RESULT=$(run_guard 'python3 dump.py' "architect")
[[ "$RESULT" == "allow" ]] || fail "python3 with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: python3 dump.py → allow"

RESULT=$(run_guard 'bash tools/arch.sh' "architect")
[[ "$RESULT" == "allow" ]] || fail "bash tools/ with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: bash tools/arch.sh → allow"

RESULT=$(run_guard 'mkdir -p tests/T-009/x.test.ts' "architect")
[[ "$RESULT" == "allow" ]] || fail "mkdir with ARBOR_ROLE=architect should be allowed, got: $RESULT"
pass "ARBOR_ROLE=architect: mkdir -p tests/T-009/x.test.ts → allow"

echo ""
echo "── jq-missing path: fail-closed (must deny all) ─────────────────────────"

mapfile -t _out < <(run_guard_no_jq 'pnpm test')
NO_JQ_EXIT="${_out[0]:-1}"; RESULT="${_out[1]:-allow}"
[[ "$RESULT" == "deny" ]] || fail "jq-missing: pnpm test should be denied (fail-closed, any command), got: $RESULT"
[[ "$NO_JQ_EXIT" -eq 0 ]] || fail "jq-missing: hook must exit 0 (got $NO_JQ_EXIT) — exit 1 is non-blocking; Claude Code fails open"
pass "jq-missing: pnpm test → deny (fail-closed, exit 0)"

mapfile -t _out < <(run_guard_no_jq 'mkdir -p tests/T-009/fixtures/foo')
NO_JQ_EXIT="${_out[0]:-1}"; RESULT="${_out[1]:-allow}"
[[ "$RESULT" == "deny" ]] || fail "jq-missing: mkdir should be denied (fail-closed, any command), got: $RESULT"
[[ "$NO_JQ_EXIT" -eq 0 ]] || fail "jq-missing: hook must exit 0 (got $NO_JQ_EXIT)"
pass "jq-missing: mkdir -p tests/T-009/fixtures/foo → deny (fail-closed, exit 0)"

echo ""
echo "All bash-guard smoke tests passed."
exit 0
