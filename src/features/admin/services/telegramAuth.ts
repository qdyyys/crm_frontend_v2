import { api } from "@/lib/axios";

export type ProxyData = {
  type: string;
  host: string;
  port: string;
  username: string;
  password: string;
};

export const startAuth = async (useProxy: boolean, proxy?: ProxyData) => {
  const body: any = {};
  if (useProxy && proxy) {
    body.proxy = {
      type: proxy.type || "http",
      host: proxy.host,
      port: proxy.port ? parseInt(String(proxy.port), 10) : 0,
      username: proxy.username || "",
      password: proxy.password || "",
    };
  }
  const res = await api.post("/telegram/auth/start", body);
  return res.data?.session_id as string;
};

export const sendPhone = (sid: string, phone: string) =>
  api.post(`/telegram/auth/${sid}/phone`, { phone });

export const sendCode = (sid: string, code: string) =>
  api.post(`/telegram/auth/${sid}/code`, { code });

export const sendPassword = (sid: string, password: string) =>
  api.post(`/telegram/auth/${sid}/password`, { password });

export const getStatus = async (sid: string) => {
  const r = await api.get(`/telegram/auth/${sid}/status`);
  return r.data as {
    status?: string;
    required_input?: string;
    message?: string;
    attempts_left?: number;
  };
};
