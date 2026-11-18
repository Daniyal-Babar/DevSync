import { apiClient, setAuthToken } from './client';
import { LoginPayload, RegisterPayload, TokenResponse, User } from '../types/auth';

export const authApi = {
  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/login', payload);
    setAuthToken(response.data.access_token);
    return response.data;
  },

  register: async (payload: RegisterPayload): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', payload);
    return response.data;
  },

  refresh: async (): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/refresh');
    setAuthToken(response.data.access_token);
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAuthToken(null);
    }
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};
