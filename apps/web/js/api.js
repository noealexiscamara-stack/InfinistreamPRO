export const API_BASE = 'https://api.infinistream.pro';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body, fallback) {
  if (body && typeof body === 'object' && body.message) {
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.filter((m) => typeof m === 'string').join(' ');
  }
  return fallback;
}

export async function api(path, { method = 'GET', body, token, anonymous = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new ApiError(extractMessage(parsed, `Erreur ${res.status}`), res.status, parsed);
  }
  return parsed;
}
