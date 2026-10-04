export const DEFAULT_SANDBOX_URL =
  (import.meta.env.PUBLIC_SANDBOX_URL as string) ||
  (import.meta.env.DEV ? 'http://localhost:5174' : 'http://localhost:8081');
