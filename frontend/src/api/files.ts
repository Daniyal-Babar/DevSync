import { apiClient } from './client';
import {
  FileTreeResponse,
  FileContentResponse,
  FileSavePayload,
  FileCreatePayload,
  FileRenamePayload,
} from '../types/files';

export const filesApi = {
  getTree: async (workspaceId: string): Promise<FileTreeResponse> => {
    const response = await apiClient.get<FileTreeResponse>(`/workspaces/${workspaceId}/files/tree`);
    return response.data;
  },

  getContent: async (workspaceId: string, path: string): Promise<FileContentResponse> => {
    const response = await apiClient.get<FileContentResponse>(
      `/workspaces/${workspaceId}/files/content`,
      { params: { path } }
    );
    return response.data;
  },

  saveContent: async (workspaceId: string, payload: FileSavePayload): Promise<FileContentResponse> => {
    const response = await apiClient.put<FileContentResponse>(
      `/workspaces/${workspaceId}/files/content`,
      payload
    );
    return response.data;
  },

  create: async (workspaceId: string, payload: FileCreatePayload): Promise<{ message: string; path: string }> => {
    const response = await apiClient.post<{ message: string; path: string }>(
      `/workspaces/${workspaceId}/files`,
      payload
    );
    return response.data;
  },

  rename: async (workspaceId: string, payload: FileRenamePayload): Promise<{ message: string; path: string }> => {
    const response = await apiClient.patch<{ message: string; path: string }>(
      `/workspaces/${workspaceId}/files`,
      payload
    );
    return response.data;
  },

  delete: async (workspaceId: string, path: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
      `/workspaces/${workspaceId}/files`,
      { params: { path } }
    );
    return response.data;
  },
};
