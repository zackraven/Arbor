---
tags: [spec, ui]
---

# 11 UI Spec

Aesthetic principles: **minimalistic, smooth, fast.** No lag anywhere; transitions subtle; density low. If a screen feels busy, it's wrong.

## Screens

### 1. Tree list (home)
- List/grid of the user's trees ("Quantum Field Theory", …) with a small progress ring and due-count badge (FSRS, global).
- New-tree action ⇒ launches the [[02 Build Pipeline|build flow]] (subject input → scoping conversation → build progress).
- Builds in progress show live stage/percentage; tree is openable as soon as the graph exists, with nodes filling in.

### 2. Graph view (per tree)
- Full DAG from trunk to top bubble, layered layout (ELK), pan/zoom.
- **Node states:** completed = filled/outlined in the completion colour; **unlocked-next = glow**; locked = muted; pack-pending = subtle "baking" indicator; repair-inserted = one-time highlight with rationale toast.
- Click any node ⇒ **summary panel**: `summary_for_learner`, outcomes, child status, decayed-children "shaky foundations" nudge if applicable ([[07 Memory & Recall]]).
- *Enter learning mode* button: enabled only for unlocked or completed nodes (revisit allowed). **No skipping** — locked nodes show what still blocks them.
- Test-out button on unlocked nodes ([[05 Teaching Runtime#Test-out]]).
- Top bubble renders as the crown of the graph: selected categories expanded; unselected categories visible but dormant, with an "expand this area" action (triggers incremental build).
- Structural-review mode ([[02 Build Pipeline#Stage 4]]): same view pre-completion with merge/rename/delete affordances.

### 3. Learning view (per node)
- Clean chat-style Socratic interface; KaTeX everywhere; streaming responses.
- Persistent slim header: node title, segment progress dots, exit-and-resume (state saved mid-node).
- Answer input supports maths entry (KaTeX preview).
- Quick actions: "just a slip — re-roll", "I've seen this before" (accelerates), "ask the big model" (escalation valve, visibly distinct).
- Diagnostic mode: same surface, question counter, per-slot status.

### 4. Stats tab (per tree)
- Timeline of nodes completed; overall progress bar (completed / total in selected scope); streaks; time-in-learning; test history ([[08 Custom Tests]]); repair-insertion count (the [[06 Repair System|health metric]]).

### 5. Recall surface (global)
- Due-cards session runner, same learning-view chrome. Entry point from home badge and session start.

### 6. Custom test builder (per tree)
- Node multi-select (on the graph itself — nicer than a list), count, difficulty, go. Results screen links wrong answers back to nodes.

## Feel

- Dark-first, restrained palette; the graph is the hero. Colour is meaning (state), not decoration.
- All frequent interactions (open node, re-roll, navigate) must be model-free and instant; model latency only ever appears inside conversation streaming.
