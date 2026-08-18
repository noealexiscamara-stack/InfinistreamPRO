import { requireApiUrl } from '@/config/env';
import { getAccessToken } from '@/services/auth/tokenStorage';
import { notifyUnauthorized } from '@/services/api/unauthorizedHandler';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skip Authorization header (login/register). */
  anonymous?: boolean;
};

function isAuthPath(path: string): boolean {
  return path.startsWith('/auth/login') || path.startsWith('/auth/register');
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
      return message.join(' ');
    }
  }
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = requireApiUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (!options.anonymous) {
    const token = await getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const body = await parseJsonSafe(res);

  if (res.status === 401 && !options.anonymous && !isAuthPath(path)) {
    notifyUnauthorized();
    throw new ApiError('Session expirée. Veuillez vous reconnecter.', 401, body);
  }

  if (!res.ok) {
    throw new ApiError(extractMessage(body, `Erreur ${res.status}`), res.status, body);
  }

  return body as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body: unknown, anonymous = false): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body, anonymous });
}
