import React from 'react';
import { Terminal, AlertCircle, FileText, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';

export const BottomPanel: React.FC = () => {
  const {
    bottomPanelOpen,
    bottomPanelTab,
    toggleBottomPanel,
    setBottomPanelTab,
  } = useUIStore();

  if (!bottomPanelOpen) {
    return (
      <div className="h-6 bg-[#181818] border-t border-[#2d2d2d] flex items-center justify-between px-3 text-[11px] text-gray-400 select-none">
        <button
          onClick={toggleBottomPanel}
          className="flex items-center gap-1.5 hover:text-gray-200 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span>Panel (Terminal, Output)</span>
          <ChevronUp className="w-3.5 h-3.5 ml-1" />
        </button>
        <span className="text-[10px] text-gray-500">DevSync IDE v1.0</span>
      </div>
    );
  }

  return (
    <div className="h-48 bg-[#1e1e1e] border-t border-[#2d2d2d] flex flex-col select-none">
      {/* Tab bar */}
      <div className="h-7 bg-[#252526] border-b border-[#1e1e1e] flex items-center justify-between px-2 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBottomPanelTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              bottomPanelTab === 'terminal'
                ? 'bg-[#1e1e1e] text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setBottomPanelTab('output')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              bottomPanelTab === 'output'
                ? 'bg-[#1e1e1e] text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Output</span>
          </button>

          <button
            onClick={() => setBottomPanelTab('problems')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              bottomPanelTab === 'problems'
                ? 'bg-[#1e1e1e] text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Problems</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-gray-400">
          <button
            onClick={toggleBottomPanel}
            className="p-1 hover:bg-[#333333] hover:text-white rounded"
            title="Collapse Panel"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleBottomPanel}
            className="p-1 hover:bg-[#333333] hover:text-white rounded"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content panel placeholder */}
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto bg-[#181818] text-gray-300">
        {bottomPanelTab === 'terminal' && (
          <div className="space-y-2">
            <div className="text-gray-500">
              DevSync Cloud Environment Shell [Version 1.0.0]
            </div>
            <div className="text-emerald-400">
              devsync@workspace:~$ <span className="animate-pulse">_</span>
            </div>
            <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded text-blue-300 text-[11px] font-sans">
              <strong>Phase 2 Terminal Seam:</strong> The interactive container shell and WebSocket
              PTY process will be attached here in Phase 2. The layout and UI docking boundaries are
              prepared.
            </div>
          </div>
        )}

        {bottomPanelTab === 'output' && (
          <div className="text-gray-400 space-y-1">
            <div>[DevSync FS] Local storage driver loaded.</div>
            <div>[Monaco Editor] Language service initialized.</div>
            <div className="text-emerald-400">[Ready] Workspace connected.</div>
          </div>
        )}

        {bottomPanelTab === 'problems' && (
          <div className="text-gray-500 italic">No issues detected in workspace files.</div>
        )}
      </div>
    </div>
  );
};
