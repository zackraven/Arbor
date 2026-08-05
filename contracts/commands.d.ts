// C3 — Tauri Commands (Phase 2)
// Mirror of: Arbor Spec/21 Contracts/C3 Tauri Commands.md
// Do not edit by hand — architect updates this file when the contract changes.

// ── Error contract ──────────────────────────────────────────────────────────

export interface AppError {
  code: string;
  message: string;
  detail?: string;
}

// ── Trees ───────────────────────────────────────────────────────────────────

export interface TreeSummary {
  id: string;
  title: string;
  node_count: number;
  completed_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Tree {
  id: string;
  title: string;
  scope: { top_bubble: string; categories: string[] };
  version: number;
  created_at: string;
  updated_at: string;
}

// ── Graph ───────────────────────────────────────────────────────────────────

export interface Graph {
  tree_id: string;
  tree_version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  title: string;
  one_liner: string;
  category: string;
  status: 'not_started' | 'in_progress' | 'completed';
  pack_path: string | null;
}

export interface GraphEdge {
  id: number;
  parent_id: string;
  child_id: string;
  justification: string;
}

// ── Unlock ──────────────────────────────────────────────────────────────────

export type UnlockStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed';

// ── Graph log ───────────────────────────────────────────────────────────────

export interface GraphLogEntry {
  id: number;
  tree_version: number;
  change_type: 'node_added' | 'node_removed' | 'edge_added' | 'edge_removed' | 'node_updated';
  entity_id: string;
  payload: Record<string, unknown>;
  actor: 'build_pipeline' | 'repair' | 'user';
  created_at: string;
}

// ── Node detail ─────────────────────────────────────────────────────────────

export interface NodeDetail {
  id: string;
  tree_id: string;
  title: string;
  one_liner: string;
  category: string;
  outcomes: string[];
  status: 'not_started' | 'in_progress' | 'completed';
  pack_path: string | null;
  provenance: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Seed / fixture commands ─────────────────────────────────────────────────

export interface SeedTree {
  id: string;
  title: string;
  scope: { top_bubble: string; categories: string[] };
  nodes: SeedNode[];
  edges: SeedEdge[];
}

export interface SeedNode {
  id: string;
  title: string;
  one_liner: string;
  category: string;
  outcomes: string[];
  status?: 'not_started' | 'in_progress' | 'completed';
}

export interface SeedEdge {
  parent_id: string;
  child_id: string;
  justification: string;
}
