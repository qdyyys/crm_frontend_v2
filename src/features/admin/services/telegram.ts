import { api } from "@/lib/axios";

export const fetchAllTgAccounts = async () => {
  const res = await api.get("/panel/accounts/admin/telegram/all");
  return Array.isArray(res.data?.telegram_accounts)
    ? res.data.telegram_accounts
    : [];
};

export const shareTelegramAccount = (
  telegram_account_id: string,
  target_account_login: string
) =>
  api.post(
    `/panel/telegram/accounts/${encodeURIComponent(telegram_account_id)}/share`,
    { target_account_login }
  );

export const revokeTelegramShare = (
  telegram_account_id: string,
  target_account_login: string
) =>
  api.delete(
    `/panel/telegram/accounts/${encodeURIComponent(
      telegram_account_id
    )}/revoke/${encodeURIComponent(target_account_login)}`
  );

/** Удалить Telegram аккаунт (только для chief_admin) */
export const deleteTelegramAccount = async (
  telegram_account_id: string | number
) => {
  const res = await api.delete(
    `/panel/telegram/accounts/${encodeURIComponent(
      String(telegram_account_id)
    )}`
  );
  return res?.data;
};

/** Новое: получить каналы пользователя (для выдачи канала TG-аккаунту) */
export const fetchUserChannels = async (user_id: number | string) => {
  const res = await api.get("/panel/accounts/admin/user-channels", {
    params: { user_id },
  });
  return Array.isArray(res.data?.channels) ? res.data.channels : [];
};

/** Новое: установить канал для Telegram-аккаунта */
export const setTelegramChannel = async (opts: {
  channel_id: string | number;
  telegram_account_id: string | number;
}) => {
  const body = {
    channel_id: String(opts.channel_id),
    telegram_account_id: String(opts.telegram_account_id),
  };
  const res = await api.post("/panel/accounts/admin/set-channel", body);
  return res?.data;
};

export async function setTelegramLanguage(payload: {
  telegram_account_id: string | number;
  language: string;
}) {
  const { data } = await api.post(
    "/panel/accounts/admin/telegram/set-language",
    {
      telegram_account_id: String(payload.telegram_account_id),
      language: String(payload.language).toUpperCase(),
    }
  );
  return data;
}
