import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Code2,
  Loader2,
  FolderOpen,
  Keyboard,
  AlertCircle,
} from 'lucide-react';
import { workspacesApi } from '../api/workspaces';
import { filesApi } from '../api/files';
import { Workspace } from '../types/workspace';
import { FileNodeType, FileTreeResponse } from '../types/files';
import { useEditorStore } from '../stores/editorStore';
import { useUIStore } from '../stores/uiStore';
import { TopBar } from '../components/TopBar';
import { FileExplorer } from '../components/FileExplorer';
import { EditorTabs } from '../components/EditorTabs';
import { CodeEditor } from '../components/CodeEditor';
import { BottomPanel } from '../components/BottomPanel';

export const WorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    activeTab,
    files,
    openFile,
    updateContent,
    markSaving,
    markSaved,
    setFileError,
    renameFile,
    removeFile,
    closeAllTabs,
  } = useEditorStore();

  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const isResizingRef = useRef(false);

  // Clear tabs if workspace changes
  useEffect(() => {
    return () => {
      closeAllTabs();
    };
  }, [id, closeAllTabs]);

  // Query workspace details
  const {
    data: workspace,
    isLoading: isWsLoading,
    isError: isWsError,
  } = useQuery<Workspace>({
    queryKey: ['workspace', id],
    queryFn: () => workspacesApi.get(id!),
    enabled: Boolean(id),
  });

  // Query workspace file tree
  const {
    data: treeData,
    isLoading: isTreeLoading,
    refetch: refetchTree,
  } = useQuery<FileTreeResponse>({
    queryKey: ['workspace-tree', id],
    queryFn: () => filesApi.getTree(id!),
    enabled: Boolean(id),
  });

  // Save content mutation
  const saveMutation = useMutation({
    mutationFn: (variables: { path: string; content: string }) =>
      filesApi.saveContent(id!, variables),
    onSuccess: (data) => {
      markSaved(data.path, data.content);
    },
    onError: (err: unknown, variables) => {
      markSaving(variables.path, false);
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : 'Failed to save file';
      setFileError(variables.path, msg || 'Save failed');
    },
  });

  const handleSaveActiveFile = useCallback(() => {
    if (!activeTab || !workspace) return;
    if (workspace.role === 'viewer') return;

    const file = files[activeTab];
    if (!file || !file.isDirty || file.isSaving) return;

    markSaving(activeTab, true);
    saveMutation.mutate({ path: activeTab, content: file.content });
  }, [activeTab, files, workspace, markSaving, saveMutation]);

  // Global Ctrl+S / Cmd+S listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveActiveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveActiveFile]);

  // Open file handler (reads from server if not cached)
  const handleOpenFile = async (path: string) => {
    if (files[path]) {
      openFile(path, files[path].content);
      return;
    }

    try {
      const res = await filesApi.getContent(id!, path);
      openFile(path, res.content);
    } catch (err: unknown) {
      const msg =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : 'Could not load file';
      alert(`Error loading file: ${msg}`);
    }
  };

  // Create file or folder handler
  const handleCreateItem = async (parentPath: string, name: string, type: FileNodeType) => {
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    await filesApi.create(id!, { path: fullPath, type });
    await refetchTree();
    if (type === 'file') {
      await handleOpenFile(fullPath);
    }
  };

  // Rename item handler
  const handleRenameItem = async (oldPath: string, newPath: string) => {
    await filesApi.rename(id!, { path: oldPath, new_path: newPath });
    renameFile(oldPath, newPath);
    await refetchTree();
  };

  // Delete item handler
  const handleDeleteItem = async (path: string) => {
    await filesApi.delete(id!, path);
    removeFile(path);
    await refetchTree();
  };

  // Resizable sidebar mouse event handlers
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(160, Math.min(moveEvent.clientX, 500));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (isWsLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e1e] text-gray-300">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm font-medium">Loading workspace environment...</p>
      </div>
    );
  }

  if (isWsError || !workspace) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e1e] text-gray-300 p-6">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <h2 className="text-lg font-bold text-white mb-1">Workspace Unavailable</h2>
        <p className="text-sm text-gray-400 mb-4 max-w-sm text-center">
          The workspace does not exist or you do not have permission to access it.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const activeFile = activeTab ? files[activeTab] : null;
  const isReadOnly = workspace.role === 'viewer';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-gray-200 overflow-hidden select-none">
      {/* Top Application Bar */}
      <TopBar
        workspaceName={workspace.name}
        role={workspace.role}
        onSaveActiveFile={handleSaveActiveFile}
      />

      {/* Main IDE Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar Activity Strip */}
        <div className="w-12 bg-[#333333] flex flex-col items-center py-3 border-r border-[#252526] select-none z-10 shrink-0">
          <button
            onClick={toggleSidebar}
            className={`p-2.5 rounded-lg transition-colors ${
              sidebarOpen
                ? 'bg-[#252526] text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-[#3c3c3c]'
            }`}
            title="Toggle File Explorer (Ctrl+B)"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
        </div>

        {/* Resizable File Explorer Panel */}
        {sidebarOpen && (
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="h-full border-r border-[#2d2d2d] bg-[#252526] flex flex-col shrink-0 relative"
          >
            <FileExplorer
              tree={treeData?.root || []}
              activeFilePath={activeTab}
              role={workspace.role}
              onOpenFile={handleOpenFile}
              onCreateItem={handleCreateItem}
              onRenameItem={handleRenameItem}
              onDeleteItem={handleDeleteItem}
              onRefresh={refetchTree}
              isLoading={isTreeLoading}
            />

            {/* Drag handle */}
            <div
              onMouseDown={handleMouseDownResize}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-20"
            />
          </div>
        )}

        {/* Center Editor Container */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#1e1e1e]">
          {/* Monaco Tabs Bar */}
          <EditorTabs />

          {/* Active File Error Banner (if any) */}
          {activeFile?.error && (
            <div className="px-3 py-1.5 bg-red-950/60 border-b border-red-800/50 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span>{activeFile.error}</span>
            </div>
          )}

          {/* Editor Body */}
          <div className="flex-1 min-h-0 relative">
            {activeTab && activeFile ? (
              <CodeEditor
                path={activeTab}
                value={activeFile.content}
                onChange={(val) => updateContent(activeTab, val)}
                readOnly={isReadOnly}
                onSave={handleSaveActiveFile}
              />
            ) : (
              /* Empty Editor State */
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-800/40 border border-gray-700/50 flex items-center justify-center text-gray-400">
                  <Code2 className="w-8 h-8 opacity-60" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-300">
                    No File Open
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Select a file from the explorer on the left or create a new file to start coding.
                  </p>
                </div>

                <div className="p-3 bg-gray-800/40 border border-gray-700/50 rounded-xl text-xs text-gray-400 space-y-1.5 max-w-xs text-left">
                  <div className="flex items-center gap-2 font-medium text-gray-300 mb-1">
                    <Keyboard className="w-3.5 h-3.5 text-blue-400" />
                    <span>Quick Shortcuts</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Save Active File</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300">Ctrl + S</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Toggle Sidebar</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300">Explorer Icon</kbd>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel (Terminal / Output placeholder) */}
          <BottomPanel />
        </div>
      </div>
    </div>
  );
};
