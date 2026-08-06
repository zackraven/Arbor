---
id: T-011
phase: 3
depends_on: [T-013]
---

# T-011 — Node visual states and click-to-select interaction

## Goal
Nodes display distinct visuals per unlock status — green completed, blue glow unlocked, amber in-progress, muted locked. Clicking a node toggles selection in the graph store.

## System prerequisites
None beyond T-010 prerequisites (already installed).

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C7 Design Tokens]] (mirror: `contracts/tokens.ts`) — state-to-visual mapping table
- Contract: [[21 Contracts/C3 Tauri Commands]] (mirror: `contracts/commands.d.ts`) — `UnlockStatus` type
- Skill: `.claude/skills/frontend-design/SKILL.md`

## Files
**Create:** none
**Modify:** `src/graph/arbor-node.tsx`, `src/graph/arbor-node.module.css`, `src/graph/graph-view.tsx`, `src/graph/use-graph-loader.ts`, `tsconfig.json` (remove `tests/T-011` from the `exclude` array)

## Steps

1. **Modify `tsconfig.json`** — remove `"tests/T-011"` from the `exclude` array. This allows tsc to type-check the T-011 test file.

2. **Modify `src/graph/use-graph-loader.ts`** — in the non-Tauri (fixture) branch, instead of setting all unlock statuses to `'locked'`, set mixed statuses so all four visual states are visible:
   - The first 5 nodes in the fixture's node array: set to `'completed'`
   - The 6th node: set to `'in_progress'`
   - Nodes whose all children (per the fixture's edges, where the node is the parent and children are targets) have `'completed'` status AND the node itself is not in the completed/in-progress set above: set to `'unlocked'`
   - All remaining nodes: `'locked'`

   This simulates a learner who has completed 5 leaf nodes, is working on one, and has unlocked the next available nodes. The exact node IDs depend on the fixture data — use the array indices, not hardcoded IDs.

3. **Modify `src/graph/arbor-node.module.css`** — add CSS classes for each unlock status. Nodes are circles (T-013 established `border-radius: 50%`). Each class sets the border colour and any additional effects:
   - `.completed` — border-color: `var(--color-completed)`, label color: `var(--color-text-primary)`
   - `.unlocked` — border-color: `var(--color-unlocked)`, label color: `var(--color-text-primary)`, box-shadow: `0 0 var(--color-glow-radius) var(--color-glow-color)` (the blue glow effect)
   - `.inProgress` — border-color: `var(--color-in-progress)`, label color: `var(--color-text-primary)`
   - `.locked` — border-color: `var(--color-locked)`, label color: `var(--color-text-secondary)` (dimmed)
   - `.selected` — outline: `2px solid var(--color-selected-ring)`, `outline-offset: 2px`
   - Hover effect on all states: background shifts to `var(--color-surface-alt)`, transition using `var(--motion-duration-fast)` and `var(--motion-easing)`

4. **Modify `src/graph/arbor-node.tsx`** — apply the status-dependent CSS class:
   - Read `data.status` to determine which CSS class to apply (`.completed`, `.unlocked`, `.inProgress`, or `.locked`).
   - Add `selectedNodeId` from the graph store (use `useGraphStore` with a selector: `useGraphStore((s) => s.selectedNodeId)`). If `selectedNodeId` matches the node's id, also apply the `.selected` class.
   - The node's `id` is available via the `id` prop from React Flow's `NodeProps`.
   - Combine CSS module classes: use template literals or array join, e.g. `className={[styles.node, styles[statusClass], isSelected && styles.selected].filter(Boolean).join(' ')}`.
   - Update `ArborNodeData` type if needed to include the status field (it should already have `status: UnlockStatus` from T-010).

5. **Modify `src/graph/graph-view.tsx`** — add click-to-select:
   - Add an `onNodeClick` handler to `<ReactFlow>`: `onNodeClick={(_event, node) => selectNode(node.id === selectedNodeId ? null : node.id)}` (toggle: click selected node again to deselect).
   - Get `selectNode` and `selectedNodeId` from the graph store.
   - Also add `onPaneClick` handler to deselect: `onPaneClick={() => selectNode(null)}`.

## Acceptance criteria
- [ ] `tests/T-011/visual-states.test.tsx` passes — nodes render with correct status-dependent CSS classes; clicking toggles selection
- [ ] `tests/T-009/token-lint.test.ts` still passes — no hardcoded colours introduced
- [ ] `MSYS_NO_PATHCONV=1 pnpm observe --route / --ticket T-011 --out .claude/session-logs/T-011-observe` produces a non-empty screenshot PNG showing visually distinct node states (green, blue glow, amber, gray)
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not implement the summary panel — that is T-012.
- Do not add any new React components or files.
- Do not add animation beyond the hover transition specified in Step 2.
- Do not edit `contracts/tokens.ts`, `contracts/commands.d.ts`, or any file in `Arbor Spec/`.
- Do not edit any test file or `src/tokens.css` or `src/graph/layout-engine.ts` or `src/state/graph-store.ts`.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners for diagnostics or version checks. bash-guard denies the command class regardless of argument content. To check an installed package version use `pnpm list <pkg>`; to read a version field use the `Read` tool on `package.json` or `node_modules/<pkg>/package.json`.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

## Verification
