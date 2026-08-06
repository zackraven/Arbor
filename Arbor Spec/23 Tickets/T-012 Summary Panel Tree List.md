---
id: T-012
phase: 3
status: queued
depends_on: [T-011]
---

# T-012 — Summary panel and tree list

## Goal
Clicking a node opens a summary panel showing title, outcomes, and child status. The home screen shows a tree list with progress rings. Simple conditional rendering in App.tsx — no router.

## System prerequisites
None beyond T-010 prerequisites (already installed).

## Context links (implementer may read ONLY these)
- Contract: [[21 Contracts/C7 Design Tokens]] (mirror: `contracts/tokens.ts`)
- Contract: [[21 Contracts/C3 Tauri Commands]] (mirror: `contracts/commands.d.ts`) — `NodeDetail`, `TreeSummary`, `UnlockStatus`
- Skill: `.claude/skills/frontend-design/SKILL.md`
- Architecture: [[20 Architecture#Repository layout]], [[20 Architecture#Module boundaries]]

## Files
**Create:** `src/graph/summary-panel.tsx`, `src/graph/summary-panel.module.css`, `src/tree-list.tsx`, `src/tree-list.module.css`, `src/progress-ring.tsx`, `src/progress-ring.module.css`, `src/app.module.css`, `src/state/tree-store.ts`
**Modify:** `src/App.tsx`, `src/graph/graph-view.tsx`, `src/graph/graph-view.module.css`, `src/graph/arbor-node.tsx` (add `data-testid`), `tsconfig.json` (remove `tests/T-012` from the `exclude` array)

## Steps

1. **Modify `tsconfig.json`** — remove `"tests/T-012"` from the `exclude` array. This allows tsc to type-check the T-012 test files.

2. **Create `src/state/tree-store.ts`** — zustand store for tree-level navigation:
   ```typescript
   import { create } from 'zustand';

   interface TreeState {
     selectedTreeId: string | null;
     selectTree: (id: string | null) => void;
   }

   export const useTreeStore = create<TreeState>((set) => ({
     selectedTreeId: null,
     selectTree: (selectedTreeId) => set({ selectedTreeId }),
   }));
   ```

3. **Create `src/progress-ring.tsx`** — an SVG progress ring component:
   - Props: `{ completed: number; total: number; size?: number }`.
   - Default `size` to the token value `tokens.progressRing.size` (import from `contracts/tokens.ts`).
   - Renders an SVG circle with a stroke-dasharray animation showing the completion fraction.
   - Track colour: `var(--progress-ring-track-color)`. Fill colour: `var(--progress-ring-fill-color)`.
   - Stroke width: `var(--progress-ring-stroke-width)` — but since SVG attributes need numeric values, import `tokens.progressRing.strokeWidth` from the contract for the SVG `strokeWidth` attribute.
   - Centre text: `completed/total` in `var(--typography-font-size-xs)`.
   - Export: `export default function ProgressRing(props: ProgressRingProps)`.

4. **Create `src/progress-ring.module.css`** — styles for the progress ring. Text colour: `var(--color-text-primary)`. No hardcoded colours.

5. **Create `src/tree-list.tsx`** — the tree list (home) view:
   - In non-Tauri mode: create a single mock `TreeSummary` from the fixture data — `{ id: 'classical-to-lagrangian-mechanics', title: 'Classical Mechanics → Lagrangian Mechanics', node_count: <from fixture>, completed_count: 5, version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }`. Use the fixture's actual node count for `node_count`.
   - In Tauri mode: call `listTrees()` from `src/api/tauri-commands.ts`.
   - Detect Tauri mode the same way as `use-graph-loader.ts` (`window.__TAURI_INTERNALS__`).
   - Render each tree as a card with: title, progress ring, node count text. Use CSS module styles.
   - On card click: call `useTreeStore.getState().selectTree(tree.id)`.
   - Title "Your Trees" at the top. If no trees, show "No trees yet."
   - Export: `export default function TreeList()`.

6. **Create `src/tree-list.module.css`** — styles for the tree list. Card background: `var(--color-surface)`. Border: `var(--color-border)`. Hover: `var(--color-surface-alt)`. All spacing via token custom properties. The list should be centred on screen with a reasonable max-width (e.g. `600px` — use a raw value here, it's a layout constraint not a colour/spacing token).

7. **Create `src/graph/summary-panel.tsx`** — side panel showing node details:
   - Reads `selectedNodeId` from the graph store.
   - If no node selected: render nothing (return `null`).
   - If a node is selected: look up the node data from `useGraphStore((s) => s.nodes)` and the unlock status from `useGraphStore((s) => s.unlockStatuses)`.
   - In non-Tauri mode: display title, one-liner, category, status badge, and outcomes (from the fixture data — outcomes are in the fixture JSON's `outcomes` array per node. Since the graph store's `GraphNode` type doesn't include outcomes, read them from the fixture data directly via a static import of `large-tree.json`).
   - In Tauri mode: call `getNode(selectedNodeId)` from `src/api/tauri-commands.ts` to get the full `NodeDetail` including outcomes.
   - Also show child nodes: filter the graph store's edges where `parent_id === selectedNodeId`, look up each child node, display their titles and unlock statuses as a small list.
   - Close button: calls `selectNode(null)`.
   - The panel slides in from the right side (absolute/fixed positioned, width ~320px).
   - Export: `export default function SummaryPanel()`.

8. **Create `src/graph/summary-panel.module.css`** — styles for the summary panel. Background: `var(--color-surface)`. Border-left: `var(--color-border)`. All text uses token custom properties. Status badge uses the status colour custom properties. Transition: `transform var(--motion-duration-normal) var(--motion-easing)`.

9. **Modify `src/graph/graph-view.tsx`** — add `<SummaryPanel />` inside the graph view, positioned absolutely over the right side of the graph. Import and render it after the `<ReactFlow>` component.

10. **Modify `src/graph/graph-view.module.css`** — add `position: relative` to the container (if not already) so `SummaryPanel` positions correctly.

11. **Create `src/app.module.css`** — app-level layout styles. Full viewport container. No hardcoded colours.

12. **Modify `src/App.tsx`** — conditional rendering based on tree store:
    - If `useTreeStore((s) => s.selectedTreeId)` is null: render `<TreeList />`.
    - If a tree is selected: render `<GraphView treeId={selectedTreeId} />` with a back button that calls `selectTree(null)`.
    - Keep "Arbor" visible (T-001 smoke test) — use it as the app title in the tree list header or as `document.title`.
    - Import and use `src/app.module.css` for layout.

13. **Add `data-testid` attributes for observe automation.** The actions file at `tests/T-012/actions.json` is pre-written by the architect — do not create or modify it. It clicks on `[data-testid='tree-card']` and `[data-testid='arbor-node']` selectors. Ensure:
    - Tree list cards have `data-testid="tree-card"` on their outer element.
    - ArborNode component's outer div has `data-testid="arbor-node"` (add to `src/graph/arbor-node.tsx` if not already present).

## Acceptance criteria
- [ ] `tests/T-012/summary-panel.test.tsx` passes — summary panel renders node details when a node is selected; returns null when no selection
- [ ] `tests/T-012/tree-list.test.tsx` passes — tree list renders fixture tree with progress ring; clicking a card sets selectedTreeId
- [ ] `tests/T-009/token-lint.test.ts` still passes — no hardcoded colours introduced
- [ ] `MSYS_NO_PATHCONV=1 pnpm observe --route / --ticket T-012 --actions tests/T-012/actions.json --out .claude/session-logs/T-012-observe` produces 3+ non-empty screenshot PNGs
- [ ] `pnpm lint` exits 0

## Out of scope — DO NOT
- Do not add react-router or any routing library.
- Do not implement teaching/learning UI, diagnostic UI, or stats.
- Do not add animation beyond the panel slide transition.
- Do not edit `contracts/tokens.ts`, `contracts/commands.d.ts`, `src/tokens.css`, `src/graph/layout-engine.ts`, or `src/state/graph-store.ts`.
- Do not edit any file in `Arbor Spec/` or `.claude/`.
- Do not edit any test file.
- Never invoke `node -e`, `python -c`, or other interpreter one-liners for diagnostics or version checks. bash-guard denies the command class regardless of argument content. To check an installed package version use `pnpm list <pkg>`; to read a version field use the `Read` tool on `package.json` or `node_modules/<pkg>/package.json`.
- **If anything is ambiguous: STOP. Write the question under Blocked, set `status: blocked`, end the session. Never choose.**

## Blocked

## Implementation notes

## Verification
