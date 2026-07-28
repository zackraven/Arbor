---
tags: [spec, implementation, plan]
---

# 22 Build Plan

> Implementation layer, part 3 of 4. Ordered phases; every phase ends with something runnable. Tickets in [[23 Tickets]] reference their phase. An architect session generates each phase's tickets shortly before the phase starts (not months ahead — later phases will be revised by what earlier ones teach).

## Phase 0 — Bootstrap *(tickets T-001…)*
Repo scaffold (Tauri + React + TS building and launching), CI running tests, `.claude/` tooling installed ([[24 Agent Tooling & Optimisation]]), contracts folder wired.
**Runnable:** empty app opens instantly; `pnpm test` green.

## Phase 1 — Storage & Contracts *(T-002…)*
C1 schema + migrations; C2 pack schema + validator; vault module (C6) reading/writing trunk + tree folders; fixture packs.
**Runnable:** CLI-level round-trip — fixture pack validates, loads, DB migrates from zero.

## Phase 2 — Graph core
Graph model in DB; live unlock computation; graph_log; fixture tree (~60 nodes, hand-made realistic shape).
**Runnable:** unlock computation demonstrably correct on fixture tree, incl. mutation-under-learner cases.

## Phase 3 — Graph UI on fake data
React Flow + ELK layout, node states/glow, summary panel, tree list. **This is the "looks pretty" de-risk** — layout quality judged on the fixture tree before any pipeline exists.
**Runnable:** clickable, smooth fixture tree; the vibe check.

## Phase 4 — Build pipeline
Orchestrator (C5) with checkpoint/resume; scoping flow; Semantic Scholar scrape; decomposition + justification test + pruning; concept registry; structural-review mode; authoring + verification passes; sympy sidecar (C4).
**Runnable:** a real tree built end-to-end for one small category; survives an interrupted build.

## Phase 5 — Teaching runtime
Segment loop, classification against expected paths, hint ladders, tangent policy + escalation valve, diagnostics + test-out, repair report filing.
**Runnable:** complete a real node start-to-finish; test-out a known node.

## Phase 6 — Memory & repair
FSRS deck + session flow; trunk writing on completion; repair adjudicator + addenda/insertion (+ UI surfacing); decay nudges.
**Runnable:** multi-day usage loop is real.

## Phase 7 — Tests & stats
Custom test builder; stats tab; polish pass on the whole surface.
**Runnable:** v1 feature-complete.

## External loop — dogfooding cadence

From **Phase 5** onward, the user completes **real learning nodes weekly** (a genuine subject, not fixtures). This is not QA; it is the one loop that cannot be automated — the user is the only physicist and the only real learner in the system, and holds context no agent has (what confusion feels like, whether the Socratic floor actually lands, whether "smooth" is smooth). Observations feed back through the decisions log in [[12 Open Questions & Decisions Log]] like any other loop output: symptom → suspected layer (pack authoring / runtime / repair / UI) → spec change or open question. Build phases 6–7 expect revision from this loop by design.

## Sequencing rationale

Storage before UI (contracts harden earliest where we're surest); UI on fake data before the pipeline (the aesthetic requirement is high-risk and cheap to test early); pipeline before runtime (runtime consumes packs); FSRS after runtime (needs real completions to mean anything).
