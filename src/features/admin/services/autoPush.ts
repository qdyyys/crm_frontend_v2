import { api } from "@/lib/axios";

export type AutoPushStatusItem = {
  status: string | null | undefined;
  line: string;
  [k: string]: any;
};

export type AutoPushActiveItem = {
  id: string;
  status: string;
  telegram_account_id: string;
  message: string;
  delay_seconds: number;
  [k: string]: any;
};

export type AutoPushHistoryItem = {
  id: string;
  status: string;
  telegram_account_id: string;
  message: string;
  delay_seconds: number;
  [k: string]: any;
};

export async function getChatsByStatus(telegram_account_id: string) {
  const { data } = await api.get(
    "/panel/accounts/admin/auto-push/chats-by-status",
    { params: { telegram_account_id } }
  );
  const raw = Array.isArray(data?.status) ? data.status : [];
  return raw as AutoPushStatusItem[];
}

function isRecord(v: any): v is Record<string, any> {
  return v != null && typeof v === "object";
}

function normActiveItem(x: any): AutoPushActiveItem | null {
  if (!isRecord(x)) return null;
  const id = x.id ?? x._id ?? x.uid;
  const status = x.status;
  if (id == null || status == null) return null;
  return {
    id: String(id),
    status: String(status),
    telegram_account_id: String(x.telegram_account_id ?? x.tga_id ?? ""),
    message: String(x.message ?? ""),
    delay_seconds: Number(x.delay_seconds ?? x.delay ?? 0),
    ...x,
  };
}

function normHistoryItem(x: any): AutoPushHistoryItem | null {
  if (!isRecord(x)) return null;
  const id = x.id ?? x._id ?? x.uid;
  const status = x.status;
  if (id == null || status == null) return null;
  return {
    id: String(id),
    status: String(status),
    telegram_account_id: String(x.telegram_account_id ?? x.tga_id ?? ""),
    message: String(x.message ?? ""),
    delay_seconds: Number(x.delay_seconds ?? x.delay ?? 0),
    ...x,
  };
}

function pickArray(payload: any, keys: string[]): any[] {
  if (Array.isArray(payload)) return payload;
  for (const k of keys) {
    const v = payload?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

export async function getActiveAutoPushes() {
  const { data } = await api.get("/panel/accounts/admin/auto-push/active");
  const arr = pickArray(data, ["auto_pushes", "data", "items"]);
  return arr.map(normActiveItem).filter(Boolean) as AutoPushActiveItem[];
}

export async function getAutoPushHistory(limit = 100) {
  const { data } = await api.get("/panel/accounts/admin/auto-push/history", {
    params: { limit },
  });
  const arr = pickArray(data, ["history", "data", "items", "auto_pushes"]);
  return arr.map(normHistoryItem).filter(Boolean) as AutoPushHistoryItem[];
}

export async function createAutoPush(payload: {
  telegram_account_id: string;
  status: string;
  message: string;
  delay_seconds: number;
  photos?: string[];
  videos?: string[];
}) {
  const { data } = await api.post(
    "/panel/accounts/admin/auto-push/create",
    payload
  );
  return data;
}

export async function stopAutoPush(id: string) {
  const { data } = await api.delete(`/panel/accounts/admin/auto-push/${id}`);
  return data;
}
