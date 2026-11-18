import { apiClient } from './client';
import {
  Workspace,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
} from '../types/workspace';

export const workspacesApi = {
  list: async (): Promise<Workspace[]> => {
    const response = await apiClient.get<Workspace[]>('/workspaces');
    return response.data;
  },

  get: async (id: string): Promise<Workspace> => {
    const response = await apiClient.get<Workspace>(`/workspaces/${id}`);
    return response.data;
  },

  create: async (payload: CreateWorkspacePayload): Promise<Workspace> => {
    const response = await apiClient.post<Workspace>('/workspaces', payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateWorkspacePayload): Promise<Workspace> => {
    const response = await apiClient.patch<Workspace>(`/workspaces/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string; id: string }> => {
    const response = await apiClient.delete<{ message: string; id: string }>(`/workspaces/${id}`);
    return response.data;
  },
};
