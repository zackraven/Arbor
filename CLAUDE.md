# CLAUDE.md — Arbor

This repository is built spec-first. The Obsidian vault in `Arbor Spec/` is the single source of truth. Code follows spec; if code must diverge, the spec is updated first or in the same change, with an entry in `Arbor Spec/12 Open Questions & Decisions Log.md`.

## Roles

Every session operates in exactly ONE of three roles. If the user has not stated the role, ASK before doing anything.

### ARCHITECT (strong model, user in the loop)
- May read: the entire vault + codebase.
- Job: maintain `20 Architecture`, `21 Contracts/`, `22 Build Plan`; write tickets into `23 Tickets/` following `23 Tickets/_Ticket Template.md` exactly; adjudicate Blocked tickets; update contracts (each contract change REQUIRES a decisions-log entry).
- Never implements tickets in the same session it writes them.
- **Launch command:** `ARBOR_ROLE=architect claude` — required to bypass the contract-shield and spec-shield hooks, which fire in ALL sessions. Without this env var the shields block all writes to `contracts/`, `Arbor Spec/21 Contracts/`, and `Arbor Spec/00–12` notes, even in an architect session.

### IMPLEMENTER (this is probably you)
- May read ONLY: your assigned ticket in `23 Tickets/`, the contract files that ticket links, `20 Architecture` sections the ticket links, and the files the ticket names. Do NOT read the design notes (00–12) or other tickets. Limited context is intentional.
- Job: implement exactly what the ticket specifies. Create/modify ONLY the files the ticket lists. Make the ticket's acceptance tests pass WITHOUT editing the tests.
- **STOP-ON-AMBIGUITY RULE (the most important rule):** if anything is ambiguous, underspecified, or conflicts with a contract — STOP. Write the question into the ticket's `## Blocked` section, set frontmatter `status: blocked`, and end the session. Never choose. Never "reasonably assume". Never keep moving.
- **Scope is the repository only.** Do not install software, modify PATH, change system configuration, or make any persistent change outside the repo. If a tool required by a ticket step is missing from the system → STOP, write it under Blocked. System prerequisites are listed in the ticket's `## System prerequisites` section and are installed by the user before the session begins.
- Forbidden always: editing anything in `21 Contracts/`, editing acceptance tests, adding features/error handling/abstractions beyond the ticket, touching files in the ticket's Out-of-scope list, editing spec notes 00–12.
- Done = tests pass + `status: implemented` + a filled `## Implementation notes` section (what was created, any nits).

### VERIFIER (fresh session, never the implementer's session)
- May read: the ticket, its linked contracts, and the diff.
- Job: check the diff against acceptance criteria, contracts, and the Out-of-scope list. Verdict into the ticket's `## Verification` section: `pass` (→ status: done) or `fail` with specific violations (→ status: rework). Suggest nothing; verify only.
- **Invariant:** `git diff` must be empty after a verifier session. The Bash write guard (contract-shield hook) enforces this mechanically.

## Workflow

1. Architect writes/refines tickets → user skims tickets (human review happens HERE, at ticket level).
2. One implementer session per ticket, fresh context each time.
3. Verifier pass → commit message references the ticket id (e.g. `T-002: sqlite schema + migrations`).
4. Blocked tickets return to an architect session; resolutions are logged in note 12.

## Conventions (all roles)

- TypeScript strict mode; no `any` outside declared boundary shims.
- Rust: clippy clean; errors via the policy in `20 Architecture`.
- Never commit directly to `main`... actually v1 is solo: commit to main, but ONLY after verifier pass.
- No new dependencies unless the ticket names them.
- All schema/DDL/type definitions live in `21 Contracts/` and are IMPORTED/GENERATED into code, never re-typed by hand.
