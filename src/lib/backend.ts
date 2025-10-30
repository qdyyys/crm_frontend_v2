const RAW =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  `${window.location.origin}/api/v1`;

const CLEAN = RAW.replace(/\/+$/, "");
export const BACKEND_HTTP_BASE = CLEAN;

const u = new URL(BACKEND_HTTP_BASE, window.location.origin);
const isHttps = u.protocol === "https:";
const WS_SCHEME = isHttps ? "wss:" : "ws:";
const API_PREFIX = u.pathname.replace(/\/+$/, "");

export function httpPath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${u.origin}${API_PREFIX}${p}`;
}

export function wsPath(path: string, query?: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  return `${WS_SCHEME}//${u.host}${API_PREFIX}${p}${q}`;
}
