const TOKEN_KEY = 'infiny.accessToken';
const EMAIL_KEY = 'infiny.email';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getEmail() {
  return localStorage.getItem(EMAIL_KEY);
}

export function isSignedIn() {
  return Boolean(getToken());
}

export function saveSession(accessToken, email) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (email) localStorage.setItem(EMAIL_KEY, email);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
