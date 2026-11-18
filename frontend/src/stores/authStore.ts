import { create } from 'zustand';
import { User } from '../types/auth';
import { authApi } from '../api/auth';
import { setAuthToken } from '../api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => Promise<void>;
  initAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user: User, token: string) => {
    setAuthToken(token);
    set({
      user,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue cleanup on failure
    } finally {
      setAuthToken(null);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  initAuth: async () => {
    set({ isLoading: true });
    try {
      // Attempt silent refresh using httpOnly cookie
      const res = await authApi.refresh();
      set({
        user: res.user,
        accessToken: res.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return false;
    }
  },
}));
