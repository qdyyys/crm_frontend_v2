// src/lib/backend.ts
const RAW =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  `${window.location.origin}/api/v1`;

const CLEAN = RAW.replace(/\/+$/, ""); // убираем хвостовой /
export const BACKEND_HTTP_BASE = CLEAN; // например: https://tgcrm666.com/api/v1  или  http://localhost:3000/api/v1

// Разбираем, чтобы получить origin (host+schema) и префикс пути (/api/v1)
const u = new URL(BACKEND_HTTP_BASE, window.location.origin);
const isHttps = u.protocol === "https:";
const WS_SCHEME = isHttps ? "wss:" : "ws:";
const API_PREFIX = u.pathname.replace(/\/+$/, ""); // "/api/v1" или ""

export function httpPath(path: string) {
  // склеиваем корректно для REST, если где-то нужно без axios
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${u.origin}${API_PREFIX}${p}`;
}

export function wsPath(path: string, query?: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const q = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  return `${WS_SCHEME}//${u.host}${API_PREFIX}${p}${q}`;
}
