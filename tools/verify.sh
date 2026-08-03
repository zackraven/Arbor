#!/usr/bin/env bash
# tools/verify.sh — Launch a verifier Claude Code session.
# Unsets ARBOR_ROLE so contract-shield and spec-shield hooks are fully active.
# Model tier: Sonnet (verification is structured checklist work).
# The verifier agent additionally has Edit/Write disallowed at the tool level.
# Pass the ticket ID to verify when starting the session.
# Any extra arguments (--resume, etc.) are forwarded to claude.
exec env -u ARBOR_ROLE claude --model sonnet "$@"
