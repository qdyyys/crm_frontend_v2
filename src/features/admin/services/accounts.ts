import { api } from "@/lib/axios";
import type { RoleKey } from "../types";

export type TelegramRole = "first_line" | "second_line";

export const setTelegramRole = (
  target_login: string,
  telegram_account_id: string | number,
  role: TelegramRole
) =>
  api.post("/panel/accounts/admin/set-telegram-role", {
    role,
    target_login,
    telegram_account_id: String(telegram_account_id),
  });

export const GIVE_ROLE_ENDPOINT: Record<RoleKey, string> = {
  admin: "/panel/accounts/admin/give-admin",
  manager: "/panel/accounts/admin/give-manager",
  shadow_manager: "/panel/accounts/admin/give-shadow-manager",
  chief_admin: "/panel/accounts/admin/give-chief-admin",
};

export const REMOVE_ROLE_ENDPOINT: Record<RoleKey, string> = {
  admin: "/panel/accounts/admin/remove-admin",
  manager: "/panel/accounts/admin/remove-manager",
  shadow_manager: "/panel/accounts/admin/remove-shadow-manager",
  chief_admin: "/panel/accounts/admin/remove-chief-admin",
};

export const fetchAccounts = async () => {
  const res = await api.get("/panel/accounts/admin/all");
  return res.data?.accounts ?? [];
};

export const banUser = (login: string) =>
  api.post("/panel/accounts/admin/ban", { login });

export const unbanUser = (login: string) =>
  api.post("/panel/accounts/admin/unban", { login });

export const disable2FA = (login: string) =>
  api.post(`/panel/accounts/2fa/${encodeURIComponent(login)}/disable`, {});

export const giveRole = (login: string, role: RoleKey) =>
  api.post(GIVE_ROLE_ENDPOINT[role], { target_login: login });

export const removeRole = (login: string, role: RoleKey) =>
  api.post(REMOVE_ROLE_ENDPOINT[role], { target_login: login });

import type { StatPeriod } from "../types";

export const getLogs = async (login: string) => {
  const r = await api.get("/panel/accounts/admin/logs", { params: { login } });
  return r.data;
};
export const getStats = async (login: string, period: StatPeriod) => {
  const r = await api.get("/panel/accounts/admin/statistics/get", {
    params: { login, period },
  });
  return r.data;
};
