import { api } from "@/lib/axios";

export type BotInfo = {
  id: string;
  created_at?: string;
  updated_at?: string;
  users: string[];
};

function normalizeBot(raw: any): BotInfo {
  return {
    id: String(raw?.id ?? raw?._id ?? ""),
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
    users: Array.isArray(raw?.users) ? raw.users.map((u: any) => String(u)) : [],
  };
}

export async function fetchBot(): Promise<BotInfo> {
  const { data } = await api.get("/panel/accounts/admin/bot");
  return normalizeBot(data);
}

export async function addBotUser(user: string): Promise<BotInfo> {
  const { data } = await api.post("/panel/accounts/admin/bot/add-user", { user });
  return normalizeBot(data);
}

export async function removeBotUser(user: string): Promise<BotInfo> {
  const { data } = await api.post("/panel/accounts/admin/bot/remove-user", { user });
  return normalizeBot(data);
}


