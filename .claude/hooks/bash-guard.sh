#!/usr/bin/env bash
# bash-guard.sh — PreToolUse hook (settings.json, fires in ALL sessions).
# Allowlist-based Bash guard: denies interpreter and tool invocations that can
# bypass the contract-shield's path-string analysis by hiding file writes inside
# a runtime call (e.g. `node script.js` where the script calls fs.writeFileSync).
#
# The contract-shield analyses the command STRING visible to Claude Code.
# This hook closes the complementary gap: it denies the command CLASS regardless
# of what arguments are passed.
#
# ── Denied commands (any position in a compound expression) ──────────────────
#   node, nodejs        — can write arbitrary files via fs module
#   python, python3     — can write arbitrary files
#   make                — runs Makefile targets with unconstrained side-effects
#   mkdir, rmdir        — directory creation/removal (use Write tool or build tools)
#   touch               — file creation
#   sh <non-test>       — arbitrary shell script execution
#   bash <non-test>     — arbitrary shell script execution
#   (bare bash/sh with no argument is also denied — interactive shell)
#
# ── Allowed commands ─────────────────────────────────────────────────────────
#   pnpm, cargo, git, ls, cat, grep, diff, find, head, tail, wc, sort, uniq,
#   jq, echo, awk, sed, tsc, npx (tsc only via post-edit-lint), which, command,
#   bash tests/T-*, bash tests/T-*/...  (running acceptance-test scripts)
#
# ── Positive-permission note ─────────────────────────────────────────────────
# Claude Code's permissions.allow/deny model does NOT support default-deny for
# Bash: unmatched commands prompt the user rather than being denied outright.
# Hook-based enforcement (this file) is the correct layer for active denial.
# The permissions.allow entries in settings.json suppress the interactive prompt
# for known-safe commands; this hook performs the actual enforcement.
#
# Only architect sessions (ARBOR_ROLE=architect) bypass this guard.
# ARCHITECT GATE: ARBOR_ROLE=architect claude

set -uo pipefail

# Gate: architect sessions bypass
if [[ "${ARBOR_ROLE:-}" == "architect" ]]; then
    exit 0
fi

# Fail-closed: jq required to parse hook input.
if ! command -v jq &>/dev/null; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"bash-guard: jq not found -- failing closed. Install jq to proceed."}}\n'
    exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only act on Bash tool calls
if [[ "$TOOL_NAME" != "Bash" ]]; then
    exit 0
fi

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

deny_bash() {
    local reason="$1"
    jq -n --arg r "$reason" '{
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: $r
        }
    }'
    exit 0
}

# Split compound commands on shell metacharacters (&&, ||, ;, |, &) and check
# each subcommand independently. This catches bypasses of the form:
#   pnpm build && node postprocess.js
# where only the second subcommand is problematic.
while IFS= read -r part; do
    # Strip leading whitespace
    part=$(echo "$part" | sed 's/^[[:space:]]*//')
    [[ -z "$part" ]] && continue

    # Find the first non-env-assignment token (handles MSYS_NO_PATHCONV=1 node ...)
    first=$(echo "$part" | awk '{
        for (i = 1; i <= NF; i++) {
            if ($i !~ /^[A-Za-z_][A-Za-z0-9_]*=/) { print $i; exit }
        }
    }')
    [[ -z "$first" ]] && continue

    case "$first" in
        node|nodejs)
            deny_bash "bash-guard: 'node' is not permitted in implementer/verifier sessions. Node can write files at runtime without protected paths appearing in the command string. Use 'pnpm' scripts for any build or run steps. HOOK DENY = FULL STOP — write the situation under ## Blocked in the ticket and end the session."
            ;;
        python|python3)
            deny_bash "bash-guard: 'python'/'python3' is not permitted in implementer/verifier sessions. Use 'pnpm' or 'cargo' equivalents. HOOK DENY = FULL STOP — write under ## Blocked and end the session."
            ;;
        make)
            deny_bash "bash-guard: 'make' is not permitted in implementer/verifier sessions. Use 'pnpm' or 'cargo' equivalents."
            ;;
        mkdir|rmdir)
            deny_bash "bash-guard: 'mkdir'/'rmdir' is not permitted in implementer/verifier sessions. Directories are created implicitly by the Write tool and build tools. If a directory is needed that no tool creates, STOP — write it under ## Blocked."
            ;;
        touch)
            deny_bash "bash-guard: 'touch' is not permitted. Use the Write tool to create files."
            ;;
        bash|sh)
            # Allow test scripts under tests/; deny everything else.
            second=$(echo "$part" | awk '{
                found=0
                for (i = 1; i <= NF; i++) {
                    if ($i !~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
                        if (found) { print $i; exit }
                        found=1
                    }
                }
            }')
            if [[ -z "$second" ]]; then
                deny_bash "bash-guard: bare '$first' (interactive shell) is not permitted in implementer/verifier sessions."
            elif echo "$second" | grep -qE '^tests/T-[0-9]'; then
                : # allow — running an acceptance-test script
            else
                deny_bash "bash-guard: '$first $second' is not permitted. Only 'bash tests/T-NNN/...' test scripts are allowed. If you need to run another script, STOP — write it under ## Blocked."
            fi
            ;;
    esac
done < <(echo "$CMD" | tr ';&|' '\n')

exit 0
