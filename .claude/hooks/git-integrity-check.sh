#!/usr/bin/env bash
# git-integrity-check.sh — PreToolUse hook on Bash (git commit).
# Durable integrity layer: the last line of defence against shield bypasses.
#
# Before any commit in a non-architect session, this hook compares protected
# paths against HEAD. If any protected file is modified (staged or working-tree)
# the commit is blocked. This catches violations regardless of mechanism —
# runtime interpreter calls, manual writes, anything that evaded the
# Edit/Write/Bash shields at write time.
#
# Protected paths (mirrors contract-shield patterns):
#   contracts/
#   Arbor Spec/21 Contracts/
#   Arbor Spec/23 Tickets/*.md  (but NOT 23 Tickets/state/ — sidecars writable)
#   tests/T-NNN/*.test.ts|*.rs|*.sh  (acceptance test files; fixtures NOT included)
#   .claude/hooks/  .claude/settings.json  .claude/agents/  .claude/skills/
#
# Checks both staged (--cached) and unstaged working-tree modifications.
# Staged:   files that would be included in the commit.
# Unstaged: files modified in the working tree but not staged — a sign that
#           protected files were written during the session, even if the
#           implementer chose not to stage them.
#
# ARBOR_ROLE=architect bypasses. Fires only on git commit commands.
# Verifier role: run this check first (or attempt a git commit) before
# doing any other work; a non-empty diff here means a session violated the shields.

set -uo pipefail

# Gate: architect sessions bypass
if [[ "${ARBOR_ROLE:-}" == "architect" ]]; then
    exit 0
fi

# Fail-closed: jq required
if ! command -v jq &>/dev/null; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"git-integrity-check: jq not found -- failing closed."}}\n'
    exit 0
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only fire on git commit commands
if ! echo "$COMMAND" | grep -qE 'git[[:space:]]+commit'; then
    exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

deny_integrity() {
    local path="$1"
    local source="$2"   # "staged" or "unstaged"
    jq -n --arg p "$path" --arg s "$source" '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: ("git-integrity-check: protected file \"" + $p + "\" has been modified (" + $s + ") in a non-architect session. This indicates a shield bypass occurred. STOP — do not commit. Record what happened under ## Blocked in the ticket (which file was modified, how it was written), set status: blocked, and end the session without committing. Architect review required.")
        }
    }'
    exit 0
}

# Normalize backslashes to forward slashes (Windows path compat)
norm() { echo "${1//\\//}"; }

is_protected_file() {
    local file
    file=$(norm "$1")
    # Ticket state sidecars are NOT protected (writable by all roles)
    if echo "$file" | grep -qE '(^|/)Arbor Spec/23 Tickets/state/'; then
        return 1
    fi
    echo "$file" | grep -qE \
        '(^|/)contracts/|(^|/)Arbor Spec/21 Contracts/|(^|/)Arbor Spec/23 Tickets/|(^|/)tests/T-[0-9]+/[^/]+\.(test\.ts|rs|sh)$|(^|/)\.claude/(hooks/|settings\.json$|agents/|skills/)'
}

# Collect staged changes (files that will enter the commit)
STAGED=$(git -C "$PROJECT_DIR" diff --name-only --cached 2>/dev/null || true)

# Collect unstaged working-tree modifications (files changed but not staged)
UNSTAGED=$(git -C "$PROJECT_DIR" diff --name-only 2>/dev/null || true)

while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if is_protected_file "$file"; then
        deny_integrity "$file" "staged"
    fi
done <<< "$STAGED"

while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if is_protected_file "$file"; then
        deny_integrity "$file" "unstaged — modified in working tree but not staged; still a violation"
    fi
done <<< "$UNSTAGED"

exit 0
