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

Arbor is a dark, focused learning environment. The palette is low-contrast dark with carefully chosen accent colours for node states. The feel is **calm, spatial, and information-dense** — not playful, not enterprise. Think: a physics textbook rendered as a dark-mode graph IDE.

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
  --color-base: #0e0e10;
  --color-surface: #1a1a1f;
  --color-completed: #4caf50;
  /* ... all tokens ... */
}
```

Components consume these via `var(--color-xxx)`. When a component needs a token value in TypeScript (e.g. for React Flow node styling), import from `contracts/tokens.ts`.

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
- Edges use `smoothstep` type by default
- Pan/zoom: enabled. Node drag: disabled (layout is authoritative)

---

### LayoutEngine adapter

The layout engine is an async adapter interface so the algorithm can be swapped cheaply (ELK now, potentially dagre or custom later).

```typescript
interface LayoutEngine {
  layout(nodes: LayoutNode[], edges: LayoutEdge[]): Promise<LayoutResult>;
}
```

The `ElkLayoutEngine` implementation wraps `elkjs` with:
- Direction: `UP` (root at bottom, leaves at top — learner progresses upward)
- Node spacing: 80px vertical, 40px horizontal
- Edge routing: `SPLINES`
- Crossing minimisation: `LAYER_SWEEP`
- Async execution (ELK runs in a web worker via `elkjs`)

---

### State-to-visual mapping

| `UnlockStatus` | Border color | Glow | Text | Interaction |
|---|---|---|---|---|
| `completed` | `--color-completed` (green) | none | primary | click → select |
| `unlocked` | `--color-unlocked` (blue) | blue glow, 12px radius | primary | click → select |
| `in_progress` | `--color-in-progress` (amber) | none | primary | click → select |
| `locked` | `--color-locked` (gray) | none | secondary | click → select (dimmed) |

Selection adds a ring (`--color-selected-ring`) and opens the summary panel.

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
