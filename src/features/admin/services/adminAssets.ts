import { api } from "@/lib/axios";

export type AdminAssignScriptDto = {
  target_login: string;
  name: string;
  message: string;
  telegram_account_id: string | number;
};

export async function adminAssignScript(payload: AdminAssignScriptDto) {
  const { data } = await api.post(
    "/panel/accounts/scripts/admin/assign",
    payload
  );
  return data;
}

export async function adminGetUserScripts(login: string) {
  const { data } = await api.get(
    `/panel/accounts/scripts/admin/user/${encodeURIComponent(login)}`
  );
  return (data?.data?.scripts ?? []) as Array<{
    name: string;
    message: string;
    telegram_account_id?: string | number;
  }>;
}

export type AdminAssignVideoDto = {
  target_login: string;
  video_base64: string;
  button_name: string;
  telegram_account_id: string | number;
  is_video_note?: boolean;
  message?: string;
};

export async function adminAssignVideo(payload: AdminAssignVideoDto) {
  const { data } = await api.post(
    "/panel/telegram/videos/admin/assign",
    payload
  );
  return data;
}

export async function adminGetUserVideos(login: string) {
  const { data } = await api.get(
    `/panel/telegram/videos/admin/user/${encodeURIComponent(login)}`
  );
  return (data?.data ?? data ?? []) as any[];
}
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(String(reader.result));
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
