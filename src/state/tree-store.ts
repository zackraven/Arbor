import { create } from 'zustand';

interface TreeState {
  selectedTreeId: string | null;
  selectTree: (id: string | null) => void;
}

export const useTreeStore = create<TreeState>((set) => ({
  selectedTreeId: null,
  selectTree: (selectedTreeId) => set({ selectedTreeId }),
}));
