---
tags: [spec, memory, fsrs]
---

# 07 Memory & Recall

Retention rests on the proven trifecta already embedded in the design: **spaced repetition** (this note), **retrieval practice** (diagnostics, quick checks, [[08 Custom Tests]]), and **interleaving** (the DAG naturally mixes maths/physics strands). No invented schedules.

## FSRS integration

- Scheduler: **FSRS** (open-source, modern Anki algorithm). Do not hand-roll.
- **One global deck across all trees.** Memory doesn't care which tree taught you.
- Card = a diagnostic/quick-check question instance the learner has answered, linked to its node + template. Parameterized cards re-roll fresh values on each review (zero tokens); conceptual cards are judged against marking notes.
- Every answer anywhere — reviews, diagnostics, custom tests — feeds FSRS as a review event. A test *is* retrieval practice; never waste the signal.

## Session flow

- App open ⇒ small due-count badge. Session ideally starts by clearing dues. The resulting distribution (mostly recent nodes, occasionally old ones) is exactly the intended recall pattern, but *emergent from the algorithm* rather than hand-designed.
- **Mid-node random recall interruptions: toggleable, default off.** FSRS at session start captures the benefit; pop-quizzes mid-flow mostly capture annoyance.

## Decay & progression

- **Recall never blocks progression.** Completed is completed; a lapsed card just shows up more often. Re-locking on decay would make the app a nagging parent — progression friction is death for a momentum product.
- Soft nudge only: if a node's children have badly decayed recall, the node's summary screen shows a gentle "shaky foundations" warning with one-tap review. Advisory, never blocking.

## Trunk interaction

Completion writes the node's `summary_for_context` to the [[01 Concepts & Glossary|trunk]] with provenance (tree, date, diagnostic record). The trunk is the cross-tree baseline extension and the dedup registry's "known" set ([[02 Build Pipeline]]); FSRS state is the *liveness* signal on top of it.
