import { api } from "@/lib/axios";

export type ProxyConfig = {
  // добавили варианты из твоего кастомного селекта
  type: "http" | "https" | "socks4" | "socks4a" | "socks5" | string;
  host: string;
  port: number | ""; // ← чтобы форма могла держать пустую строку
  username?: string;
  password?: string;
};

export type ProxyTestResult = {
  success: boolean;
  status_code?: number;
  response_time?: string;
  proxy_ip?: string;
  error?: string;
};

export type ProxyResponse = {
  telegram_account_id: string;
  has_proxy: boolean;
  proxy: ProxyConfig | null;
  test_result?: ProxyTestResult;
};

// Добавить прокси (по спекам: add = add/update)
export const addProxy = async (
  telegram_account_id: string,
  proxy: ProxyConfig
) => {
  const res = await api.post<ProxyResponse>(
    "/panel/accounts/admin/telegram/proxy/add",
    { telegram_account_id, proxy }
  );
  return res.data;
};

// Обновить прокси
export const updateProxy = async (
  telegram_account_id: string,
  proxy: ProxyConfig
) => {
  const res = await api.post<ProxyResponse>(
    "/panel/accounts/admin/telegram/proxy/update",
    { telegram_account_id, proxy }
  );
  return res.data;
};

// Удалить прокси
export const removeProxy = async (telegram_account_id: string) => {
  const res = await api.post<ProxyResponse>(
    "/panel/accounts/admin/telegram/proxy/remove",
    { telegram_account_id }
  );
  return res.data;
};

// Проверить прокси
export const testProxy = async (telegram_account_id: string) => {
  const res = await api.post<ProxyResponse>(
    "/panel/accounts/admin/telegram/proxy/test",
    { telegram_account_id }
  );
  return res.data;
};
