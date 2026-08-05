---
name: route
description: >
  Diagnostic and routing skill for Arbor. Encodes the decision tree for
  triaging hook denies, contract conflicts, test count drift, and new hook
  verification. Use when a ticket is blocked, reworked, or a hook deny
  needs analysis.
---

# /route — Diagnostic Routing Decision Tree

Use this skill when an implementer is blocked, a verifier has flagged rework, or a hook deny needs triage. Walk the tree top-down; the first matching branch is the action.

## 1. Hook deny triage

A PreToolUse hook denied an operation. Is it a false positive or a real block?

```
Hook deny received
├── Is the denied path actually protected?
│   ├── YES → Is the operation legitimate for this ticket?
│   │   ├── YES → The hook pattern is too broad (false positive)
│   │   │   → ROUTE TO ARCHITECT: narrow the hook pattern
│   │   │   → Record in decisions log with the specific pattern and the
│   │   │     legitimate operation it blocked
│   │   └── NO → The deny is correct
│   │       → Implementer: write ## Blocked, set status: blocked, end session
│   │       → This is not a routing issue — the ticket asked for something forbidden
│   └── NO → The hook matched a path it shouldn't protect (pattern too broad)
│       → ROUTE TO ARCHITECT: fix the hook regex
│       → Example: tests/T-NNN/fixtures/ blocked by a pattern meant for test files only
│
├── Is there a permitted alternative?
│   ├── YES → Use it (e.g., `pnpm list ajv` instead of `node -e "..."`)
│   │   → The deny is correct by policy; the alternative achieves the goal
│   └── NO → The operation has no permitted path
│       → ROUTE TO ARCHITECT: either the hook or the ticket needs updating
│
└── Is this a command-class denial (bash-guard)?
    ├── YES → The entire command class is denied (node, python, etc.)
    │   → Do NOT attempt argument variations — they are all denied
    │   → Check if the ticket's Steps can be achieved without the denied interpreter
    │   → If not → ROUTE TO ARCHITECT: ticket needs rewriting
    └── NO → Path-class denial (contract-shield, spec-shield)
        → Check if the path is in the ticket's Files list
        → If the ticket names a protected path → ROUTE TO ARCHITECT: contradiction
```

## 2. Contract conflict routing

The ticket's Steps conflict with a contract in `21 Contracts/`.

```
Contract conflict detected
├── Is the ticket wrong? (Steps ask for something the contract forbids)
│   → ROUTE TO ARCHITECT: rewrite the ticket Steps
│   → The contract is the source of truth unless explicitly changed
│
├── Is the contract wrong? (Contract is outdated or has a gap)
│   → ROUTE TO ARCHITECT: update contract + decisions-log entry
│   → Contract changes require a dated entry in note 12
│   → The implementer MUST NOT resolve this — STOP-ON-AMBIGUITY applies
│
└── Is it genuinely ambiguous? (Both readings are defensible)
    → ROUTE TO ARCHITECT: clarify in both the contract and the ticket
    → Add to Open Questions in note 12 if systemic
```

## 3. Test count drift

Acceptance test count differs from what the ticket expected.

```
Test count mismatch
├── More tests than ticket expected
│   ├── Were tests added by architect since ticket was written?
│   │   → Ticket expectations are stale — ROUTE TO ARCHITECT to update ticket
│   └── Were tests added by implementer?
│       → Violation: implementer must not edit acceptance tests
│       → ROUTE TO ARCHITECT: verifier should catch this as a fail
│
├── Fewer tests than ticket expected
│   ├── Were tests removed by architect?
│   │   → Ticket expectations are stale — ROUTE TO ARCHITECT to update ticket
│   └── Were tests deleted by implementer?
│       → Critical violation: implementer deleted acceptance tests
│       → ROUTE TO ARCHITECT: immediate rework
│
└── Same count but different test names/content
    → Tests were modified — check git blame
    → If modified by architect → ticket expectations stale
    → If modified by implementer → violation
```

## 4. New hook verification protocol

A new or modified hook must be verified before trusting it.

```
New/modified hook detected
├── Has the hook passed a serial-probe drill?
│   ├── YES → Trust it; proceed with dependent tickets
│   └── NO → Run the drill first (note 24 protocol)
│       → Serial probes only (one tool call per message)
│       → Probes must be operations that would otherwise succeed
│       → Self-protection probes go last (one destructive probe
│         poisons every subsequent result in the run)
│       → All protected path classes must be probed
│       → Both write vectors (Edit/Write and Bash write verbs)
│
├── Does the hook compose correctly with other hooks?
│   ├── Check for collisions (two hooks denying the same thing differently)
│   │   → Example: bash-guard denying mkdir AND contract-shield denying mkdir
│   │   → Fix: each hook owns one concern (command-class vs path-class)
│   └── Check for gaps (operation allowed by all hooks but should be denied)
│       → Run probes for the specific operation class the hook targets
│
└── Is jq available?
    ├── YES → Hook can parse input JSON normally
    └── NO → Hook must fail closed (exit 0 with deny JSON)
        → Verify this path explicitly in the drill
```

## 5. Verification evidence rules

These rules apply whenever evaluating whether something "passed" — hook drills, test suites, verifier sessions, implementation reports.

```
Evaluating a "green" result
├── A session reporting green is NOT evidence.
│   → Read the artifact: the screenshot, the pixel value, the actual diff.
│   → A session can report green while the underlying check never ran,
│     ran on stale data, or tested the wrong thing.
│
├── A test suite that shrank after a fix is a silent regression.
│   → Compare test count before and after.
│   → A count decrease must be explained: which tests were removed and why?
│   → If unexplained → ROUTE TO ARCHITECT: investigate before trusting the suite.
│
├── Direct invocation ≠ firing in a session.
│   → A hook that works when run manually may not fire in a live session
│     (registration, scope, race conditions).
│   → Drill every new hook in a live session before trusting it.
│
└── False positives train bypass behaviour.
    → A hook that fires on legitimate operations teaches agents to route around it.
    → Precision in gates matters as much as coverage.
    → If a hook is generating false positives → ROUTE TO ARCHITECT: narrow the pattern.
```

## Quick reference: who handles what

| Situation | Route to |
|-----------|----------|
| Hook deny — false positive | Architect (fix hook) |
| Hook deny — correct, no alternative | Architect (fix ticket) |
| Hook deny — correct, alternative exists | Implementer uses alternative |
| Contract conflict | Architect (update contract + log) |
| Test count drift | Architect (update ticket) |
| New hook unverified | Architect (run drill) |
| Implementer edited protected file | Verifier fails → Architect reviews |
| Dependency cycle in queue | Architect (restructure tickets) |
