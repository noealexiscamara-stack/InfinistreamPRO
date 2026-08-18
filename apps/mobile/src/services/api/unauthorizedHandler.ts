let onUnauthorized: (() => void) | null = null;

/** Registered once from the root layout — triggers logout + navigation to /login. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export function notifyUnauthorized(): void {
  onUnauthorized?.();
}
