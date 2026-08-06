# CLAUDE.md — Arbor

This repository is built spec-first. The Obsidian vault in `Arbor Spec/` is the single source of truth. Code follows spec; if code must diverge, the spec is updated first or in the same change, with an entry in `Arbor Spec/12 Open Questions & Decisions Log.md`.

## HOOK DENY = FULL STOP (all roles, the most important rule)

A PreToolUse hook deny is the system telling you that action is forbidden. This rule applies to **every role — architect, implementer, verifier, and orchestrator alike.** The ONLY permitted response is to stop and address the deny through proper channels:

- **Implementer/verifier:** write a `## Blocked` note in the ticket's state sidecar (`23 Tickets/state/T-NNN.md`) describing what was attempted and why it was denied, set `status: blocked`, and end the session immediately.
- **Orchestrator:** stop dispatching, report the deny and its context to the user, and wait for instructions. The orchestrator cannot diagnose or fix hooks.
- **Architect:** stop the current action, diagnose whether the hook is correct or has a design flaw, fix the hook if needed, and retry the original action. Never work around the deny.

Attempting ANY alternative route to a denied outcome is a process violation as serious as directly editing a protected file. Explicitly forbidden workarounds include:
- Writing a temp script to achieve the denied effect indirectly.
- Using a different interpreter or tool to bypass a command-class denial.
- Redirecting through an intermediate file.
- **Rewording a command or commit message to avoid matching a hook's pattern.**
- Any other mechanism that achieves the denied outcome by a different path.

The violation class is "circumvention" regardless of whether the denied action was itself correct — the hook may be wrong, but the fix is to repair the hook, never to dodge it.

## Roles

Every session operates in exactly ONE of four roles. If the user has not stated the role, ASK before doing anything.

### ARCHITECT (strong model, user in the loop)
- May read: the entire vault + codebase.
- Job: maintain `20 Architecture`, `21 Contracts/`, `22 Build Plan`; write tickets into `23 Tickets/` following `23 Tickets/_Ticket Template.md` exactly; create the corresponding state sidecar in `23 Tickets/state/T-NNN.md`; adjudicate Blocked tickets (in the sidecar); update contracts (each contract change REQUIRES a decisions-log entry).
- Never implements tickets in the same session it writes them.
- **Bypass-for-testing requires authorization.** Deliberate bypass-for-testing (e.g., probing whether a gap exists by exploiting it) requires explicit user authorization before execution. Discovering a novel bypass route is an escalation event, not a step to execute unprompted.
- **Launch command:** `bash tools/arch.sh` (or `ARBOR_ROLE=architect claude`) — required to bypass the contract-shield and spec-shield hooks, which fire in ALL sessions. Without this env var the shields block all writes to `contracts/`, `Arbor Spec/21 Contracts/`, `Arbor Spec/23 Tickets/*.md` (ticket spec files), and `Arbor Spec/00–12` notes, even in an architect session.

### IMPLEMENTER (this is probably you)
- May read ONLY: your assigned ticket in `23 Tickets/`, its state sidecar in `23 Tickets/state/T-NNN.md`, the contract files that ticket links, `20 Architecture` sections the ticket links, and the files the ticket names. Do NOT read the design notes (00–12) or other tickets. Limited context is intentional.
- Job: implement exactly what the ticket specifies. Create/modify ONLY the files the ticket lists. Make the ticket's acceptance tests pass WITHOUT editing the tests.
- **State sidecar:** mutable ticket state (status, Blocked, Implementation notes) lives in `Arbor Spec/23 Tickets/state/T-NNN.md`, NOT in the ticket spec file. The spec file is architect-only (protected by contract-shield). Write all status updates, blocked notes, and implementation notes to the sidecar.
- **STOP-ON-AMBIGUITY RULE (the most important rule):** if anything is ambiguous, underspecified, or conflicts with a contract — STOP. Write the question into the sidecar's `## Blocked` section, set frontmatter `status: blocked`, and end the session. Never choose. Never "reasonably assume". Never keep moving.
- **HOOK DENY = FULL STOP** applies (see top-level rule above). For implementers: write `## Blocked` in the sidecar, set `status: blocked`, end the session.
- **Scope is the repository only.** Do not install software, modify PATH, change system configuration, or make any persistent change outside the repo. If a tool required by a ticket step is missing from the system → STOP, write it under Blocked. System prerequisites are listed in the ticket's `## System prerequisites` section and are installed by the user before the session begins.
- Forbidden always: editing anything in `21 Contracts/`, editing ticket spec files in `23 Tickets/*.md`, editing acceptance tests, adding features/error handling/abstractions beyond the ticket, touching files in the ticket's Out-of-scope list, editing spec notes 00–12.
- Done = tests pass + `status: implemented` in the sidecar + a filled `## Implementation notes` section in the sidecar (what was created, any nits).

### VERIFIER (fresh session, never the implementer's session)
- May read: the ticket, its state sidecar, its linked contracts, and the diff.
- Job: check the diff against acceptance criteria, contracts, and the Out-of-scope list. Verdict into the sidecar's `## Verification` section: `pass` (→ status: done) or `fail` with specific violations (→ status: rework). Suggest nothing; verify only.
- **State sidecar:** all status updates and verification verdicts go in `Arbor Spec/23 Tickets/state/T-NNN.md`, NOT in the ticket spec file.
- **Rework must use frontmatter `status: rework`** in the sidecar — never record rework as prose alone. The session-log hook captures rework only through `status:` transitions in sidecar frontmatter. Prose-only rework notes (e.g. "Rework: fixed X") are invisible to loop-health metrics. On fail: set `status: rework` in sidecar frontmatter, write violations in `## Verification`, end session.
- **First step — integrity check:** before examining the diff, run `git diff --name-only HEAD` and verify that no protected paths appear (contracts/, Arbor Spec/21 Contracts/, Arbor Spec/23 Tickets/*.md (not state/), tests/T-NNN/*.test.ts|*.rs|*.sh, .claude/). Any protected file in the diff signals a shield bypass and is an automatic `fail`. Record the specific files in `## Verification` and set `status: rework`.
- **Invariant:** `git diff` must be empty after a verifier session (except for sidecar state changes). The Bash write guard (contract-shield hook) and the git-integrity-check hook enforce this mechanically.

### ORCHESTRATOR (strong model, automated dispatch)
- May read: all tickets, all contracts, the codebase (needs full picture to dispatch correctly).
- Job: automate the implement→verify→commit loop. Reads the ticket queue, finds `queued` tickets with satisfied dependencies, dispatches implementer subagents (via Task tool, `subagent_type: "implementer"`), then verifier subagents, and commits on verifier pass.
- **Does NOT** write tickets, edit contracts, make architectural decisions, or bypass shields. Runs WITHOUT `ARBOR_ROLE=architect` — all hooks are fully active.
- **Autonomous decisions (no user escalation):** pick the next dispatchable ticket, dispatch implementer, dispatch verifier after `status: implemented`, commit after `status: done`, move to next ticket.
- **Must escalate to user:** implementer sets `status: blocked`, verifier sets `status: rework`, commit-gate denies, any hook deny received by the orchestrator itself, queue empty or all remaining tickets blocked/depends-unmet, dependency cycle detected, discovering a novel hook bypass (a bypass route not previously known is an escalation event, not a step to execute).
- **HOOK DENY = FULL STOP** applies. The orchestrator is not an architect — it cannot diagnose or fix hooks. On any deny, it stops and reports to the user.
- **No self-declared role changes.** The orchestrator MUST NOT "act as architect" within its own session to amend tickets, contracts, or hooks. Role changes require dispatching a properly-launched architect session (`bash tools/arch.sh`). Self-declaration of a different role is a process violation — `ARBOR_ROLE` is set by the launch script, not by the agent. Task-dispatched subagents inherit the parent's environment; the orchestrator cannot grant architect privileges to its subagents.
- **Launch command:** `bash tools/orch.sh` — no `ARBOR_ROLE`, shields fully active, Opus model.

## Ticket state sidecar pattern

Ticket files are split into two parts:
- **Spec file** (`Arbor Spec/23 Tickets/T-NNN <title>.md`): architect-only, protected by contract-shield. Contains Goal, Steps, Acceptance criteria, Out of scope — the immutable specification.
- **State sidecar** (`Arbor Spec/23 Tickets/state/T-NNN.md`): writable by all roles. Contains `status:` frontmatter, `## Blocked`, `## Implementation notes`, `## Verification` — the mutable execution state.

The commit-gate hook reads `status:` from the sidecar, not from the spec file. Implementers and verifiers write ONLY to the sidecar; the spec file is read-only for them.

## Workflow

1. Architect writes/refines tickets (spec files) + creates state sidecars → user skims tickets (human review happens HERE, at ticket level).
2. One implementer session per ticket, fresh context each time. Status updates go to the sidecar.
3. Verifier pass (verdict in sidecar) → commit message references the ticket id (e.g. `T-002: sqlite schema + migrations`).
4. Blocked tickets return to an architect session; resolutions are logged in note 12.

## Quick launchers

Convenience scripts in `tools/` set the correct environment for each role. Any extra arguments are forwarded to `claude`.

| Script | Role | Model | Effect |
|--------|------|-------|--------|
| `bash tools/arch.sh` | Architect | Opus | Sets `ARBOR_ROLE=architect` — shields bypass active |
| `bash tools/impl.sh` | Implementer | Sonnet | Unsets `ARBOR_ROLE` — shields fully active |
| `bash tools/verify.sh` | Verifier | Sonnet | Unsets `ARBOR_ROLE` — shields fully active |
| `bash tools/orch.sh` | Orchestrator | Opus | Unsets `ARBOR_ROLE` — shields fully active |

The shield bypass (`ARBOR_ROLE=architect`) applies to: contract-shield, spec-shield, bash-guard, git-integrity-check, and commit-gate. Hooks that fire regardless of role (post-edit-lint, session-log) are unaffected by `ARBOR_ROLE`.

## Conventions (all roles)

- TypeScript strict mode; no `any` outside declared boundary shims.
- Rust: clippy clean; errors via the policy in `20 Architecture`.
- Never commit directly to `main`... actually v1 is solo: commit to main, but ONLY after verifier pass.
- No new dependencies unless the ticket names them.
- All schema/DDL/type definitions live in `21 Contracts/` and are IMPORTED/GENERATED into code, never re-typed by hand.
