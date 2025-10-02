import type { TelegramAccount } from "../types";

export const tgDisplayName = (tg: TelegramAccount) => {
  const fio = [tg?.first_name, tg?.last_name].filter(Boolean).join(" ").trim();
  if (fio) return fio;
  if (tg?.username) return `@${tg.username}`;
  return tg?.phone || "Без имени";
};

export const tgSecondaryLine = (tg: TelegramAccount) => {
  const parts: string[] = [];
  if (tg?.username) parts.push(`@${tg.username}`);
  else if (tg?.phone) parts.push(tg.phone as string);
  if (tg?.added_at) {
    try {
      parts.push(
        `добавлен ${new Date(tg.added_at as any).toLocaleDateString()}`
      );
    } catch {
      /* ignore date parse errors */
    }
  }
  return parts.join(" · ");
};

/** безопасный строковый id для ключей и запросов */
export const tgId = (tg: TelegramAccount): string => {
  const raw =
    tg?.crm_id ?? tg?.telegram_id ?? tg?.user_id ?? tg?.id ?? tg?.phone ?? "";
  return String(raw ?? "");
};
