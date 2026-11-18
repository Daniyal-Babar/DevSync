export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export type WorkspaceTemplate = 'empty' | 'starter_web' | 'starter_python';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  role: WorkspaceRole;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspacePayload {
  name: string;
  description?: string;
  template: WorkspaceTemplate;
}

export interface UpdateWorkspacePayload {
  name?: string;
  description?: string;
}
