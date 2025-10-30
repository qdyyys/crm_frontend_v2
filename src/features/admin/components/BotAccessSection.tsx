import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InputField from "@/components/InputField";
import { Plus, X, Bot } from "lucide-react";
import {
  fetchBot,
  addBotUser,
  removeBotUser,
} from "@/features/admin/services/bot";
import { toast } from "sonner";

export default function BotAccessSection() {
  const me = useSelector((s: RootState) => s.user.user);
  const isChief = Array.isArray((me as any)?.perms)
    ? (me as any).perms.includes("chief_admin")
    : false;
  const [loading, setLoading] = useState(false);
  const [botUsers, setBotUsers] = useState<string[]>([]);
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchBot();
      setBotUsers(data.users || []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось получить бота";
      toast.error(msg);
      setBotUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isChief) load();
  }, [isChief]);

  const onAdd = async () => {
    const user = login.trim();
    if (!user) return toast.warning("Укажите логин пользователя");
    try {
      setBusy("add");
      const data = await addBotUser(user);
      setBotUsers(data.users || []);
      setLogin("");
      toast.success("Пользователь добавлен");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось добавить";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (user: string) => {
    try {
      setBusy(user);
      const data = await removeBotUser(user);
      setBotUsers(data.users || []);
      toast.success("Пользователь удалён");
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Не удалось удалить";
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  if (!isChief) return null;

  return (
    <Card className="modern-card">
      <CardHeader className="card-header">
        <CardTitle className="section-title">
          <div className="title-icon">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3>Доступ к боту</h3>
            <p className="section-subtitle">Пользователи с доступом</p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="card-content">
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all h-9 has-[>svg]:px-3 outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              Загрузка…
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-[1fr_auto] items-center">
              <InputField
                value={login}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLogin(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                  e.key === "Enter" && onAdd()
                }
                placeholder="ID Telegram"
              />
              <Button
                onClick={onAdd}
                disabled={busy === "add"}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-accent/50 h-9 has-[>svg]:px-3 outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                variant="ghost"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-3 rounded-xl border border-white/5 bg-[#0e1621]/60 max-h-[360px] overflow-auto divide-y divide-white/5">
              {!botUsers.length ? (
                <div className="p-4 text-center text-inactive rounded-xl bg-[#313c4933]">
                  Пока нет пользователей
                </div>
              ) : (
                <ul>
                  {botUsers.map((u: string) => (
                    <li
                      key={u}
                      className="px-4 py-2 flex items-center justify-between gap-3"
                    >
                      <div className="truncate text-white/90">{u}</div>
                      <Button
                        onClick={() => onRemove(u)}
                        disabled={busy === u}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-accent/50 h-9 has-[>svg]:px-3 outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                        variant="ghost"
                        title="Удалить доступ"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
