import { create } from 'zustand';

export interface FileEditorState {
  path: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
}

interface EditorStoreState {
  // Map of file states keyed by file path - design seam for Phase 4 Yjs document provider
  files: Record<string, FileEditorState>;
  openTabs: string[];
  activeTab: string | null;

  // Actions
  openFile: (path: string, content: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaving: (path: string, isSaving: boolean) => void;
  markSaved: (path: string, newContent: string) => void;
  setFileError: (path: string, error: string | null) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  removeFile: (path: string) => void;
  closeAllTabs: () => void;
}

export const useEditorStore = create<EditorStoreState>((set) => ({
  files: {},
  openTabs: [],
  activeTab: null,

  openFile: (path: string, content: string) => {
    set((state) => {
      const existing = state.files[path];
      const nextFiles = { ...state.files };

      if (!existing) {
        nextFiles[path] = {
          path,
          content,
          originalContent: content,
          isDirty: false,
          isSaving: false,
          error: null,
        };
      }

      const tabs = state.openTabs.includes(path) ? state.openTabs : [...state.openTabs, path];

      return {
        files: nextFiles,
        openTabs: tabs,
        activeTab: path,
      };
    });
  },

  closeTab: (path: string) => {
    set((state) => {
      const tabs = state.openTabs.filter((t) => t !== path);
      let nextActive = state.activeTab;

      if (state.activeTab === path) {
        if (tabs.length > 0) {
          const closedIndex = state.openTabs.indexOf(path);
          const newIndex = Math.min(closedIndex, tabs.length - 1);
          nextActive = tabs[newIndex];
        } else {
          nextActive = null;
        }
      }

      // If the file is not dirty, we can remove it from files cache or retain it
      const nextFiles = { ...state.files };
      if (!nextFiles[path]?.isDirty) {
        delete nextFiles[path];
      }

      return {
        openTabs: tabs,
        activeTab: nextActive,
        files: nextFiles,
      };
    });
  },

  setActiveTab: (path: string) => {
    set({ activeTab: path });
  },

  updateContent: (path: string, content: string) => {
    set((state) => {
      const current = state.files[path];
      if (!current) return state;

      const isDirty = content !== current.originalContent;
      return {
        files: {
          ...state.files,
          [path]: {
            ...current,
            content,
            isDirty,
            error: null,
          },
        },
      };
    });
  },

  markSaving: (path: string, isSaving: boolean) => {
    set((state) => {
      const current = state.files[path];
      if (!current) return state;
      return {
        files: {
          ...state.files,
          [path]: {
            ...current,
            isSaving,
          },
        },
      };
    });
  },

  markSaved: (path: string, newContent: string) => {
    set((state) => {
      const current = state.files[path];
      if (!current) return state;
      return {
        files: {
          ...state.files,
          [path]: {
            ...current,
            content: newContent,
            originalContent: newContent,
            isDirty: false,
            isSaving: false,
            error: null,
          },
        },
      };
    });
  },

  setFileError: (path: string, error: string | null) => {
    set((state) => {
      const current = state.files[path];
      if (!current) return state;
      return {
        files: {
          ...state.files,
          [path]: {
            ...current,
            error,
          },
        },
      };
    });
  },

  renameFile: (oldPath: string, newPath: string) => {
    set((state) => {
      const nextFiles = { ...state.files };
      if (nextFiles[oldPath]) {
        nextFiles[newPath] = {
          ...nextFiles[oldPath],
          path: newPath,
        };
        delete nextFiles[oldPath];
      }

      const tabs = state.openTabs.map((t) => (t === oldPath ? newPath : t));
      const active = state.activeTab === oldPath ? newPath : state.activeTab;

      return {
        files: nextFiles,
        openTabs: tabs,
        activeTab: active,
      };
    });
  },

  removeFile: (path: string) => {
    set((state) => {
      const nextFiles = { ...state.files };
      delete nextFiles[path];

      const tabs = state.openTabs.filter((t) => t !== path);
      let nextActive = state.activeTab;
      if (state.activeTab === path) {
        nextActive = tabs.length > 0 ? tabs[tabs.length - 1] : null;
      }

      return {
        files: nextFiles,
        openTabs: tabs,
        activeTab: nextActive,
      };
    });
  },

  closeAllTabs: () => {
    set({
      openTabs: [],
      activeTab: null,
      files: {},
    });
  },
}));
