---
tags: [spec, pipeline, build]
---

# 02 Build Pipeline

Stages run in order; every stage writes its artifacts to disk before the next begins, making the whole build **resumable** ([[09 Storage]]). Model-tier assignments in [[10 Stack & Architecture]].

## Stage 0 — Subject input

User enters a subject string (e.g. "quantum field theory") and selects a baseline: a preset [[01 Concepts & Glossary|baseline manifest]] (v1 ships with *A-level Maths + Physics* and *Year 1 UK Physics BSc*) — automatically extended by the learner's [[01 Concepts & Glossary|trunk]].

## Stage 1 — Scoping (interactive, before heavy work)

Strong model proposes **3–6 primary categories** for the top bubble, each with a one-paragraph description of what expertise in it looks like. The user selects the categories to pursue. Unselected categories remain visible in the top bubble but are never decomposed (until later requested). *No expensive work happens before this choice.*

## Stage 2 — Paper scrape (bounded)

Per selected category, fetch **15–30 papers** via the **Semantic Scholar API**: foundational (sorted by citation count / seminal status) + recent breakthroughs. Papers are **evidence and flavour, not structure**:

- ground the frontier descriptions of top-level nodes ("why this matters / where the field is"),
- populate the technical-terms dictionary,
- provide a rough historical timeline for the category.

Papers are **never** asked "what are the prerequisites" — prerequisite structure comes from curriculum knowledge (standard textbooks/syllabi are in-model; optionally cross-checked against real ToCs). No citation-graph crawling in v1.

## Stage 3 — Decomposition

Recursive, top-down from each selected category's top-level nodes. For each node, the decomposer proposes direct prerequisites — **the level directly below only**, never skipping to basics. Three enforced disciplines:

1. **[[01 Concepts & Glossary|Justification test]]** — each proposed edge must name the specific claim/derivation step in the parent that fails without the child. No justification, no edge. A separate adversarial **pruning pass** re-reads every justification and votes keep/cut.
2. **[[01 Concepts & Glossary|Node contract]]** — one concept, 3–7 outcomes, ~30–60 min. An outcome-count tripwire mechanically forces splits of oversized nodes.
3. **Dedup via the [[01 Concepts & Glossary|concept registry]]** — before creating any node, embed its name + one-line definition and match against the current tree **and the trunk**. Close match ⇒ link to the existing node instead. This is also the mechanism for cross-tree reuse.

**Termination:** at each step, test the proposed concept against the baseline manifest + trunk; at/below baseline ⇒ stop, connect to the trunk. **Safety rail:** depth limit ~10–12; hitting it is a build *error* surfaced for inspection, never silent truncation.

Output: validated graph JSON ([[03 Graph Model]]).

## Stage 4 — Structural review (human, ~2 min)

The pre-completion graph is shown in the normal graph UI with merge/rename/delete affordances. Framed explicitly as **"flag anything that looks weird"**, *not* "approve the curriculum":

- **Bottom half** (near baseline): the user can genuinely judge correctness — errors here are the most damaging and the most visible.
- **Top half**: smell-check only — duplicate-looking names, textbook-sized node titles, wildly uneven chain depths, orphans. Graph-shape bugs, not physics bugs.

Because the user often *cannot* audit the upper tree, automated verification (Stage 3 pruning, Stage 5 verification, runtime [[06 Repair System|repair]]) is load-bearing there, not optional.

## Stage 5 — Node authoring

Runs in **topological order, bottom-up**. Each node's authoring prompt includes its children's compact summaries, so a pack can only assume what the learner will actually have. Produces the full [[04 Node Pack Schema|pack]].

**Verification pass:** a separate strong-model instance solves every question cold and walks every Socratic expected-answer path; disagreements ⇒ flagged for regeneration. For maths-heavy templates, sympy validates symbolic answers across random parameter draws (zero tokens).

## Resumability & progressive availability

Every artifact persists as produced: scope decision → paper set → graph JSON → per-node packs. The orchestrator resumes mid-build after interruption (including Claude Code usage-window exhaustion). UX consequence: the tree appears after Stage 3–4 and nodes "fill in" as authored; bottom nodes are learnable while upper nodes are still baking.

## Cost shape (mental model)

A selected category ≈ 40–80 nodes. Decomposition/validation is cheap (structure, not prose). Authoring dominates: several k tokens in/out per node, ×2 for verification. A full build is a kick-off-and-let-run job, possibly spanning usage windows — hence resumability is a hard requirement, not a nicety.
