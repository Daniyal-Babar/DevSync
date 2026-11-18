import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileCode,
  FileText,
  FileSpreadsheet,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Trash2,
  Edit2,
  File,
} from 'lucide-react';
import { FileNode, FileNodeType } from '../types/files';
import { WorkspaceRole } from '../types/workspace';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface FileExplorerProps {
  tree: FileNode[];
  activeFilePath: string | null;
  role: WorkspaceRole;
  onOpenFile: (path: string) => void;
  onCreateItem: (parentPath: string, name: string, type: FileNodeType) => Promise<void>;
  onRenameItem: (oldPath: string, newPath: string) => Promise<void>;
  onDeleteItem: (path: string) => Promise<void>;
  onRefresh: () => void;
  isLoading?: boolean;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'js':
    case 'jsx':
    case 'mjs':
      return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;
    case 'py':
      return <FileCode className="w-4 h-4 text-green-400 shrink-0" />;
    case 'html':
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    case 'css':
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    case 'json':
      return <FileSpreadsheet className="w-4 h-4 text-amber-300 shrink-0" />;
    case 'md':
      return <FileText className="w-4 h-4 text-purple-300 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-gray-400 shrink-0" />;
  }
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  tree,
  activeFilePath,
  role,
  onOpenFile,
  onCreateItem,
  onRenameItem,
  onDeleteItem,
  onRefresh,
  isLoading = false,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  
  // Creation state
  const [creatingIn, setCreatingIn] = useState<{ parentPath: string; type: FileNodeType } | null>(null);
  const [newItemName, setNewItemName] = useState<string>('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
  } | null>(null);

  const isReadOnly = role === 'viewer';

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const startRename = (node: FileNode) => {
    if (isReadOnly) return;
    setEditingPath(node.path);
    setEditingValue(node.name);
  };

  const submitRename = async (oldPath: string) => {
    if (!editingValue.trim() || editingValue === oldPath.split('/').pop()) {
      setEditingPath(null);
      return;
    }
    const parent = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
    const newPath = parent ? `${parent}/${editingValue.trim()}` : editingValue.trim();
    try {
      await onRenameItem(oldPath, newPath);
    } finally {
      setEditingPath(null);
    }
  };

  const submitCreate = async () => {
    if (!creatingIn || !newItemName.trim()) {
      setCreatingIn(null);
      return;
    }
    try {
      await onCreateItem(creatingIn.parentPath, newItemName.trim(), creatingIn.type);
      // Auto expand parent
      if (creatingIn.parentPath) {
        setExpandedFolders((prev) => new Set([...prev, creatingIn.parentPath]));
      }
    } finally {
      setCreatingIn(null);
      setNewItemName('');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const { node } = contextMenu;
    const parentPath = node?.type === 'dir' ? node.path : node ? node.path.substring(0, node.path.lastIndexOf('/')) : '';

    const items: ContextMenuItem[] = [
      {
        label: 'New File',
        icon: <FilePlus className="w-3.5 h-3.5" />,
        disabled: isReadOnly,
        action: () => {
          setCreatingIn({ parentPath, type: 'file' });
          setNewItemName('');
          if (parentPath) setExpandedFolders((prev) => new Set([...prev, parentPath]));
        },
      },
      {
        label: 'New Folder',
        icon: <FolderPlus className="w-3.5 h-3.5" />,
        disabled: isReadOnly,
        action: () => {
          setCreatingIn({ parentPath, type: 'dir' });
          setNewItemName('');
          if (parentPath) setExpandedFolders((prev) => new Set([...prev, parentPath]));
        },
      },
    ];

    if (node) {
      items.push(
        {
          label: 'Rename',
          icon: <Edit2 className="w-3.5 h-3.5" />,
          disabled: isReadOnly,
          action: () => startRename(node),
        },
        {
          label: 'Delete',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          disabled: isReadOnly,
          danger: true,
          action: () => {
            if (window.confirm(`Are you sure you want to delete '${node.name}'?`)) {
              onDeleteItem(node.path);
            }
          },
        }
      );
    }

    return (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={items}
        onClose={() => setContextMenu(null)}
      />
    );
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = activeFilePath === node.path;
      const isEditing = editingPath === node.path;

      if (node.type === 'dir') {
        return (
          <div key={node.path} className="select-none">
            <div
              onClick={() => toggleFolder(node.path)}
              onContextMenu={(e) => handleContextMenu(e, node)}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className={`flex items-center gap-1.5 py-1 pr-2 text-xs cursor-pointer hover:bg-[#2a2d2e] text-gray-300 transition-colors group ${
                isSelected ? 'bg-[#37373d] text-white font-medium' : ''
              }`}
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center text-gray-400">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              )}

              {isEditing ? (
                <input
                  type="text"
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => submitRename(node.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(node.path);
                    if (e.key === 'Escape') setEditingPath(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#3c3c3c] text-white px-1.5 py-0.5 rounded outline-none border border-blue-500 text-xs w-full mr-2"
                />
              ) : (
                <span className="truncate">{node.name}</span>
              )}
            </div>

            {/* Render inline create input inside this folder */}
            {creatingIn?.parentPath === node.path && (
              <div
                style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                className="flex items-center gap-1.5 py-1 pr-2 text-xs bg-[#2a2d2e]"
              >
                {creatingIn.type === 'dir' ? (
                  <Folder className="w-4 h-4 text-amber-400 shrink-0 ml-4" />
                ) : (
                  <File className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                )}
                <input
                  type="text"
                  autoFocus
                  placeholder={creatingIn.type === 'dir' ? 'folder name' : 'file name'}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onBlur={submitCreate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCreate();
                    if (e.key === 'Escape') setCreatingIn(null);
                  }}
                  className="bg-[#3c3c3c] text-white px-1.5 py-0.5 rounded outline-none border border-blue-500 text-xs w-full mr-2"
                />
              </div>
            )}

            {isExpanded && node.children && renderTree(node.children, depth + 1)}
          </div>
        );
      }

      // File node
      return (
        <div
          key={node.path}
          onClick={() => onOpenFile(node.path)}
          onContextMenu={(e) => handleContextMenu(e, node)}
          style={{ paddingLeft: `${depth * 14 + 24}px` }}
          className={`flex items-center gap-1.5 py-1 pr-2 text-xs cursor-pointer select-none transition-colors group ${
            isSelected
              ? 'bg-[#37373d] text-white font-medium'
              : 'hover:bg-[#2a2d2e] text-gray-300'
          }`}
        >
          {getFileIcon(node.name)}
          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={() => submitRename(node.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename(node.path);
                if (e.key === 'Escape') setEditingPath(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#3c3c3c] text-white px-1.5 py-0.5 rounded outline-none border border-blue-500 text-xs w-full mr-2"
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </div>
      );
    });
  };

  return (
    <div
      onContextMenu={(e) => handleContextMenu(e, null)}
      className="h-full flex flex-col bg-[#252526] select-none text-gray-300 text-xs overflow-hidden"
    >
      {/* Explorer Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e1e] bg-[#222223]">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-gray-400">
          Files
        </span>

        <div className="flex items-center gap-1 text-gray-400">
          {!isReadOnly && (
            <>
              <button
                onClick={() => {
                  setCreatingIn({ parentPath: '', type: 'file' });
                  setNewItemName('');
                }}
                className="p-1 hover:bg-[#333333] hover:text-gray-100 rounded"
                title="New File"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setCreatingIn({ parentPath: '', type: 'dir' });
                  setNewItemName('');
                }}
                className="p-1 hover:bg-[#333333] hover:text-gray-100 rounded"
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={onRefresh}
            className={`p-1 hover:bg-[#333333] hover:text-gray-100 rounded ${
              isLoading ? 'animate-spin' : ''
            }`}
            title="Refresh Explorer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Explorer Tree Body */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Root level create input */}
        {creatingIn?.parentPath === '' && (
          <div className="flex items-center gap-1.5 py-1 px-3 text-xs bg-[#2a2d2e]">
            {creatingIn.type === 'dir' ? (
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <File className="w-4 h-4 text-gray-400 shrink-0" />
            )}
            <input
              type="text"
              autoFocus
              placeholder={creatingIn.type === 'dir' ? 'folder name' : 'file name'}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onBlur={submitCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate();
                if (e.key === 'Escape') setCreatingIn(null);
              }}
              className="bg-[#3c3c3c] text-white px-1.5 py-0.5 rounded outline-none border border-blue-500 text-xs w-full mr-2"
            />
          </div>
        )}

        {tree.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-xs">
            No files in workspace yet.
            {!isReadOnly && (
              <button
                onClick={() => setCreatingIn({ parentPath: '', type: 'file' })}
                className="mt-2 block w-full py-1 text-blue-400 hover:underline"
              >
                + Create a file
              </button>
            )}
          </div>
        ) : (
          renderTree(tree)
        )}
      </div>

      {renderContextMenu()}
    </div>
  );
};
