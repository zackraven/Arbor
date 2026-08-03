#!/usr/bin/env bash
# tools/impl.sh — Launch an implementer Claude Code session.
# Unsets ARBOR_ROLE so contract-shield and spec-shield hooks are fully active.
# Model tier: Sonnet (implementation grunt work within a ticket).
# Assign a ticket (pass ticket ID as context) before starting work.
# Any extra arguments (--resume, etc.) are forwarded to claude.
exec env -u ARBOR_ROLE claude --model sonnet "$@"
