---
tags: [spec, glossary]
---

# 01 Concepts & Glossary

Single source of truth for terminology. Other notes link here; they do not redefine.

| Term | Definition |
|---|---|
| **Tree** | One learning project (e.g. "Quantum Field Theory"). Despite the name, structurally a **DAG**. Owns a graph, node packs, and per-tree stats. |
| **DAG** | Directed acyclic graph of nodes. Edges point parent → child, meaning "parent requires child". Shared prerequisites are one node with multiple parents — nodes are never duplicated. |
| **Node** | The atomic learnable unit: one core concept, 3–7 learning outcomes, ~30–60 min. Schema in [[04 Node Pack Schema]]. |
| **Top bubble** | The scoped target: 3–6 primary categories describing what expertise in the chosen area looks like, grounded in scraped papers. The tree is built downwards from the categories the user selects. |
| **Baseline** | The knowledge floor the tree builds down to and stops. Defined by a **baseline manifest** (explicit topic list, e.g. an A-level spec) plus the learner's **trunk**. |
| **Baseline manifest** | Machine-readable topic list defining a preset baseline (e.g. A-level Maths + Physics). Used as the termination test during decomposition. |
| **Trunk** | The learner's global, cross-tree knowledge bank: every completed node's compact summary + provenance. Acts as (a) baseline extension for new trees, (b) the dedup registry's "already known" set, (c) a human-readable Karpathy-brain vault ([[09 Storage]]). |
| **Pack** | The full pre-authored artifact for one node: outline, Socratic segments, question templates, diagnostic bank, compact summary. See [[04 Node Pack Schema]]. |
| **Segment** | One scripted Socratic beat inside a pack: question → attempt → evaluation → hint ladder → resolution → quick checks. |
| **Hint ladder** | The finite, scripted sequence of escalating hints in a segment: probe → nudge → near-answer → tell. Guarantees a floor: the learner can never be stuck guessing. |
| **Expected-answer paths** | Pre-authored classifications of likely learner responses to a segment question (correct, correct-alternative-route, named misconceptions, off-layer confusion), each with a scripted reply. |
| **Diagnostic** | The ~10-question gate at the end of a node. Passing it (all questions eventually correct) completes the node. Also the **test-out** door. |
| **Test-out** | Attempting a node's diagnostic without doing the teaching. Passing completes the node identically. |
| **Question template** | A parameterized question authored once with a symbolic answer expression; re-rolled with fresh values deterministically (zero tokens) and checked by sympy. Tagged easy/medium/hard. |
| **Justification test** | The necessity criterion for edges: a proposed prerequisite is only valid if the model can state the specific claim/step in the parent that cannot be followed without it. Unjustifiable edge ⇒ no edge. |
| **Node contract** | The mechanical granularity rule: one core concept, 3–7 outcomes, learnable in ~30–60 min given completed children. Violations force a split. |
| **Concept registry** | Embedding-indexed registry of all node names + one-line definitions (current tree + trunk) used to dedup before node creation. |
| **Repair report** | Evidence filed by the cheap teaching model that a learner appears to be missing an assumed concept (or that a node was redundant). Input to the [[06 Repair System]]. |
| **Adjudicator** | The skeptical strong-model job that reviews accumulated repair reports. Default verdict: no change. Remedies in ascending cost: nothing → pack addendum → node/edge insertion. |
| **Addendum** | A small patch appended to a pack (e.g. two paragraphs of extra grounding). The cheap, preferred repair remedy. |
| **FSRS** | Free Spaced Repetition Scheduler — the open-source algorithm scheduling all recall. One global deck across all trees. See [[07 Memory & Recall]]. |
| **Unlock** | A node is unlocked when all its children are completed. Computed live from the graph, never stored as a static list (the graph can change — see [[03 Graph Model]]). |
| **Build** | The whole pipeline run producing a tree: scoping → scrape → decomposition → validation → authoring → verification. Resumable at every stage. See [[02 Build Pipeline]]. |
