import { api } from "@/lib/axios";

export type ProxyConfig = {
  type: "http" | "https" | "socks4" | "socks4a" | "socks5" | string;
  host: string;
  port: number | "";
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

export const removeProxy = async (telegram_account_id: string) => {
  const res = await api.post<ProxyResponse>(
    "/panel/accounts/admin/telegram/proxy/remove",
    { telegram_account_id }
  );
  return res.data;
};

export const testProxy = async (telegram_account_id: string) => {
  const res = await api.post<ProxyResponse>(
    "/panel/accounts/admin/telegram/proxy/test",
    { telegram_account_id }
  );
  return res.data;
};
