import { apiPost } from '@/services/api/client';

export interface AuthResponse {
  accessToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  country?: string;
}

export async function loginRequest(input: LoginInput): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/auth/login', input, true);
}

export async function registerRequest(input: RegisterInput): Promise<AuthResponse> {
  return apiPost<AuthResponse>('/auth/register', input, true);
}
