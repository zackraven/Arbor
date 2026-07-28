#!/usr/bin/env bash
# commit-gate.sh — PreToolUse hook on Bash (git commit).
# Blocks git commit unless the ticket referenced in the commit message
# has status: implemented or status: done.
# Format: "T-NNN: short description"

set -uo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TICKETS_DIR="$PROJECT_DIR/Arbor Spec/23 Tickets"

# Only act on git commit commands
if ! echo "$COMMAND" | grep -qE 'git\s+commit'; then
    exit 0
fi

# Extract ticket ID (T-NNN) from the commit message
TICKET_ID=$(echo "$COMMAND" | grep -oE 'T-[0-9]+' | head -1)

if [[ -z "$TICKET_ID" ]]; then
    # No ticket reference — warn but allow (architect metadata commits have no ticket)
    jq -n '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            additionalContext: "commit-gate: no ticket ID (T-NNN) found in commit message. If this is a ticket commit, include the ID. Proceeding."
        }
    }'
    exit 0
fi

# Find the ticket file
TICKET_FILE=$(find "$TICKETS_DIR" -maxdepth 1 -name "${TICKET_ID} *.md" 2>/dev/null | head -1)

if [[ -z "$TICKET_FILE" ]]; then
    jq -n --arg tid "$TICKET_ID" '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            additionalContext: ("commit-gate: ticket file for " + $tid + " not found in 23 Tickets/. Check the ticket ID.")
        }
    }'
    exit 0
fi

# Parse frontmatter status
STATUS=$(grep -m1 '^status:' "$TICKET_FILE" | sed 's/^status:[[:space:]]*//' | sed 's/[[:space:]]*#.*//' | tr -d '[:space:]')

if [[ "$STATUS" == "implemented" ]] || [[ "$STATUS" == "done" ]]; then
    exit 0  # allow
fi

jq -n --arg tid "$TICKET_ID" --arg st "$STATUS" '{
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: ("commit-gate: " + $tid + " has status \"" + $st + "\". Commit blocked. Required: status: implemented (after implementation) or status: done (after verifier pass).")
    }
}'

exit 0
