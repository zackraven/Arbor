#!/usr/bin/env bash
# spec-shield.sh — PreToolUse hook (settings.json, fires in ALL sessions).
# Blocks writes to Arbor Spec design notes 00–12 (the single source of truth).
# Only architect sessions (launched with ARBOR_ROLE=architect) may edit these notes.
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
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"spec-shield: jq not found -- failing closed to protect spec notes. Install jq to proceed."}}\n'
    exit 1
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

deny_spec() {
    local path="$1"
    jq -n --arg p "$path" '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: ("spec-shield: \"" + $p + "\" is a design note (00\u201312) \u2014 the single source of truth. Launch with ARBOR_ROLE=architect to edit. Implementers: write questions in the ticket ## Blocked section and end the session.")
        }
    }'
}

# Returns 0 (true) when the basename matches "NN <anything>.md" with NN in 00..12
is_spec_note() {
    local path="${1//\\//}"
    local base
    base=$(basename "$path")
    if [[ "$base" =~ ^([0-9]{2})\ .+\.md$ ]]; then
        local num=$(( 10#${BASH_REMATCH[1]} ))
        (( num >= 0 && num <= 12 ))
    else
        return 1
    fi
}

# ERE pattern: a spec note path inside Arbor Spec/ (notes 00–12)
SPEC_NOTE_RE='Arbor Spec/(0[0-9]|1[0-2]) '

# ── Edit / Write ──────────────────────────────────────────────────────────────

if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    if is_spec_note "$FILE_PATH"; then
        deny_spec "$FILE_PATH"
    fi

# ── Bash ──────────────────────────────────────────────────────────────────────
# Deny write verbs whose command string mentions a spec note path.

elif [[ "$TOOL_NAME" == "Bash" ]]; then
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

    # Only proceed if a spec note path appears in the command
    if echo "$CMD" | grep -qE "$SPEC_NOTE_RE"; then
        # Deny if any write verb is also present
        if echo "$CMD" | grep -qE '(>+[[:space:]]|[[:space:]]-i[[:space:]]|^\s*(cp|mv)[[:space:]]|\btee\b|\btruncate\b|git[[:space:]]+(checkout[[:space:]]+--|restore))'; then
            deny_spec "(bash command targeting spec note)"
        fi
    fi
fi

exit 0
