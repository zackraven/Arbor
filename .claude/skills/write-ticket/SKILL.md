---
name: write-ticket
description: >
  Write or finish a well-formed Arbor ticket in 23 Tickets/. Use when the
  architect needs to create a new ticket or complete a STUB. Enforces the
  six style rules that keep tickets implementer-ready.
disable-model-invocation: true
---

## write-ticket

Write or update a ticket in `Arbor Spec/23 Tickets/` following `_Ticket Template.md` exactly.

---

### Frontmatter

```yaml
---
id: T-NNN
phase: N
status: queued
depends_on: [T-NNN, …]   # empty list [] if none
---
```

Status starts at `queued`. Only the implementer sets `in_progress` and `implemented`; only the verifier sets `done` or `rework`.

---

### Six style rules

**Rule 1 — Goal: 2 sentences max.**
State what exists after this ticket that didn't before. No "how" in the goal — that belongs in Steps.

> Good: "The C1 schema exists as numbered migrations applied by a Rust runner. The DB file lives in the app data dir."
> Bad: "Implement the SQLite schema using rusqlite with WAL mode and foreign keys enabled."

**Rule 2 — Context links are exact.**
Every link must resolve: `[[20 Architecture#Error-handling policy]]` not `[[20 Architecture]]`. The implementer may read ONLY the linked sections. A broken link is a blocker.
Contract IDs must be real identifiers (`contracts/pack.schema.json`, `[[C2 Pack Schema]]`), never placeholders (`Cx`, `TBD`, `<schema>`). A ticket committed with a placeholder contract reference is an automatic rework — the implementer cannot resolve it.

**Rule 3 — Files is exhaustive.**
List every file the implementer will touch under **Create** or **Modify** — and nothing else. If a file needs touching that isn't listed, the ticket is wrong. Fix the ticket, not the implementer.

**Framework-mandatory scaffold files** (files the toolchain requires to build or run, e.g. `build.rs`, `capabilities/default.json`, `index.html`, `src/main.tsx`) must be listed explicitly, even when their content is dictated by the framework. Note which step creates each — e.g. "framework-mandatory: Tauri v2 requires `build.rs`; `cargo build` fails without it." An unlisted file the implementer discovers is framework-mandatory is a ticket defect — STOP, record the file under Blocked, and end the session. Never create framework-mandatory files silently.

**Rule 4 — Steps are two-implementer-identical.**
Avoid: "implement the schema". Write: "copy `contracts/migrations/0001_init.sql` verbatim into `src-tauri/migrations/`; a provided test diffs the two files — they must be identical."
Include: exact column types from the contract, exact function signatures, exact error types, exact behaviour on edge cases.

**Rule 5 — Acceptance criteria are literal commands.**
Every criterion is one of:
- `tests/T-NNN/foo.test.ts` passes (run via `pnpm test`)
- `tests/T-NNN/bar.rs` passes (run via `cargo test --manifest-path src-tauri/Cargo.toml --test t-NNN-bar`)
- `pnpm lint` exits 0
- `[manual]` — marked explicitly, used only when automation is truly impossible

**Automated-observation rule (Phase 3+ UI tickets):** Any ticket that produces or modifies a user-visible surface must include a `pnpm observe` criterion — `pnpm observe --route <path> --ticket T-NNN --out <dir>` produces a screenshot; assert the PNG is non-empty — rather than `[manual]`. Manual UI checks are prohibited: T-001 AC3 used `[manual]` and missed an infinite-recursion bug until rework. Exceptions: T-005 itself (harness cannot automate its own installation) and non-visual tickets (backend, schema, validators).

**Rule 6 — Out of scope is specific.**
Minimum: do not edit contracts/, do not add unlisted dependencies, do not add error-handling/abstractions beyond Steps. Always end with:
> **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

---

### Acceptance test files

The architect writes all test files **before assigning the ticket** to a new implementer session. Tests live at `tests/T-NNN/`. The implementer makes them pass and may not edit them. For Rust tests, the T-NNN section in `src-tauri/Cargo.toml` is updated by the architect (or specified in Steps for the implementer to add).

---

### STUB completion checklist

When finishing a STUB ticket (status shows `# STUB`):
- [ ] Fill every `*(STUB — architect to specify…)*` section
- [ ] Add the test file reference(s) to Acceptance criteria
- [ ] Write the test files in `tests/T-NNN/`
- [ ] Set status to `queued` (remove `# STUB` from status comment)
- [ ] Add a decisions-log entry if any interface was decided during completion
