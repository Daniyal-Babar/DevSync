import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Code2,
  Plus,
  Trash2,
  FolderGit2,
  ShieldCheck,
  ShieldAlert,
  Eye,
  LogOut,
  Moon,
  Sun,
  User as UserIcon,
  Loader2,
  FileCode,
  Terminal,
  FileText,
  Clock,
  X,
} from 'lucide-react';
import { workspacesApi } from '../api/workspaces';
import { Workspace, WorkspaceRole, WorkspaceTemplate } from '../types/workspace';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { theme, toggleTheme } = useUIStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<WorkspaceTemplate>('starter_web');
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch workspaces list
  const { data: workspaces = [], isLoading, isError } = useQuery<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setTemplate('starter_web');
      navigate(`/workspace/${newWorkspace.id}`);
    },
    onError: (err: unknown) => {
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axErr = err as { response?: { data?: { detail?: string } } };
        setCreateError(axErr.response?.data?.detail || 'Failed to create workspace');
      } else {
        setCreateError('Could not create workspace');
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: workspacesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateError(null);
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      template,
    });
  };

  const handleDelete = (e: React.MouseEvent, ws: Workspace) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete '${ws.name}'? This cannot be undone.`)) {
      deleteMutation.mutate(ws.id);
    }
  };

  const renderRoleBadge = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-900/50 text-purple-300 border border-purple-800/50">
            <ShieldCheck className="w-3 h-3" />
            Owner
          </span>
        );
      case 'editor':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-900/50 text-blue-300 border border-blue-800/50">
            <ShieldAlert className="w-3 h-3" />
            Editor
          </span>
        );
      case 'viewer':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-900/50 text-amber-300 border border-amber-800/50">
            <Eye className="w-3 h-3" />
            Viewer
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Top Navigation */}
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-base tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <span>DevSync</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
            Phase 1
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Toggle theme"
          >
            {theme === 'vs-dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <div className="h-5 w-px bg-gray-800" />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className="w-7 h-7 rounded-full bg-blue-950 border border-blue-700/60 flex items-center justify-center text-blue-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <span className="font-medium text-xs sm:text-sm">{user?.username}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-950/50 text-gray-400 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Workspaces</h1>
            <p className="text-sm text-gray-400 mt-1">
              Select an existing workspace or create a new project environment.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>New Workspace</span>
          </button>
        </div>

        {/* Workspaces Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm">Loading workspaces...</p>
          </div>
        ) : isError ? (
          <div className="p-6 bg-red-950/30 border border-red-800/50 rounded-xl text-center space-y-2">
            <p className="text-red-300 text-sm font-medium">Failed to load workspaces.</p>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['workspaces'] })}
              className="text-xs text-red-400 underline hover:text-red-300"
            >
              Try again
            </button>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-900/30 p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-950/50 border border-blue-800/40 text-blue-400 flex items-center justify-center mx-auto">
              <FolderGit2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">No workspaces yet</h3>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">
                Get started by creating your first cloud development workspace with a starter template.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-600/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workspace</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => navigate(`/workspace/${ws.id}`)}
                className="group relative bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-blue-950/20 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700/60 flex items-center justify-center text-blue-400 group-hover:bg-blue-600/10 group-hover:border-blue-500/30 transition-colors">
                        <FolderGit2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-base group-hover:text-blue-400 transition-colors">
                          {ws.name}
                        </h3>
                        <div className="mt-0.5">{renderRoleBadge(ws.role)}</div>
                      </div>
                    </div>

                    {ws.role === 'owner' && (
                      <button
                        onClick={(e) => handleDelete(e, ws)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-950/80 text-gray-400 hover:text-red-400 transition-all"
                        title="Delete workspace"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 line-clamp-2 min-h-[32px]">
                    {ws.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(ws.updated_at).toLocaleDateString()}</span>
                  </div>

                  <span className="text-blue-400 group-hover:translate-x-0.5 transition-transform font-medium">
                    Open IDE &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Workspace Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Create New Workspace</h2>
                <p className="text-xs text-gray-400">
                  Initialize an isolated cloud filesystem and development environment.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-xs text-red-300">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. My Next Project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of this project..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-300">
                  Starter Template
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTemplate('empty')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      template === 'empty'
                        ? 'bg-blue-950/40 border-blue-500 text-white'
                        : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <FileText className="w-5 h-5 mb-2 text-gray-400" />
                    <div>
                      <div className="text-xs font-semibold">Empty</div>
                      <div className="text-[10px] text-gray-500">Blank canvas</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplate('starter_web')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      template === 'starter_web'
                        ? 'bg-blue-950/40 border-blue-500 text-white'
                        : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <FileCode className="w-5 h-5 mb-2 text-sky-400" />
                    <div>
                      <div className="text-xs font-semibold">Web App</div>
                      <div className="text-[10px] text-gray-500">HTML / CSS / JS</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplate('starter_python')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      template === 'starter_python'
                        ? 'bg-blue-950/40 border-blue-500 text-white'
                        : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <Terminal className="w-5 h-5 mb-2 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold">Python</div>
                      <div className="text-[10px] text-gray-500">Python 3 Starter</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Create Workspace</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
