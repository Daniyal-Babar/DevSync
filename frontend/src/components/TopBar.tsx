import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2,
  Save,
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  ChevronLeft,
  ShieldAlert,
  ShieldCheck,
  Eye,
  Loader2,
} from 'lucide-react';
import { WorkspaceRole } from '../types/workspace';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useEditorStore } from '../stores/editorStore';

interface TopBarProps {
  workspaceName?: string;
  role?: WorkspaceRole;
  onSaveActiveFile?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  workspaceName,
  role,
  onSaveActiveFile,
}) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { theme, toggleTheme } = useUIStore();
  const { activeTab, files } = useEditorStore();

  const activeFile = activeTab ? files[activeTab] : null;
  const isDirty = activeFile?.isDirty ?? false;
  const isSaving = activeFile?.isSaving ?? false;
  const isReadOnly = role === 'viewer';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = () => {
    if (!role) return null;
    switch (role) {
      case 'owner':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-900/60 text-purple-300 border border-purple-700/50">
            <ShieldCheck className="w-3 h-3" />
            Owner
          </span>
        );
      case 'editor':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-900/60 text-blue-300 border border-blue-700/50">
            <ShieldAlert className="w-3 h-3" />
            Editor
          </span>
        );
      case 'viewer':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-900/60 text-amber-300 border border-amber-700/50">
            <Eye className="w-3 h-3" />
            Viewer
          </span>
        );
    }
  };

  return (
    <header className="h-11 bg-[#181818] border-b border-[#2d2d2d] flex items-center justify-between px-3 select-none text-xs text-gray-300 z-20">
      {/* Left side: Back + Brand + Workspace name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#2a2d2e] text-gray-400 hover:text-white transition-colors"
          title="Back to Workspaces"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        <div className="h-4 w-px bg-gray-700" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-white">
            <Code2 className="w-4 h-4 text-blue-400" />
            <span>DevSync</span>
          </div>

          {workspaceName && (
            <>
              <span className="text-gray-500">/</span>
              <span className="font-medium text-gray-200">{workspaceName}</span>
              {getRoleBadge()}
            </>
          )}
        </div>
      </div>

      {/* Center: Save state indicator */}
      <div className="hidden md:flex items-center gap-2">
        {activeTab && !isReadOnly && (
          <button
            onClick={onSaveActiveFile}
            disabled={!isDirty || isSaving}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors ${
              isSaving
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/30 cursor-wait'
                : isDirty
                ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 cursor-pointer shadow-sm'
                : 'bg-transparent text-gray-400 border-transparent hover:border-gray-700'
            }`}
            title="Save changes (Ctrl+S / Cmd+S)"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? 'Saving...' : isDirty ? 'Save changes' : 'Saved'}</span>
          </button>
        )}
      </div>

      {/* Right side: Controls & User Profile */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded hover:bg-[#2a2d2e] text-gray-400 hover:text-white transition-colors"
          title={`Switch to ${theme === 'vs-dark' ? 'Light' : 'Dark'} theme`}
        >
          {theme === 'vs-dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-gray-300" />
          )}
        </button>

        <div className="h-4 w-px bg-gray-700" />

        <div className="flex items-center gap-2 pl-1">
          <div className="flex items-center gap-1.5 text-gray-300">
            <UserIcon className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium">{user?.username}</span>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded hover:bg-red-950/60 hover:text-red-300 text-gray-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
