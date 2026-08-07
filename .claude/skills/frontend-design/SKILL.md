---
name: frontend-design
description: >
  Aesthetic constitution for Arbor's frontend. Referenced by all Phase 3+
  tickets that create or modify visual components. Defines patterns for
  CSS modules, token usage, zustand stores, React Flow nodes, and
  state-to-visual mapping.
disable-model-invocation: true
---

## frontend-design

Aesthetic and implementation guide for Arbor's frontend UI.

---

### Visual identity

Arbor is a **light, clean, spatial** learning environment. The default palette is light gray/white with dark outlines and coloured accents for node states. The feel is **calm, precise, and information-dense** — not playful, not enterprise. Think: a textbook's dependency diagram rendered as an interactive graph.

**Light theme** is the default. A dark theme is deferred — the semantic token architecture (`lightTheme` → `tokens.color.*`) ensures it's a variable swap when needed. Do not build a theme toggle now.

---

### CSS Modules pattern

All component styles use CSS Modules (`.module.css` files). No global styles except `src/tokens.css` (generated from C7 design tokens).

```
src/graph/graph-view.tsx          → src/graph/graph-view.module.css
src/graph/arbor-node.tsx          → src/graph/arbor-node.module.css
src/graph/summary-panel.tsx       → src/graph/summary-panel.module.css
src/tree-list.tsx                 → src/tree-list.module.css
src/progress-ring.tsx             → src/progress-ring.module.css
src/app.module.css                → App-level layout
```

**Rules:**
- Import as `import styles from './foo.module.css'`
- Use `styles.className` in JSX, never string classNames for component styles
- All colours, spacing, and typography reference CSS custom properties from `tokens.css` (e.g. `var(--color-base)`, `var(--spacing-md)`)
- No hardcoded hex values, rgb(), or hsl() in any `.module.css` or `.tsx` file — the token-lint test enforces this

---

### Token usage

`src/tokens.css` maps the `contracts/tokens.ts` values to CSS custom properties. It is the only file allowed to contain literal colour values.

```css
/* Pattern in tokens.css */
:root {
  --color-base: #f5f5f5;
  --color-surface: #ffffff;
  --color-completed: #2e7d32;
  /* ... all tokens ... */
}
```

Components consume these via `var(--color-xxx)`. When a component needs a token value in TypeScript (e.g. for React Flow node styling), import from `contracts/tokens.ts`.

**Semantic token architecture:** `contracts/tokens.ts` exports `lightTheme` (concrete values) and `tokens` (semantic references to the theme). Components always use `tokens.*`, never `lightTheme.*` directly. This ensures a future dark theme is a variable swap.

---

### Zustand pattern

One store per domain. Stores live in `src/state/`. Pattern:

```typescript
// src/state/graph-store.ts
import { create } from 'zustand';

interface GraphState {
  // state fields
  selectedNodeId: string | null;
  // actions
  selectNode: (id: string | null) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  selectedNodeId: null,
  selectNode: (id) => set({ selectedNodeId: id }),
}));
```

**Rules:**
- No `immer` middleware unless the ticket explicitly names it
- Actions are methods on the store, not standalone functions
- Stores are typed — no `any`
- One export: `useXxxStore`

---

### React Flow conventions

- Use `@xyflow/react` (v12+) — the package was renamed from `reactflow`
- Custom nodes registered via `nodeTypes` prop on `<ReactFlow>`
- Node data type is strongly typed (no `any` in `data` prop)
- ELK layout computed outside React Flow; positions are set on the nodes array before passing to `<ReactFlow>`
- `fitView` enabled; `minZoom`/`maxZoom` set for usability
- Edges use `default` (bezier) type — subtle curves that differentiate overlapping paths
- Pan/zoom: enabled. Node drag: disabled (layout is authoritative)

---

### LayoutEngine adapter

The layout engine is an async adapter interface so the algorithm can be swapped cheaply (ELK now, potentially dagre or custom later).

```typescript
interface LayoutEngine {
  layout(nodes: LayoutNode[], edges: LayoutEdge[]): Promise<LayoutResult>;
}
```

The `ElkLayoutEngine` implementation wraps `elkjs` with configuration from `tokens.elk`:
- Direction: `UP` (root at bottom, leaves at top — learner progresses upward)
- **Y-flip:** adapter flips y-coordinates after ELK layout (`y_out = maxY - y_elk`) because ELK's y increases downward regardless of `direction`
- Node spacing: 10px within-layer, 100px between-layer
- Edge routing: `POLYLINE` with React Flow `default` (bezier) rendering
- Crossing minimisation: `LAYER_SWEEP`, thoroughness 100
- Node placement: `NETWORK_SIMPLEX` (minimises edge length → compact, centred)
- Post-compaction: `EDGE_LENGTH`, `separateConnectedComponents: false`, `highDegreeNodeTreatment: true`
- Node dimensions: `tokens.node.elkWidth` × `tokens.node.elkHeight` (65 × 65px, circle bounding box)
- Async execution (ELK runs via `elkjs`)

---

### Node rendering — circles with labels inside

Nodes are **circles**, not rectangles. The module name is rendered **inside** the circle.

```
     ╭────────╮
     │ Module │  ← circle (80px diameter), filled white, outlined with status colour
     │  Name  │     label inside, centered, 10px, up to 3 lines
     ╰────────╯
```

- Circle: `tokens.node.diameter` (65px), `border: tokens.node.borderWidth solid <status-colour>`
- Fill: `var(--color-surface)` (white in light theme)
- Outline: status colour (green/blue/amber/gray) — see state-to-visual mapping
- Label: centered inside the circle, `tokens.node.labelFontSize` (9px), up to 3 lines, ellipsis overflow
- Description (one-liner): appears on hover/click in tooltip or summary panel, NOT on the node
- ELK receives `elkWidth` × `elkHeight` (65 × 65) matching the circle diameter

---

### State-to-visual mapping

| `UnlockStatus` | Outline color | Glow | Label | Interaction |
|---|---|---|---|---|
| `completed` | `--color-completed` (green) | none | primary | click → select |
| `unlocked` | `--color-unlocked` (blue) | blue glow, 10px radius | primary | click → select |
| `in_progress` | `--color-in-progress` (amber) | none | primary | click → select |
| `locked` | `--color-locked` (gray) | none | secondary | click → select (dimmed) |

Selection adds a ring (`--color-selected-ring`) and opens the summary panel.

---

### Edge highlighting

Edges respond to two conditions:

**Selection highlighting:** When a node is selected, all edges directly connecting it to its parents and children are highlighted — stroke changes to `tokens.color.edgeHighlight` (blue, #1565c0) at `tokens.graph.edgeHighlightWidth` (2.5px vs default 1.5px). Non-connected edges remain at default.

**Completion colouring:** When a node has status `completed`, edges from its children (prerequisites) to it are stroked with `tokens.color.edgeCompleted` (green, #2e7d32). This shows "these prerequisites feed into this completed node."

**Precedence:** Selection highlighting wins over completion colouring when both apply (highlight colour + highlight width).

Edge styles are computed in `graph-view.tsx`'s `useEffect` based on `selectedNodeId` and `unlockStatuses`.

---

### File naming

- Components: `kebab-case.tsx` (e.g. `arbor-node.tsx`, `graph-view.tsx`)
- Styles: `kebab-case.module.css` (matching the component)
- Stores: `kebab-case.ts` in `src/state/` (e.g. `graph-store.ts`)
- Hooks: `use-kebab-case.ts` (e.g. `use-graph-loader.ts`)
- API wrappers: `kebab-case.ts` in `src/api/` (e.g. `tauri-commands.ts`)

---

### Tauri / non-Tauri detection

For development and testing outside the Tauri webview, components detect whether `window.__TAURI_INTERNALS__` exists. When absent, data loaders fall back to static fixture imports. This enables `pnpm observe` screenshots and vitest DOM tests without a running Tauri backend.
