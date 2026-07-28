---
tags: [spec, vision]
---

# 00 Vision

## The problem

It is easy to be *interested* in an area of physics and have no idea how to get from where you are to actually understanding it — nor how far away you are. The path from A-level knowledge to reading QFT papers is invisible. Courses give you a fixed path; textbooks give you one author's path; neither shows you **your** path from **your** baseline, nor your live position on it.

## The product

Arbor turns "expertise in area X" into an explicit, visual, traversable structure:

- The target area is scoped into a **top bubble** of primary categories (grounded in foundational + breakthrough papers).
- A **prerequisite DAG** is built downwards from those targets — each node a small, ~30–60 min learnable chunk — terminating at the learner's **baseline**.
- Each node is taught in a **semi-Socratic** conversational loop, gated by a **diagnostic**, and everything learned feeds a global **trunk** (persistent knowledge bank) and a spaced-repetition deck.
- Progress is *visible*: you can always see exactly where you stand between your baseline and expertise.

See [[01 Concepts & Glossary]] for all bolded terms.

## Design principles

1. **Build expensive, teach cheap.** Strong models construct and author once; a cheap model delivers. The teacher is an actor with a script, not a playwright. ([[02 Build Pipeline]], [[05 Teaching Runtime]])
2. **Nothing taught can be wrong.** Correctness comes from pre-authoring + adversarial verification + symbolic (sympy) checking, not from trusting runtime generation. ([[04 Node Pack Schema]])
3. **Strictly necessary only.** Every prerequisite edge must survive the justification test. Trees stay lean. ([[02 Build Pipeline]])
4. **The graph is a living artifact.** The build gets ~95% right; structural review and runtime [[06 Repair System|repair]] handle the rest. Repair is rare by design.
5. **Momentum over friction.** Socratic segments always have a floor (you can never get stuck guessing); recall never blocks progression; the UI is minimal, smooth, fast.
6. **Small nodes.** A node is "basic partial differentiation", never "rotational mechanics". A focused day clears many nodes; a spare half-hour clears one.

## v1 scope

**In:** DAG build pipeline; node packs; Socratic teaching runtime; diagnostics + test-out; FSRS recall; custom tests; graph UI + stats tab; global trunk; runtime repair (high-bar); resumable builds; Claude Code subscription as the model backend.

**Non-goals / deferred:**
- Custom visualisations / interactive diagrams in teaching (v2+)
- Pomodoro, focus music, focus psychology features (v2)
- Adaptive binary-search placement test (v1.5 — replaced in v1 by preset baselines + diagnostic test-out)
- Citation-graph crawling beyond the bounded paper scrape
- API-based commercial deployment (v1 runs on the developer's Claude Code subscription)
- Subjects outside physics/maths (the design generalises, but v1 tunes prompts for physics/maths)
