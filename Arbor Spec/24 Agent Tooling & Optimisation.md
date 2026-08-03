---
tags: [spec, implementation, tooling, agents]
---

# 24 Agent Tooling & Optimisation

> Implementation layer, part 4 of 4. How Claude Code's extension surface (CLAUDE.md, skills, subagents, hooks, plugins, MCP) is used to make the architect/implementer/verifier system *self-enforcing* and token-efficient. Everything here lives in `repo:/.claude/` and is versioned with the code.
> Verify current syntax against the official docs before authoring: https://code.claude.com/docs — features move fast.

## Principle: put each rule in the layer that enforces it

Prose rules get forgotten mid-task; the right home for a constraint is the mechanism that fires without being remembered. Mapping for Arbor:

| Rule | Layer |
|---|---|
| "Which role am I, what may I read" | **Subagent definitions** (tool allow/deny lists) |
| "Implementer may not edit contracts/tests" | **PreToolUse hook** (deterministic block) |
| "How to write a ticket / a contract / a pack" | **Skills** |
| "Cheap model for grunt work, strong for reasoning" | **Launch scripts** (`tools/*.sh` pass `--model` to `claude`) |
| "Project conventions every session needs" | **CLAUDE.md** (kept short — it's paid for every session) |

## Subagents (`.claude/agents/`)

Three definitions mirroring the roles in `CLAUDE.md`:

- **`implementer`** — tools: file read/write/edit, bash (test running); **denied**: web access, anything outside the repo. Prompt = the IMPLEMENTER section of CLAUDE.md. Modest max-turns so a flailing session stops instead of thrashing.
- **`verifier`** — `disallowedTools: Edit, Write, NotebookEdit` — a verifier that cannot directly write cannot "fix while verifying". Bash is retained for running tests. The contract-shield and spec-shield hooks in `settings.json` additionally block Bash write-verbs to protected paths, so the working tree is unmodifiable. **Invariant: `git diff` must be empty after every verifier session.** Output: verdict text for the ticket's Verification section.
- **`architect`** — full read; used interactively with the user rather than fire-and-forget.

**Model tiers** are set by the launch scripts (`tools/arch.sh`, `tools/impl.sh`, `tools/verify.sh`) via `claude --model <alias>`, not in the subagent definitions. Subagent model fields only take effect for Task-tool subagent dispatch, which Arbor does not use — all sessions are top-level. Tiers: architect → Opus; implementer, verifier → Sonnet.

Also worth defining for the *product's own* pipeline later (Phase 4): the build orchestrator's decomposer/pruner/author/verifier map naturally onto subagent-style isolated contexts with per-step model tiers — same pattern, one level down.

## Hooks (`.claude/hooks/`) — the hard guardrails

PreToolUse hooks can deterministically block a tool call before it happens; unlike prompt rules, they fire even when the model has drifted. v1 set:

1. **Contract shield** — block any Edit/Write/Bash-write-verb targeting `contracts/`, `Arbor Spec/21 Contracts/`, or `tests/T-*/` in **all sessions**. Gate: the session launched with `ARBOR_ROLE=architect claude` bypasses the shield (env-var only — a file marker could be forged by Bash). Covers Bash write verbs: `>`, `>>`, `cp`, `mv`, `sed -i`, `tee`, `dd`, `truncate`, `python -c`, `git checkout --`, `git restore`. Lives in `settings.json PreToolUse`, not in subagent definitions (subagent-scoped hooks only fire when invoked via Task, never in top-level sessions).
2. **Spec shield** — same gate and Bash-verb coverage for `Arbor Spec/00–12` design notes. Also lives in `settings.json PreToolUse`.
3. **Post-edit lint** — after any code edit: run `tsc --noEmit` / `cargo clippy` on the touched area; feed failures straight back. Catches drift at the moment it happens instead of at ticket end.
4. **Commit gate** — block `git commit` unless the ticket file referenced in the message has `status: implemented|done` (cheap script parsing frontmatter). Gate: `ARBOR_ROLE=architect` bypasses (architect commits reference tickets without implementing them). In non-architect sessions, any `T-NNN` mention in the commit message is gated on the ticket's status.
5. **Session log** — append tool-call summaries to a per-ticket audit file; makes verifier and Blocked adjudication reviewable.

### Guardrail verification protocol (drill)

When verifying that the shields work correctly — whether during T-004 acceptance testing or any ad-hoc drill — the following rules are **mandatory**:

1. **Serial probes only.** Run one probe per message (one tool call at a time). Parallel tool calls in a single message race against each other; the hook may fire on one and allow the other before the first result is processed, producing false passes. One call → one result → confirm block → next probe.

2. **Probes must be operations that would otherwise succeed.** A probe is only evidence that the shield is working if the underlying operation would have completed without the shield. Do not use malformed paths, non-existent files, or read-only operations as probes — they would fail (or no-op) anyway.

3. **Fail closed on jq unavailability.** The shields use `jq` to parse the hook input JSON. If `jq` is absent or exits non-zero, the shield must default to **deny** (exit non-zero), not allow. Current implementation exits 0 on jq failure (fail-open) — this is a known defect. Fix: replace all `jq` calls with a guard that denies if jq is unavailable. Until fixed, verify jq is present (`which jq`) before running a drill.

4. **All three protected path classes must be probed in each full drill:**
   - `contracts/` or `Arbor Spec/21 Contracts/` (contract paths)
   - `tests/T-*/` (acceptance tests)
   - `Arbor Spec/00–12` spec notes (spec-shield, separate hook)

5. **Both write vectors must be probed:** Edit/Write tool and Bash write verbs (`>`, `sed -i`, etc.).

## Skills (`.claude/skills/`)

Skills load knowledge on demand instead of bloating every context — the token-efficient home for "how we do X here":

- **`/write-ticket`** — the ticket template + 5–6 style rules distilled from the exemplars (steps so specific two implementers would produce near-identical diffs; acceptance criteria as literal tests; out-of-scope always present). Used by architect sessions; this is how ticket quality stays uniform as the queue grows.
- **`/write-contract`** — contract note format + freeze/changelog discipline.
- **`/frontend-design`** — Arbor's aesthetic constitution for Phase 3+: dark-first, restrained palette, colour-is-state, motion budget, spacing scale, the "graph is the hero" rule from [[11 UI Spec]]. Anthropic ships a frontend-design skill in some surfaces; adapt its craft guidance but pin *Arbor's* tokens here so UI tickets inherit taste without re-litigating it.
- **`/author-pack`** (Phase 4+) — the pack-authoring prompt contract for the *product's* build pipeline, kept in the repo so the orchestrator and dev-time testing use the same source.
- **`/sympy-judge`** — how to phrase `answer_expr` so sympy equivalence-checking is reliable (canonical forms, assumptions, simplify pitfalls).

## Observation harness (closing the visual loop)

The implementer's inner loop is only as good as what it can observe. Code tickets observe via tests and lint; **UI tickets need eyes.** From Phase 3 onward:

- A dev-observation harness: script that runs the Vite dev server, drives it with **Playwright**, and captures screenshots (and simple interaction traces: click node → panel opens) into the session.
- UI tickets' acceptance criteria may then include *visual* checks the implementer verifies itself before handing to the verifier (e.g. "fixture tree renders with zero edge crossings through node bodies at default zoom; screenshot attached to Implementation notes").
- The verifier uses the same harness — verification of UI tickets includes looking, not just reading the diff.
- Install + smoke test is ticket **T-005** (architect to write, Phase 0/3 boundary): harness launches, screenshots the T-001 placeholder app, image lands in the session log folder.

Judgment calls on aesthetics stay with the user (context advantage — you know what "smooth and sexy" means); the harness exists so the loop only escalates to you *after* the agent has cleared everything objectively checkable.

**Rule: no `[manual]` UI checks.** Any ticket that produces or modifies a user-visible surface (Phase 3+) must include an automated observation criterion using `pnpm observe`, not a `[manual]` check. Manual checks introduce the exact false-pass risk that caused T-001 AC3 to miss the `beforeDevCommand` recursion. Exception: T-005 itself (the harness cannot automate its own installation smoke test) and non-visual tickets (backend, schema, validators).

**MINGW64/Windows shell note:** On MINGW64 (MSYS2/Git Bash), the shell silently converts arguments beginning with `/` or a Windows drive letter into Unix-style paths before the target script sees them (e.g. `--route /` becomes `--route C:/Program Files/Git/`). Prefix every `pnpm observe` invocation with `MSYS_NO_PATHCONV=1` to suppress conversion. This applies to both `--route` and `--out` arguments. Example: `MSYS_NO_PATHCONV=1 pnpm observe --route / --out C:/tmp/arbor-obs`. See [[20 Architecture#Environment notes (Windows/MINGW64)]] for this and other MINGW64 quirks.

## Loop health metrics (instrumenting the process itself)

The product has a health metric (repair insertions per tree — [[06 Repair System]]); the process gets the same treatment. The session-log hook additionally records per ticket: turns used, test-run count, **blocked?**, **rework?**. Two derived rates, reviewed casually every few tickets:

- **Blocked-rate rising** → tickets too vague → fix the `/write-ticket` skill / architect prompting, not the implementer.
- **Rework-rate rising** → out-of-scope fences too loose or acceptance criteria too weak → tighten the template.

Cheap to collect (the hook already fires), and it means you tune the *loops*, not just yell at outputs.

## MCP servers

Keep minimal — every connected server costs context. Worth it: a **Semantic Scholar** connection for Phase 4 (or a thin internal fetch wrapper instead), and optionally **SQLite inspection** during debugging. Nothing else in v1; GitHub/etc. add surface without payoff for a solo local project.

## Token-efficiency practices (all sessions)

1. **Fresh context per ticket; small contexts by design.** The implementer reads a ticket + linked contracts — never the vault. Long sessions accumulate opinions and cost.
2. **CLAUDE.md stays under ~1.5k tokens.** Anything situational moves to a skill (loaded only when triggered).
3. **Deterministic before model.** Lint/tests/schema-validation/sympy run as code via hooks — never ask a model to check what a script can check.
4. **Model tiers per job**, encoded in the launch scripts via `--model` (and later in C5 for the product's own jobs): strong (Opus) = architecture, adjudication, authoring; cheap (Sonnet) = implementation grunt work, verification, classification.
5. **Checkpoint long jobs** (builds resumable) so an exhausted usage window never wastes completed work.
6. **Compact artifacts as interfaces.** Sessions communicate via files (tickets, contracts, checkpoints), not via conversation history.

## Plugin packaging (later, optional)

Once `.claude/` stabilises, bundle agents + skills + hooks as a single Arbor plugin so the whole toolchain is one install on any machine — and note this is exactly the distribution story if the product's own agent harness ever ships to users.

## Setup tickets

Phase 0 gets two tooling tickets (architect to write): **T-004** installs agents/skills/hooks with a smoke test — any session (Edit, Write, or Bash) attempting to write to `contracts/schema.sql` without `ARBOR_ROLE=architect` must be blocked by the contract-shield hook; **T-005** installs the observation harness (stub in [[23 Tickets/T-005 Observation Harness]]). The guardrails and the eyes are themselves acceptance-tested.
