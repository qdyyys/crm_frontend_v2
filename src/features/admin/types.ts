export type RoleKey = "chief_admin" | "admin" | "manager" | "shadow_manager";
export type StatPeriod = "day" | "week" | "month" | "year";

export type TelegramAccount = {
  id?: string | number;
  telegram_id?: string | number;
  user_id?: string | number;
  crm_id?: string | number;
  phone?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  is_premium?: boolean;
  added_at?: string | number | Date;
  [key: string]: any;
};

export const ALL_ROLES: RoleKey[] = [
  "chief_admin",
  "admin",
  "manager",
  "shadow_manager",
];

export function toRoleKey(raw?: string | null): RoleKey | null {
  if (!raw) return null;
  const k = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return (
    ["chief_admin", "admin", "manager", "shadow_manager"] as const
  ).includes(k as RoleKey)
    ? (k as RoleKey)
    : null;
}
