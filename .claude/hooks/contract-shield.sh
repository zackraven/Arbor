#!/usr/bin/env bash
# contract-shield.sh — PreToolUse hook (settings.json, fires in ALL sessions).
# Blocks writes to:
#   • contracts/                        (schema, migrations, pack schema)
#   • Arbor Spec/21 Contracts/          (spec source of truth for contracts)
#   • tests/T-NNN/*.test.ts|*.rs|*.sh   (acceptance test files only — fixtures are writable)
#   • .claude/hooks/                    (self-protection)
#   • .claude/settings.json             (self-protection)
#   • .claude/agents/                   (self-protection)
#   • .claude/skills/                   (self-protection)
#
# NOTE: The test protection is intentionally narrow — it covers only the test-file
# extensions (.test.ts, .rs, .sh) directly inside tests/T-NNN/, NOT subdirectories
# such as tests/T-NNN/fixtures/. Fixture JSON/data files are implementer-writable.
#
# Only architect sessions (ARBOR_ROLE=architect) may bypass this shield.
#
# ARCHITECT GATE: ARBOR_ROLE=architect claude

set -uo pipefail

# Gate: architect sessions may bypass all shields
if [[ "${ARBOR_ROLE:-}" == "architect" ]]; then
    exit 0
fi

# Fail-closed: jq is required to parse hook input.
# If jq is absent, deny every operation rather than fail open.
if ! command -v jq &>/dev/null; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"contract-shield: jq not found -- failing closed to protect contracts. Install jq to proceed."}}\n'
    exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

deny_contract() {
    local path="$1"
    jq -n --arg p "$path" '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: ("contract-shield: \"" + $p + "\" is a protected file (contract, acceptance test, or hook). Launch with ARBOR_ROLE=architect to edit. Implementers: write questions in the ticket ## Blocked section and end the session.")
        }
    }'
}

# Normalize backslashes to forward slashes (Windows path compat)
norm() { echo "${1//\\//}"; }

# Returns 0 if the given path falls under a protected prefix.
# Handles both relative paths (contracts/foo) and absolute paths (/abs/contracts/foo).
is_protected_path() {
    local path
    path=$(norm "$1")
    # tests/ pattern: only top-level test files (*.test.ts, *.rs, *.sh) are protected.
    # Subdirectories (fixtures/, snapshots/, etc.) are NOT matched, so implementers
    # can write fixture data without a workaround.
    echo "$path" | grep -qE \
        '(^|/)contracts/|(^|/)Arbor Spec/21 Contracts/|(^|/)tests/T-[0-9]+/[^/]+\.(test\.ts|rs|sh)$|(^|/)\.claude/(hooks/|settings\.json$|agents/|skills/)'
}

# ── Edit / Write ──────────────────────────────────────────────────────────────

if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    if is_protected_path "$FILE_PATH"; then
        deny_contract "$FILE_PATH"
    fi

# ── Bash ──────────────────────────────────────────────────────────────────────
# Deny any Bash command that both mentions a protected path AND uses a write verb.
#
# Write verbs (12):
#   1.  >>  / >   redirection
#   2.  sed -i    in-place edit (handles -i.bak suffix too)
#   3.  cp        copy
#   4.  mv        move
#   5.  tee       tee write
#   6.  dd        dd of=
#   7.  truncate  truncate
#   8.  python open('w'/'a')
#   9.  git checkout --
#   10. git restore
#   11. mkdir     directory creation (catches mkdir -p under protected dirs)
#   (verbs 1–2 cover >> and > as two syntactic forms of the same mechanism)

elif [[ "$TOOL_NAME" == "Bash" ]]; then
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

    # Regex: a protected path segment appears anywhere in the command string.
    # The tests/ sub-pattern mirrors is_protected_path: only top-level test-file
    # extensions are protected; fixtures/ subdirs are not.
    PROTECTED_RE='(contracts/|Arbor Spec/21 Contracts/|tests/T-[0-9]+/[^/]*\.(test\.ts|rs|sh)|\.claude/(hooks|settings\.json|agents|skills))'

    if echo "$CMD" | grep -qE "$PROTECTED_RE"; then
        # Write verb regex covering 11 of 12 verbs (python open checked separately)
        WRITE_VERB_RE='(>>?[[:space:]]|[[:space:]]-i[[:space:].]|\b(cp|mv) |\btee\b|\btruncate\b|\bdd\b|\bmkdir\b|git[[:space:]]+(checkout[[:space:]]+--|restore\b))'
        if echo "$CMD" | grep -qE "$WRITE_VERB_RE"; then
            deny_contract "(bash command targeting protected path)"
        # 11th verb: python/python3 open() in write or append mode
        elif echo "$CMD" | grep -qE "open[[:space:]]*[(].*['\"]w['\"]"; then
            deny_contract "(bash command targeting protected path)"
        fi
    fi
fi

exit 0
