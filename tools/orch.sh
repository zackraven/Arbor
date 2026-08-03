#!/usr/bin/env bash
# tools/orch.sh — Launch an orchestrator Claude Code session.
# Unsets ARBOR_ROLE so contract-shield, spec-shield, bash-guard, commit-gate,
# and git-integrity-check hooks are fully active. The orchestrator dispatches
# implementer and verifier subagents via the Task tool; it does not bypass
# shields itself.
# Model tier: Opus (orchestration requires reasoning about queue state,
# dependency resolution, and escalation decisions).
# Any extra arguments (--resume, etc.) are forwarded to claude.
exec env -u ARBOR_ROLE claude --model opus "$@"
