export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginPayload {
  login: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
}
