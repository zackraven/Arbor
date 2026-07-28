---
tags: [spec, decisions, log]
---

# 12 Open Questions & Decisions Log

## Rules

- **Append-only.** The maintaining agent adds dated entries; it never edits or deletes past entries. If a decision is reversed, a new entry says so and links the old one.
- Any material change to another spec note requires an entry here in the same change.

## Open questions

- [ ] Local model for the teaching loop — feasible given how scripted packs are? (Research task; not v1. See [[10 Stack & Architecture]].)
- [ ] Haiku vs Sonnet for runtime answer classification — needs empirical testing on real segment transcripts.
- [ ] Baseline manifests — source A-level spec topic lists (public) and define the Year-1-BSc manifest. Format TBD.
- [ ] Diagnostic bank size — is 10 slots × ~2 variants enough for test-out + retakes without verbatim repeats?
- [ ] Concept-registry embedding model + similarity threshold for dedup.
- [ ] ELK vs dagre — prototype both on a ~60-node DAG for layout quality and speed.
- [ ] Maths input UX — raw LaTeX with preview vs structured editor.
- [ ] Adaptive placement test (v1.5) — design the difficulty-bisection probe when revisiting.
- [ ] Visualisations in teaching (v2) — scope entirely unexamined by design.
- [ ] Whether paper digests should surface in the learning UI (per top-level node "frontier" panel) or only ground authoring.

## Decisions log

**2026-07-19 — Initial spec drafted.** Key decisions from planning conversations:

1. **Structure is a DAG, not a tree**; shared prerequisites are single nodes with multiple parents. Layout via layered algorithms (ELK/dagre + React Flow).
2. **Papers define targets, not structure.** Bounded Semantic Scholar scrape (15–30/category) grounds the top bubble, terms dictionary, and frontier flavour; prerequisite decomposition comes from curriculum knowledge. No citation crawling in v1.
3. **Build expensive, teach cheap.** Strong model builds/authors/verifies once; Haiku-class runtime delivers packs as "a classifier with charisma". Parameterized questions are sympy-judged — no model.
4. **"Strictly necessary" enforced by the justification test** + adversarial pruning pass + node contract (granularity) + embedding dedup registry.
5. **Scoping is interactive and happens before heavy work** (user selects primary categories first).
6. **Human structural review is a 2-minute smell-check, not curriculum approval** — user can only genuinely audit the bottom of the tree; automated verification is load-bearing up top. (Superseded the earlier idea of a full human review gate.)
7. **Runtime graph repair is in v1, with a deliberately high bar:** cheap model files reports only; adjudicator defaults to "no change"; addenda preferred; node insertion requires the justification test; >~2 insertions per tree = build-pipeline failure signal, fix upstream.
8. **Unlock status computed live, never stored** — the graph may change under the learner.
9. **FSRS, one global deck**, session-start reviews, mid-node interruptions default-off, **recall never blocks progression**.
10. **Test-out replaces adaptive placement in v1** (adaptive probe deferred to v1.5).
11. **Storage split:** markdown Obsidian-compatible vault for content (trunk = Karpathy brain), SQLite for state.
12. **Stack:** Tauri + React + TS, React Flow + ELK, KaTeX, sympy sidecar, ts-fsrs, Claude Agent SDK on the Claude Code subscription. **Builds must be resumable** (usage windows).
13. **v1 cuts:** visualisations, pomodoro/focus features, adaptive placement, citation crawling, API/commercial deployment.

**2026-07-19 — Loop-engineering audit patches.** Assessed the implementation layer against the loop-engineering framing (Ng's three-loop model; validation/stopping-criteria/intervention design). Verdict: the architecture already is loop engineering — tight execution loop for implementers, human loop at ticket level, external loop via the product's repair system — with one deliberate divergence retained: implementer autonomy is fenced to *execution within a ticket*, never scope, because correctness outranks autonomy for this product. Three gaps patched:

1. **Observation harness** (note 24 + ticket stub T-005): Playwright screenshot loop so UI implementers/verifiers can see the running app — closes the visual inner loop for Phase 3+.
2. **Loop health metrics** (note 24): session-log hook now tracks blocked-rate and rework-rate per ticket; rising blocked = tickets too vague (fix architect side), rising rework = fences too loose (fix template).
3. **Dogfooding cadence** (note 22): weekly real-node completion by the user from Phase 5, feeding the decisions log — the external loop, unautomatable by design (user's context advantage).

Also: Phase-0 tooling now spans two tickets, T-004 (guardrails) and T-005 (eyes).

**2026-07-23 — C1 SQLite Schema hardened.** {#C1-initial-2026-07-23}

Hardened the table sketch in [[09 Storage]] into the C1 contract (`Arbor Spec/21 Contracts/C1 SQLite Schema.md`). Machine-readable mirrors written to `contracts/schema.sql` and `contracts/migrations/0001_init.sql`. Key decisions:

1. **Singular table names** per [[20 Architecture#Naming conventions]] — `node` not `nodes`, `tree` not `trees`, etc.
2. **STRICT mode on all tables** — SQLite column-type enforcement without implicit coercions.
3. **`node.status` values are `not_started | in_progress | completed`** — never `locked` or `unlocked` (unlock is computed live from the graph, per the invariant in [[03 Graph Model]]).
4. **`schema_migrations.version` is INTEGER** — not TEXT — so it sorts numerically (version 10 > version 9) and is unambiguous. T-002 Steps updated to match.
5. **`schema_migrations` is in the migration file with `IF NOT EXISTS`** — the runner creates it as a bootstrap step before reading it, then the migration file's creation is a no-op on subsequent runs. This makes the migration file self-contained for test replay.
6. **Pragmas are per-connection, not in DDL** — `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL` are applied by `db::open_or_init` on every connection. WAL mode is sticky; foreign_keys must be re-applied per connection.
7. **`graph_log` is append-only** — enforced by code convention; no DDL prevents DELETE because SQLite lacks that mechanism cleanly.

**2026-07-23 — C2 Pack Schema hardened.** {#C2-initial-2026-07-23}

Hardened [[04 Node Pack Schema]] into the C2 contract (`Arbor Spec/21 Contracts/C2 Pack Schema.md`). Machine-readable mirrors written to `contracts/pack.schema.json` and `contracts/pack.d.ts`. Key decisions:

1. **`summary_for_context` cap is 800 characters** — sufficient for 2–3 dense sentences summarising the node; short enough that the cheap model's context is not dominated by any single node.
2. **`diagnostic` is exactly 10 items** (`minItems: 10, maxItems: 10` in JSON Schema) — 10 gives outcome coverage for re-teaching without verbatim repeats, and closes the open question on diagnostic bank size for v1.
3. **Hint ladder invariants (terminal `tell`, ≥1 misconception) are code-level, not JSON Schema** — JSON Schema 2020-12 cannot assert "last array element has property X" without verbose `if`/`then` constructs. The pack loader enforces these after schema validation.
4. **`schema_version: 1` is a const in JSON Schema** — a loader encountering any other value must reject the pack before reading any field.
5. **Addendum IDs follow `add-NNN` pattern** — sequential, unambiguous, visible in the vault filename.

**2026-07-23 — .claude/ tooling installed.** {#tooling-initial-2026-07-23}

Built the .claude/ infrastructure from [[24 Agent Tooling & Optimisation]] directly in this architect session (bootstrap exception — tooling cannot install itself). Files created:
- `.claude/agents/` — implementer (sonnet, restricted + contract-shield + spec-shield hooks scoped to agent), verifier (sonnet, disallowedTools: Edit/Write), architect (opus, full access)
- `.claude/skills/write-ticket/SKILL.md` — six ticket-quality style rules, STUB completion checklist
- `.claude/hooks/` — contract-shield, spec-shield, post-edit-lint, commit-gate, session-log
- `.claude/settings.json` — post-edit lint + session log on PostToolUse; commit gate on PreToolUse Bash

Contract-shield and spec-shield are scoped to the implementer and verifier subagent definitions (not in settings.json) so they do not fire in architect main-session work.

T-004 written as a queued ticket for verifier to confirm correctness of the installed files.

**2026-07-23 — C2 diagnostic field changed from exactly-10 to bank (minItems: 10).** {#C2-diagnostic-bank-2026-07-23}

Note 04 §4 specifies "a bank larger than 10 where possible so test-out and retakes don't repeat verbatim." The initial C2 contract contradicted this by enforcing exactly 10 items (`minItems: 10, maxItems: 10`). Changed to `minItems: 10` (bank of ≥10), removing `maxItems`. The runtime draws exactly 10 per attempt, mapped across `outcome_refs` so failures trigger targeted re-teach — this is a runtime invariant (note 05), not a schema constraint. Open question on diagnostic bank size (note 12) closed for v1: minimum bank size is 10.

Files changed: `contracts/pack.schema.json`, `contracts/pack.d.ts`, `Arbor Spec/21 Contracts/C2 Pack Schema.md`, `tests/T-003/pack-loader.test.ts`, `Arbor Spec/05 Teaching Runtime.md`.

**2026-07-23 — Contract-shield and spec-shield moved to settings.json; ARBOR_ROLE architect gate introduced.** {#hook-scope-fix-2026-07-23}

Empirical finding from a live top-level implementer session: all four write attempts succeeded unblocked — Edit to `contracts/schema.sql`, Bash `echo >>` to it, Edit to `tests/T-001/smoke.test.ts`, and Bash `sed -i` to it. Root cause: the shields were scoped to `.claude/agents/implementer.md` and `verifier.md`, so they fire only when invoked as subagents via the Task tool, never in top-level sessions regardless of verbal role declaration.

Fix:

1. Both shields moved to `settings.json` PreToolUse, firing in **all sessions** (top-level and subagent).
2. **Architect gate:** launch with `ARBOR_ROLE=architect claude` to bypass. Env-var only — a file marker could be forged by a Bash-capable implementer session.
3. **Bash bypass closed:** contract-shield and spec-shield now parse Bash command strings for write verbs (`>`, `>>`, `cp`, `mv`, `sed -i`, `tee`, `dd`, `truncate`, `python -c`, `git checkout --`, `git restore`) targeting protected paths.
4. **Verifier Bash guard:** verifier retains Bash for test running; the settings.json shields block any Bash writes to protected paths. Invariant: `git diff` must be empty after every verifier session.
5. The 2026-07-23 tooling entry above is superseded in its shield-placement claim; this entry takes precedence.

Files changed: `.claude/settings.json`, `.claude/hooks/contract-shield.sh`, `.claude/hooks/spec-shield.sh`, `.claude/agents/implementer.md`, `.claude/agents/verifier.md`, `CLAUDE.md`, `Arbor Spec/20 Architecture.md`, `Arbor Spec/24 Agent Tooling & Optimisation.md`, `tests/T-004/contract-shield-smoke.sh`.

**2026-07-23 — Vault path corrected in all prose references.** {#vault-path-fix-2026-07-23}

The actual on-disk path is `Arbor Spec/` (not `spec/` as written in the initial spec, CLAUDE.md, and note 24). All references updated: `CLAUDE.md`, `Arbor Spec/20 Architecture.md`, `Arbor Spec/24 Agent Tooling & Optimisation.md`. Hook scripts and smoke test already used the correct path and required no change.
