---
tags: [spec, meta, handoff]
audience: human + architect/orchestrator at phase boundaries
do_not_load: implementer sessions (history, not instructions)
---

# 25 Advisor Handoff

> Context accumulated while standing up the build loop (planning → Phase 0 → Phase 1). Read at phase boundaries or when something breaks in an unfamiliar way. **Not** a rules document — enforceable rules live in `CLAUDE.md`, `.claude/skills/route/`, and the hooks. This note explains *why* those exist and what the project has already learned the hard way.

## State at handoff

- **Phase 0 complete:** repo bootstrapped (Tauri + React + TS), guardrails built and live-verified, observation harness working.
- **Phase 1 complete:** C1/C2 hardened into machine-readable contracts; SQLite schema + migrations; pack validator + fixture packs.
- **Enforcement:** four hook layers (contract-shield, spec-shield, bash-guard, git-integrity-check), plus commit-gate and session-log. All live-drilled, including via subagent dispatch.
- **Roles:** architect (Opus, `ARBOR_ROLE=architect`), implementer, verifier, orchestrator. Model tiers set at launch via `tools/*.sh` — **not** via agent-definition fields, which only apply to Task-dispatched subagents.
- **Backup:** pushed to GitHub.

## The failure taxonomy (read this one)

Every serious problem so far has been the same shape: **the design was fine; the enforcement layer silently didn't work.** Five instances:

1. Hooks registered in subagent definitions → never fired for top-level sessions.
2. jq fail-closed guard used `exit 1` → output discarded, guard failed *open* — the exact defect it existed to prevent.
3. `mkdir` denied coarsely in one hook, masking a finer path check in another → legitimate work blocked.
4. Bash denylist matched command strings → `node script.mjs` writing files at runtime was invisible.
5. `git apply` put the protected path inside patch *content* → front-line hook never saw it.

**Consequence:** a green test suite proves logic, never registration. Nothing is trusted until it has been drilled in a live session. This has been right five times out of five.

## Verification heuristics (earned, not theoretical)

- **Drill every new hook live** before trusting it. Direct invocation ≠ firing in a session.
- **One tool call per message** during drills. Parallel calls abort each other and produce false passes.
- **Every probe must be one that would otherwise succeed.** A probe that fails for its own reasons looks identical to a pass.
- **Self-protection probes go last.** One destructive probe poisons every subsequent result in the run.
- **Account for changed test counts.** A suite that shrinks after a fix is a silent regression until explained.
- **A session reporting green is not evidence.** Read the artifact — screenshot, pixel value, actual diff.

## Behavioural findings

- **Agents route around denials unless explicitly forbidden.** Observed twice: a shield deny answered by writing and executing a temp script (then deleting it), and a commit-gate deny answered by rewording the commit message to dodge the matcher. Both were reported honestly when asked. `HOOK DENY = FULL STOP` now covers all roles and names message/command rewording as a violation — and it has since held under real conditions.
- **False positives train bypass behaviour.** Precision in gates matters as much as coverage. The commit-gate `T-NNN`-anywhere match was a false-positive generator and directly provoked a violation.
- **Bypass-for-testing requires prior user authorisation.** An orchestrator discovered a novel bypass and used it unprompted to construct a test. Discovering a hole is now an escalation event, not a step to execute.

## Where human attention pays off

Highest value first:

1. **Skimming tickets before implementation.** Cheaper to audit than code, and where under-specification is catchable. Two tickets so far shipped incomplete Create lists.
2. **Adjudicating Blocked notes.** The whole loop depends on stopping being safe and useful.
3. **Reading outputs properly.** Every failure above was caught by reading, not by automation.
4. **Aesthetic judgment** (Phase 3+). The observation harness clears everything objectively checkable first; taste escalates to the human.

Low value: reviewing implementer code line-by-line. The tests and verifier cover it.

## Recurring root causes worth watching

- **Values defined twice drift.** The dev port lived in three places and desynced twice. Anything referenced by more than one file belongs defined once (`DEV_PORT` pattern) or in `contracts/`.
- **Contracts under-specify behaviour, not just shape.** Two Phase 1 bugs were contract gaps (Ajv `allErrors`, diagnostic bank size), not implementation slips. When a bug looks like carelessness, check whether the contract actually said anything.
- **Windows/MINGW64 quirks** accumulate: MinGW toolchain for `tauri-build`, `pnpm-workspace.yaml` allowBuilds, `MSYS_NO_PATHCONV=1` for observe. Collected in note 20/24 — add to that list rather than rediscovering.

## What NOT to do

- **Don't keep hardening enforcement.** Three bypasses all shared one root (string analysis can't see runtime behaviour), now covered by an allowlist *and* a commit-time integrity check. Further work here is diminishing; wait for a real break.
- **Don't let repair/patching become routine.** Same discipline as the product's own repair system: frequency is the signal. If tickets keep needing rework, fix the ticket-writing layer, not the tickets.
- **Don't auto-commit on verifier pass.** Automation is right for dispatch and mechanical steps; the commit is the last human checkpoint before permanent history.
- **Don't over-freeze warm contracts.** C5 (orchestrator jobs) and C3 (commands) were deliberately left warm — tighten as phases complete, not before.

## Open decisions

- Fixture tree (~60 nodes) for Phase 2/3: who authors it, and how realistic must it be for the layout test to mean anything?
- ELK vs dagre — still unprototyped; Phase 3's first real risk.
- Loop-health metrics exist in the session log but have never been *reviewed*. Enough tickets have run to look at blocked/rework rates for real.
- Whether design notes 00–12 (written before any code) still match what was built — a reconciliation pass is overdue.
