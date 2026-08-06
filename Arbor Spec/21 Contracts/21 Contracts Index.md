---
tags: [spec, implementation, contracts]
---

# 21 Contracts — Index

> Implementation layer, part 2 of 4. **Contracts are frozen interfaces.** Changing one requires an ARCHITECT session + a dated entry in [[12 Open Questions & Decisions Log]]. Implementers may never edit anything in this folder. Each contract has a machine-readable mirror in `repo:/contracts/` which code imports; the note here is the human-annotated source.

| id | Contract | Mirrors to | Freeze level |
|---|---|---|---|
| C1 | [[21 Contracts/C1 SQLite Schema]] | `contracts/schema.sql` + migrations | **Hard** — freeze first |
| C2 | [[21 Contracts/C2 Pack Schema]] | `contracts/pack.schema.json` + generated `.d.ts` | **Hard** — freeze first |
| C3 | [[21 Contracts/C3 Tauri Commands]] | `contracts/commands.d.ts` | **Firm** — Phase 2 command set hardened 2026-08-05 |
| C4 | [[21 Contracts/C4 Sympy Sidecar Protocol]] | `contracts/sidecar.schema.json` | Firm |
| C5 | [[21 Contracts/C5 Orchestrator Jobs]] | `contracts/jobs.d.ts` | **Warm** — expect revision through Phase 4–5; tighten as phases complete |
| C6 | [[21 Contracts/C6 Vault Layout]] | (documented paths; enforced by vault module tests) | Firm |
| C7 | [[21 Contracts/C7 Design Tokens]] | `contracts/tokens.ts` | **Firm** — Phase 3 token set established 2026-08-06 |

Freeze guidance (from planning): harden the boundaries we're most sure of (pack schema, DB) first; keep orchestrator internals warm until the build pipeline has run for real.

## Contract note format

Each contract note contains: purpose (2–3 lines) → the full verbatim definition (DDL / JSON Schema / TS types) → invariants prose → changelog table (date, change, decisions-log link).

## Seeds (to be hardened by the first architect sessions)

- **C1** hardens the table sketch in [[09 Storage]] into real DDL + a numbered migration series. Invariants to encode: unlock is never a table; `reviews.source ∈ {review, diagnostic, test}`; `edges` carry `justification` NOT NULL; `graph_log` append-only.
- **C2** hardens [[04 Node Pack Schema]] into JSON Schema: segments, expected_paths (enumerated kinds incl. `off_layer`), hint_ladder (min 1 hint + mandatory terminal `tell`), templates (`answer_expr` sympy-parseable, `difficulty` enum, generation constraints), diagnostic slots→outcome mapping, `summary_for_context` max length, addenda array.
- **C3** starts with Phase-1/2 commands only (db init/query surface, vault read, unlock computation, graph fetch) and grows per phase; every command's error codes enumerated.
- **C4**: stateless request/response JSON over stdio: `{kind: check_expr|eval_template|equivalence, …}` → `{ok, verdict, detail}`; timeout + restart policy.
- **C5**: job = `{id, type: build|teach|repair, tree_id, checkpoint, status}`; resumability semantics; retry counts; model-tier field per job step (ties to [[24 Agent Tooling & Optimisation]]).
- **C6**: the vault layout block from [[09 Storage]], verbatim, plus filename slug rules.
