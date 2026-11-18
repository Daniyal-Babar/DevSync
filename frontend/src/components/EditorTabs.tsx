import React from 'react';
import { useEditorStore } from '../stores/editorStore';
import { X, FileCode, FileText, FileSpreadsheet } from 'lucide-react';

export const getTabIcon = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'html':
    case 'css':
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    case 'json':
      return <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'md':
      return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
    default:
      return <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
  }
};

export const EditorTabs: React.FC = () => {
  const { openTabs, activeTab, files, setActiveTab, closeTab } = useEditorStore();

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center overflow-x-auto bg-[#252526] border-b border-[#1e1e1e] select-none no-scrollbar">
      {openTabs.map((path) => {
        const isActive = activeTab === path;
        const fileState = files[path];
        const isDirty = fileState?.isDirty;
        const fileName = path.split('/').pop() || path;

        return (
          <div
            key={path}
            onClick={() => setActiveTab(path)}
            title={path}
            className={`group relative flex items-center gap-2 px-3 py-2 text-xs border-r border-[#1e1e1e] cursor-pointer transition-colors max-w-[180px] ${
              isActive
                ? 'bg-[#1e1e1e] text-gray-100 font-medium border-t-2 border-t-blue-500'
                : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#282828] hover:text-gray-200 border-t-2 border-t-transparent'
            }`}
          >
            {getTabIcon(path)}
            <span className="truncate">{fileName}</span>

            <div className="flex items-center shrink-0 ml-1">
              {isDirty ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(path);
                  }}
                  className="w-4 h-4 rounded hover:bg-gray-700/60 flex items-center justify-center text-gray-400"
                  title="Unsaved changes. Click to close."
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:block" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(path);
                  }}
                  className="w-4 h-4 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700/60 flex items-center justify-center text-gray-400 hover:text-gray-200 transition-opacity"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
