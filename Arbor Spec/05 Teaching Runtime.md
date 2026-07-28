---
tags: [spec, runtime, teaching]
---

# 05 Teaching Runtime

The runtime executes [[04 Node Pack Schema|packs]] conversationally. The teaching model is cheap (Haiku-class — [[10 Stack & Architecture]]) and deliberately narrow: **a classifier with charisma**. It delivers the script, classifies learner answers against pre-authored expected paths, picks the scripted response, and renders it warmly. It is not a playwright.

## Segment loop

For each segment in order:

1. Pose the segment `question`.
2. Learner attempts.
3. Cheap model classifies the attempt against `expected_paths` → delivers the scripted response.
4. If not yet arrived: descend the `hint_ladder` (probe → nudge → near-answer → tell). **Floor guarantee:** the ladder always ends by telling; a learner can never be stuck guessing. Failure does not exist in segments — only in the diagnostic.
5. Deliver `resolution`.
6. Run `quick_checks`; wrong answer on a parameterized check ⇒ offer instant re-roll ("same question, new values" — zero tokens) or brief scripted re-explanation.
7. Next segment.

## Tangents & questions (token policy)

- **In-scope** (this node + its children, whose compact summaries are already in context): answer freely.
- **Out-of-scope:** one-line answer + pointer — "this lives in node X; you'll get there." 
- **Escalation valve:** explicit user action ("ask the big model") sends the genuinely hard tangent to a strong model. Bounded, user-visible, never automatic.

## Off-layer confusion

If the learner's confusion is *below* the node's content (e.g. asks what ∂ means inside a Lagrangian node), the cheap model does **not** diagnose or fix the graph — it delivers the scripted grounding and files a [[06 Repair System|repair report]]. Detection is deliberately low-precision; the adjudicator supplies the judgment. Heuristic: a struggling learner engages *wrongly with the right concepts*; a gap-hitting learner engages *with the wrong layer entirely*.

## Diagnostic

- The pack carries a **bank of ≥10 diagnostic items** (`diagnostic` field in C2). Each item maps to one or more `outcome_refs`.
- The runtime draws **exactly 10 items per attempt**, sampling across outcome_refs so that all outcomes are represented. The bank is larger than 10 so test-out and retakes draw fresh samples without verbatim repeats.
- Mixed parameterized (sympy-judged, model-free) and conceptual (judged against `marking_notes`).
- Wrong ⇒ regenerated variant (fresh parameters / sibling question). Wrong again ⇒ **targeted re-teach** of the mapped segment only, then retry. Repeat until all 10 slots pass.
- "That was just a slip" ⇒ learner can simply re-roll and answer again; no ceremony.
- All 10 passed ⇒ node **completed**: summary written to trunk, FSRS cards created ([[07 Memory & Recall]]), graph updates, next nodes glow ([[11 UI Spec]]).

## Test-out

Any **unlocked** node can be attempted diagnostic-first, skipping teaching. Pass ⇒ completed identically. Purposes: honest trunk for already-known material; v1's replacement for adaptive placement; generates "unnecessary edge" evidence for repair. Same diagnostic, different door — near-zero build cost.

## Session shape

Session start: FSRS due-cards review offered first ([[07 Memory & Recall]]). Then the learner picks any glowing node. Mid-node random recall interruptions are **off by default** (toggleable).
