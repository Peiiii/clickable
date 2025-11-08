import { create } from 'zustand';
import type { Card, SelectionInfo, HighlightRect } from '../types';

interface ClickableState {
  selection: SelectionInfo | null;
  lastSelectionRange: Range | null;
  cards: Card[];
  isSidebarVisible: boolean;
  highlightRects: HighlightRect[];

  setSelection: (selection: SelectionInfo | null) => void;
  setLastSelectionRange: (range: Range | null) => void;
  setCards: (cards: Card[] | ((prev: Card[]) => Card[])) => void;
  addCard: (card: Card) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  removeCard: (id: string) => void;
  setSidebarVisible: (isVisible: boolean) => void;
  toggleSidebar: () => void;
  setHighlightRects: (rects: HighlightRect[]) => void;
}

export const useClickableStore = create<ClickableState>((set) => ({
  selection: null,
  lastSelectionRange: null,
  cards: [],
  isSidebarVisible: true,
  highlightRects: [],

  setSelection: (selection) => set({ selection }),
  setLastSelectionRange: (range) => set({ lastSelectionRange: range }),
  setCards: (updater) => set(state => ({ cards: typeof updater === 'function' ? updater(state.cards) : updater })),
  addCard: (card) => set(state => ({ cards: [card, ...state.cards] })),
  updateCard: (id, updates) => set(state => ({
    cards: state.cards.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
  removeCard: (id) => set(state => ({ cards: state.cards.filter(c => c.id !== id) })),
  setSidebarVisible: (isVisible) => set({ isSidebarVisible: isVisible }),
  toggleSidebar: () => set(state => ({ isSidebarVisible: !state.isSidebarVisible })),
  setHighlightRects: (rects) => set({ highlightRects: rects }),
}));
