---
tags: [spec, repair, runtime]
---

# 06 Repair System

The graph is a living artifact, but **repair must be rare to mean anything**. Struggle is supposed to happen — it is half the point of Socratic teaching. An over-eager repair loop converts "this is hard" into remedial node bloat and undermines build discipline. Design intent: build gets ~95% right; structural review catches eyeballable weirdness; **learning itself is the final verifier** — the only one with ground truth.

## Hard rules

1. **The cheap model can never create anything.** Its only power is filing a [[01 Concepts & Glossary|repair report]] (evidence: suspected missing concept + the relevant exchange). Detection and repair are fully decoupled.
2. **Repair triggers on accumulated evidence, not single events.** Invoke the adjudicator only when: the learner explicitly states they've never seen the concept, **or** the same missing-concept report fires multiple times within a node, **or** diagnostic failures map to one specific gap rather than general shakiness.
3. **The adjudicator's default verdict is "no change."** It is framed as a skeptic, not a fixer.

## Remedies, in ascending cost (adjudicator must exhaust each before the next)

1. **Nothing** — noise: bad hint, tired learner, awkward wording. (Persistently awkward wording ⇒ flag the pack for re-authoring, which is a content fix, not a graph fix.)
2. **[[01 Concepts & Glossary|Addendum]]** — patch a couple of paragraphs of extra grounding into the pack. Cheap, no graph mutation, no progression debt. *Deliberately easy to grant*: absorbs the ~80% of gaps that are really "the pack assumed slightly too much."
3. **Node/edge insertion** — only if the concept passes the same [[01 Concepts & Glossary|justification test]] as at build time: the parent's core derivation genuinely cannot be followed without it, and it is not already covered by an existing node the learner skimmed. Inserted nodes get authored packs, `provenance: inserted_by_repair`, and a cycle check ([[03 Graph Model]]).

## The reverse signal

Breezing through a node's diagnostic via [[05 Teaching Runtime#Test-out|test-out]] without its teaching is evidence an edge was unnecessary or the trunk was undersold. Same report → adjudicator pathway; possible remedy is edge removal (with the same skeptical default).

## Transparency & health metric

- Every insertion is surfaced to the user: "added *Contour Integration* below *Propagators* — here's why" (adjudicator rationale, from the graph changelog).
- **Health metric:** more than ~2 insertions over a tree's lifetime ⇒ the build pipeline is failing for that subject area; the fix is upstream in the decomposition prompts, **not** more repair. Track insertions per tree in stats.
