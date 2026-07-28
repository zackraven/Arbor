#!/usr/bin/env bash
# session-log.sh — Async hook on SessionStart and PostToolUse.
# Appends a JSONL entry to .claude/session-logs/<session_id>.jsonl.
#
# Loop-health fields (note 24):
#   is_test_run   — true when a Bash command invokes the test harness
#   ticket_status — new frontmatter status when a ticket file is written/edited
#
# Derived metrics (computed from the log at review time, not stored inline):
#   turns_used    — count of PostToolUse entries
#   test_run_count — count of entries where is_test_run=true
#   blocked        — any entry where ticket_status="blocked"
#   rework         — any entry where ticket_status="rework"

set -uo pipefail

INPUT=$(cat)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

LOG_DIR="$PROJECT_DIR/.claude/session-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${SESSION_ID}.jsonl"

# ── Loop-health: is_test_run ──────────────────────────────────────────────────
IS_TEST_RUN=false
if [[ "$TOOL_NAME" == "Bash" ]]; then
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
    if echo "$CMD" | grep -qE '(pnpm[[:space:]]+test|npm[[:space:]]+test|vitest|cargo[[:space:]]+test|pytest|jest)'; then
        IS_TEST_RUN=true
    fi
fi

# ── Loop-health: ticket_status ────────────────────────────────────────────────
TICKET_STATUS=""
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]] && \
   [[ "$FILE_PATH" == *"23 Tickets/"*".md" ]]; then
    # Extract status from new_string (Edit) or content (Write), first occurrence
    NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // ""')
    if [[ -n "$NEW_CONTENT" ]]; then
        STATUS_LINE=$(echo "$NEW_CONTENT" | grep -m1 '^status:' || true)
        if [[ -n "$STATUS_LINE" ]]; then
            TICKET_STATUS=$(echo "$STATUS_LINE" | sed 's/^status:[[:space:]]*//' | tr -d '[:space:]')
        fi
    fi
fi

# ── Emit JSONL entry ──────────────────────────────────────────────────────────
echo "$INPUT" | jq -c \
    --arg ts "$TIMESTAMP" \
    --arg event "$HOOK_EVENT" \
    --arg is_test_run "$IS_TEST_RUN" \
    --arg ticket_status "$TICKET_STATUS" \
    '{
        ts: $ts,
        event: $event,
        tool: (.tool_name // null),
        file: (.tool_input.file_path // .tool_input.command // null),
        session: .session_id,
        is_test_run: ($is_test_run == "true"),
        ticket_status: (if $ticket_status != "" then $ticket_status else null end)
    }' >> "$LOG_FILE" 2>/dev/null || true

exit 0
