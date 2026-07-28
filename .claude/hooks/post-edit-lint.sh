#!/usr/bin/env bash
# post-edit-lint.sh — PostToolUse hook (Edit|Write).
# After every code edit: runs tsc --noEmit for TypeScript files, or
# cargo clippy for Rust files. Feeds failures back as a system message.
# Runs synchronously so the implementer sees errors immediately.

set -uo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
FILE_PATH="${FILE_PATH//\\//}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

ERRORS=""

if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]]; then
    # TypeScript type check (project-wide; tsc has no single-file mode)
    if [[ -f "$PROJECT_DIR/tsconfig.json" ]]; then
        ERRORS=$(cd "$PROJECT_DIR" && npx --yes tsc --noEmit 2>&1 || true)
    fi
elif [[ "$FILE_PATH" == *.rs ]]; then
    # Rust clippy
    if [[ -f "$PROJECT_DIR/src-tauri/Cargo.toml" ]]; then
        ERRORS=$(cd "$PROJECT_DIR/src-tauri" && cargo clippy -- -D warnings 2>&1 || true)
    fi
fi

if [[ -n "$ERRORS" ]]; then
    # Output as additionalContext so Claude sees the lint failures
    jq -n --arg ctx "$ERRORS" '{
        hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: ("post-edit-lint failures:\n" + $ctx)
        }
    }'
fi

exit 0
