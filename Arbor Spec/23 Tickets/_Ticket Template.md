---
id: T-000
phase: 0
status: template   # queued | in_progress | blocked | implemented | rework | done
depends_on: []
---

# T-000 — <short imperative title>

## Goal
<Two sentences max. What exists after this ticket that didn't before.>

## System prerequisites
<List every tool, runtime, or system package the implementer must have installed before beginning. The **user** installs these before handing the ticket to an implementer session — not the implementer. If this section is empty, write "none". The implementer may not install software, modify PATH, or make any persistent change outside the repository; if a prerequisite appears to be missing → STOP, write the question under Blocked, set `status: blocked`, end the session.>

## Context links (implementer may read ONLY these)
- Contract(s): [[21 Contracts/Cx …]]
- Architecture section(s): [[20 Architecture#…]]

## Files
**Create:** <exact paths>
**Modify:** <exact paths — and nothing else>

## Steps
1. <Step-level instructions. Specific enough that two different implementers would produce near-identical diffs.>
2. …

## Acceptance criteria
<Literal test cases wherever possible. Tests live in `tests/T-000/` and are written BY THE ARCHITECT with this ticket. The implementer makes them pass and may not edit them.>
- [ ] `tests/T-000/…` passes
- [ ] <non-test criteria, each objectively checkable>

## Out of scope — DO NOT
- Do not touch <modules/files>.
- Do not add error handling, config, abstractions, or dependencies beyond what Steps specify.
- Do not "improve" adjacent code encountered along the way.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked
<Implementer writes questions here. Architect answers inline with a date, and updates Steps if needed.>

## Implementation notes
<Implementer fills on completion: what was created, deviations (should be none), nits noticed but NOT acted on.>

## Verification
<Verifier fills: pass/fail, violations if any, date.>
