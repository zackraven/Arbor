---
tags: [spec, content, schema]
---

# 04 Node Pack Schema

The **pack** is the full pre-authored artifact for one node — produced at [[02 Build Pipeline#Stage 5 — Node authoring|build Stage 5]], executed by the cheap model at runtime ([[05 Teaching Runtime]]). Principle: **as little as possible is improvised at teach time.**

## Contents

### 1. Overview
- `summary_for_learner` — what this node is, why it matters, shown on the node's summary screen before entering learning mode.
- `outline` — the teaching plan: ordered list of segments with one-line intents.
- `assumed_children` — the compact summaries of all child nodes (frozen at authoring time; this is *all* the pack may assume).

### 2. Socratic segments (ordered)
Each **segment**:
- `intent` — the single connection/idea this segment builds.
- `question` — the opening Socratic question.
- `expected_paths` — pre-authored classifications with scripted responses:
  - correct
  - correct via alternative route
  - named common misconceptions (1–3, each with a targeted scripted reply)
  - **off-layer confusion** — learner is confused *below* this node's content ⇒ scripted gentle grounding + file a [[06 Repair System|repair report]]
- `hint_ladder` — probe → nudge → near-answer → **tell**. Finite and always ends in telling: the floor guarantee. Socratic method is how you *arrive*, never a gate you can fail.
- `resolution` — the canonical explanation of the connection, delivered after the learner arrives (or is told).
- `quick_checks` — 1–3 short questions confirming the segment landed before moving on.

### 3. Question templates
Parameterized questions used in quick checks, the diagnostic, and [[08 Custom Tests]]:
- `stem` with `{parameters}` and generation ranges/constraints
- `answer_expr` — symbolic answer expression, **sympy-checkable**; regeneration with fresh values is deterministic and zero-token
- `marking_notes` — for conceptual/free-text questions the cheap model judges against these notes (no template maths involved)
- `difficulty` — easy | medium | hard, authored explicitly; the hard variant should be a genuinely harder *form* (multi-step, combined concepts), not just uglier numbers
- `bridge` flag — optional questions exercising connections *between* sibling children merging into this node

### 4. Diagnostic bank
~10 slots, each mapped to specific outcomes/segments (so failures trigger *targeted* re-teach, not whole-node repeats). Mix of parameterized (sympy-judged) and conceptual (cheap-model-judged against marking notes). Bank is larger than 10 where possible so test-out and retakes don't repeat verbatim.

### 5. Compact summary
`summary_for_context` — the dense form of "what a learner who completed this node knows". Written into the trunk on completion; consumed by parent packs' `assumed_children`, tangent answering, and future trees' dedup/baseline checks. Keep it small — it is loaded into contexts constantly.

### 6. Addenda (post-build, appended by repair)
Ordered list of small patches granted by the [[06 Repair System|adjudicator]]. Delivered by the runtime as extra grounding where the addendum specifies.

## Verification requirements (build-time, mandatory)
- Second strong-model instance solves every template and quick-check cold; walks every expected path. Disagreement ⇒ regenerate.
- sympy consistency check of every `answer_expr` across random parameter draws.
- Pack may only reference concepts present in `assumed_children` or the node itself — a lint pass checks this; violations are authoring errors.
