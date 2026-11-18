import { create } from 'zustand';

interface UIState {
  theme: 'vs-dark' | 'light';
  sidebarOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: 'terminal' | 'output' | 'problems';
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelTab: (tab: 'terminal' | 'output' | 'problems') => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'vs-dark',
  sidebarOpen: true,
  bottomPanelOpen: false,
  bottomPanelTab: 'terminal',

  toggleTheme: () => {
    set((state) => ({
      theme: state.theme === 'vs-dark' ? 'light' : 'vs-dark',
    }));
  },

  toggleSidebar: () => {
    set((state) => ({
      sidebarOpen: !state.sidebarOpen,
    }));
  },

  toggleBottomPanel: () => {
    set((state) => ({
      bottomPanelOpen: !state.bottomPanelOpen,
    }));
  },

  setBottomPanelTab: (tab) => {
    set({
      bottomPanelTab: tab,
      bottomPanelOpen: true,
    });
  },
}));
