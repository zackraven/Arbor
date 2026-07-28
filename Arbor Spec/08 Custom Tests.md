---
tags: [spec, tests]
---

# 08 Custom Tests

Nearly free once packs exist: tests sample existing question banks.

## Configuration (per test)

- **Scope:** all completed nodes, or a user-highlighted selection of nodes.
- **Count:** user-set number of questions.
- **Difficulty:** easy | medium | hard — an *authored* property of each template ([[04 Node Pack Schema]]); hard means a harder *form*, not uglier numbers.

## Generation

- Sample templates from the selected nodes' banks matching the difficulty tag; re-roll parameterized templates with fresh values (deterministic, zero-token, sympy-checked). Conceptual questions drawn from banks and judged against marking notes (cheap model).
- Weighted sampling by FSRS "most in need of review" within scope is a nice default; pure-random as an option.

## Results

- Score + per-node breakdown; wrong answers link back to their node and segment for one-tap re-teach.
- Every answer feeds FSRS as a review event ([[07 Memory & Recall]]).
- Test history appears in the tree's stats tab ([[11 UI Spec]]).
