"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { shareTelegramAccount } from "../../services/telegram";
import { tgDisplayName, tgSecondaryLine, tgId } from "../../utils/tg";
import type { TelegramAccount } from "../../types";
import InputField from "@/components/InputField";
import { ExternalLink, Settings2, Trash } from "lucide-react";
import { IfPerm } from "@/features/utils/acl";
import { deleteTelegramAccount } from "@/features/admin/services/telegram";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import TgAccountSettingsModal from "../TgAccountSettingsModal";

type Props = {
  tg: TelegramAccount;
  onRefreshAccounts?: () => void;
};

function getUserIdFromTg(tg: any): number | null {
  const candidate =
    tg?.user_id ??
    tg?.owner_user_id ??
    tg?.account_user_id ??
    tg?.account_id ??
    tg?.owner_id;
  if (candidate == null) return null;
  const n = Number(candidate);
  return Number.isFinite(n) ? n : null;
}

export default function TgAccountCard({ tg, onRefreshAccounts }: Props) {
  const navigate = useNavigate();
  const me = useSelector((s: RootState) => s.user.user);

  const [shareTo, setShareTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState<
    null | "channel" | "proxy" | "translation"
  >(null);

  const id = tgId(tg);
  const isChief = Array.isArray((me as any)?.perms)
    ? (me as any).perms.includes("chief_admin")
    : false;

  const go = () => {
    if (!id) return;
    navigate(`/chats?tg=${encodeURIComponent(String(id))}`);
  };

  const onDeleteAccount = async () => {
    if (!id) return toast.error("Не удалось определить ID Telegram аккаунта");
    try {
      setDeleting(true);
      await deleteTelegramAccount(String(id));
      toast.success("Аккаунт удалён");
      onRefreshAccounts?.();
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось удалить аккаунт";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/5 bg-[#313c4933] p-3 w-full hover:border-[#2b5278] hover:bg-[#17212b] transition focus:outline-none focus:ring-1 focus:ring-[#2b5278] relative">
      <div className="flex items-center gap-3">
        <div
          className={`shrink-0 ${
            tg?.is_premium ? "ring-1 ring-[#cba6f7]/40 rounded-full" : ""
          }`}
        >
          {tg?.avatar ? (
            <img
              src={tg.avatar as string}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#1e2c3a] flex items-center justify-center text-[10px] text-white/70">
              TG
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-white/90 text-sm">
              {tgDisplayName(tg)}
            </span>
            {tg?.is_premium && <Badge className="action-badge">Premium</Badge>}
          </div>
          <p className="text-xs text-inactive truncate">
            {tgSecondaryLine(tg) || "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {isChief && (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-[1fr_auto] items-center">
            <InputField
              value={shareTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setShareTo(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                e.key === "Enter" && onShare()
              }
              placeholder="Логин пользователя"
              disabled={busy}
              className="w-full"
            />
            <Button
              onClick={onShare}
              disabled={busy}
              aria-busy={busy}
              className="w-full sm:w-auto justify-center whitespace-nowrap outline-none cursor-pointer px-3 py-1 rounded-lg border select-none
                         border-[#1e2c3a] bg-[#121a24] text-white/90
                         hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]
                         disabled:opacity-60 disabled:cursor-not-allowed"
              variant="ghost"
            >
              Поделиться
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-1">
          <Button
            onClick={() => setSettingsOpen("channel")}
            className="w-full justify-center whitespace-nowrap outline-none cursor-pointer px-3 py-2 rounded-lg border select-none
                       border-[#1e2c3a] bg-[#121a24] text-white/90
                       hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
            variant="ghost"
            title="Настройки аккаунта (канал и прокси)"
          >
            Настройки <Settings2 size={16} />
          </Button>

          <Button
            onClick={go}
            className="w-full justify-center whitespace-nowrap outline-none cursor-pointer px-3 py-2 rounded-lg border select-none
                       border-[#1e2c3a] bg-[#121a24] text-white/90
                       hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
            variant="ghost"
          >
            Перейти <ExternalLink size={16} />
          </Button>

          <IfPerm perm="chief_admin">
            <Button
              onClick={onDeleteAccount}
              disabled={deleting}
              className="w-full justify-center whitespace-nowrap outline-none cursor-pointer px-3 py-2 rounded-lg border select-none border-red-400/40 bg-red-900/20 text-red-300/90 hover:border-red-400 disabled:opacity-60 disabled:cursor-not-allowed"
              variant="ghost"
              title="Удалить Telegram аккаунт"
            >
              Удалить <Trash size={16} />
            </Button>
          </IfPerm>
        </div>
      </div>

      {settingsOpen && id != null && (
        <TgAccountSettingsModal
          open={!!settingsOpen}
          initialTab={settingsOpen}
          onClose={() => setSettingsOpen(null)}
          telegramAccountId={String(id)}
          currentProxy={tg.proxy ?? null}
          currentLanguage={(tg as any)?.language ?? null}
          username={tg.username || undefined}
          onChanged={() => onRefreshAccounts?.()}
          ownerUserId={getUserIdFromTg(tg)}
        />
      )}
    </div>
  );

  async function onShare() {
    const login = shareTo.trim();
    if (!id) return toast.error("Не удалось определить ID Telegram аккаунта");
    if (!login) return toast.warning("Укажитете логин, с кем поделиться");
    try {
      setBusy(true);
      await shareTelegramAccount(id, login);
      toast.success("Доступ к Telegram аккаунту выдан");
      setShareTo("");
      onRefreshAccounts?.();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || "Не удалось поделиться аккаунтом";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }
}
