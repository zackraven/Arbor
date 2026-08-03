#!/usr/bin/env bash
# tools/arch.sh — Launch an architect Claude Code session.
# Sets ARBOR_ROLE=architect so contract-shield and spec-shield hooks bypass their
# deny logic. Without this env var those hooks block all writes to contracts/,
# Arbor Spec/21 Contracts/, Arbor Spec/00-12 notes, tests/T-*/, and .claude/.
# Model tier: Opus (architecture, adjudication, contract changes).
# Any extra arguments (--resume, etc.) are forwarded to claude.
exec env ARBOR_ROLE=architect claude --model opus "$@"
