import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "@/store";
import { fetchMe } from "@/services/authService";
import { useMemo, useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ShieldOff,
  FileText,
  RotateCcw,
  Filter,
  Check,
  UserCheck,
  UserRoundX,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Spline,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { permLabel } from "@/features/utils/permLabels";
import type { RoleKey } from "../types";
import { ALL_ROLES, toRoleKey } from "../types";
import { usePagination } from "../hooks/usePagination";
import {
  tgId as getTgId,
  tgDisplayName,
  tgSecondaryLine,
} from "@/features/admin/utils/tg";
import type { User } from "@/types";
import {
  banUser,
  disable2FA,
  fetchAccounts,
  giveRole,
  removeRole,
  unbanUser,
  setTelegramRole,
  type TelegramRole,
} from "../services/accounts";
import { revokeTelegramShare } from "@/features/admin/services/telegram";
import { IfPerm } from "@/features/utils/acl";
import InputField from "@/components/InputField";
import UserContentSettingsModal from "./UserContentSettingsModal";
type TLine = TelegramRole;

const normalizeLine = (v: any): TLine | null => {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (/^first(_?line)?$|^1$|^one$/.test(s)) return "first_line";
  if (/^second(_?line)?$|^2$|^two$/.test(s)) return "second_line";
  if (s === "first") return "first_line";
  if (s === "second") return "second_line";
  return null;
};

const extractTgLines = (tg: any): TLine[] => {
  const out = new Set<TLine>();
  if (Array.isArray(tg?.lines))
    for (const v of tg.lines) {
      const n = normalizeLine(v);
      if (n) out.add(n);
    }
  const legacy =
    tg?.tg_role ?? tg?.telegram_role ?? tg?.role ?? tg?.line ?? tg?.tgLine;
  const nLegacy = normalizeLine(legacy);
  if (nLegacy) out.add(nLegacy);
  return Array.from(out);
};

const hasLine = (lines: TLine[], line: TLine) => lines.includes(line);

export default function UsersList({
  accounts,
  onChange,
}: {
  accounts: User[];
  onChange: (next: User[]) => void;
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const me = useSelector((s: RootState) => s.user.user);

  const [query, setQuery] = useState("");
  const [onlyWorking, setOnlyWorking] = useState(false);
  const [onlyBanned, setOnlyBanned] = useState(false);
  const [rolesFilter, setRolesFilter] = useState<RoleKey[]>([]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!filterRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setFiltersOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const activeFiltersCount =
    (onlyWorking ? 1 : 0) + (onlyBanned ? 1 : 0) + rolesFilter.length;

  const toggleRoleFilter = (rk: RoleKey) =>
    setRolesFilter((prev: RoleKey[]) =>
      prev.includes(rk) ? prev.filter((r) => r !== rk) : [...prev, rk]
    );

  const clearFilters = () => {
    setOnlyWorking(false);
    setOnlyBanned(false);
    setRolesFilter([]);
  };

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = Array.isArray(accounts) ? accounts : [];
    const passed = base.filter((acc) => {
      const isWorking = Boolean((acc as any)?.is_working);
      const isBanned = Boolean((acc as any)?.banned);

      if (onlyWorking && !isWorking) return false;
      if (onlyBanned && !isBanned) return false;

      if (rolesFilter.length) {
        const perms = (acc.perms ?? [])
          .map((p) => toRoleKey(String(p)))
          .filter(Boolean);
        const hasAny = rolesFilter.some((r) => perms.includes(r));
        if (!hasAny) return false;
      }

      if (!q) return true;

      const hay = [
        acc.login,
        acc.email,
        acc.telegram,
        ...(Array.isArray((acc as any).telegram_accounts)
          ? (acc as any).telegram_accounts.map((t: any) =>
              [
                tgDisplayName(t),
                tgSecondaryLine(t),
                t?.phone,
                t?.username,
                t?.first_name,
                t?.last_name,
              ]
                .filter(Boolean)
                .join(" ")
            )
          : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });

    return passed;
  }, [accounts, q, onlyWorking, onlyBanned, rolesFilter]);

  const { page, totalPages, pageItems, nextPage, prevPage } = usePagination(
    filtered,
    6
  );
  const totalPagesMemo = useMemo(() => totalPages, [totalPages]);

  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);
  const [rolePickerFor, setRolePickerFor] = useState<string | null>(null);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [banBusy, setBanBusy] = useState<string | null>(null);
  const [twoFaBusy, setTwoFaBusy] = useState<string | null>(null);
  const [tgRoleBusy, setTgRoleBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [openedTg, setOpenedTg] = useState<Set<string>>(new Set());
  const isTgOpen = (login: string) => openedTg.has(login);
  const toggleTg = (login: string) =>
    setOpenedTg((prev: Set<string>) => {
      const next = new Set(prev);
      next.has(login) ? next.delete(login) : next.add(login);
      return next;
    });

  const [settingsUser, setSettingsUser] = useState<null | {
    id: string | number;
    username?: string;
    login: string;
    telegramAccounts?: any[];
  }>(null);

  const openChatsWithTg = (tg: any) => {
    const id = getTgId(tg);
    if (!id) return;
    navigate(`/chats?tg=${encodeURIComponent(String(id))}`);
  };

  const onBan = async (login: string, value: boolean) => {
    setBanBusy(login);
    try {
      if (value) await banUser(login);
      else await unbanUser(login);
      onChange(await fetchAccounts());
      toast.success("Пользователь удален");
    } catch {
      toast.error(
        value ? "Не удалось заблокировать" : "Не удалось разблокировать"
      );
    } finally {
      setBanBusy(null);
    }
  };

  const onDisable2FA = async (login: string) => {
    const ok = window.confirm(`Отключить 2FA для пользователя "${login}"?`);
    if (!ok) return;
    setTwoFaBusy(login);
    try {
      await disable2FA(login);
      onChange(await fetchAccounts());
      toast.success("2FA отключена");
    } catch {
      toast.error("Не удалось отключить 2FA");
    } finally {
      setTwoFaBusy(null);
    }
  };

  const onGiveRole = async (login: string, role: RoleKey) => {
    const key = `${login}:${role}`;
    setRoleBusy(key);
    try {
      await giveRole(login, role);
      onChange(await fetchAccounts());
      toast.success(`Выдана роль: ${permLabel(role)}`);
      setRolePickerFor(null);
    } catch {
      toast.error("Не удалось выдать роль");
    } finally {
      setRoleBusy(null);
    }
  };

  const onRemoveRole = async (login: string, roleRaw: string) => {
    const role = toRoleKey(roleRaw);
    if (!role) return toast.warning("Эту роль нельзя снять здесь");
    const key = `${login}:${role}`;
    setRoleBusy(key);
    try {
      await removeRole(login, role);
      onChange(await fetchAccounts());
      toast.success(`Снята роль: ${permLabel(role)}`);
    } catch {
      toast.error("Не удалось снять роль");
    } finally {
      setRoleBusy(null);
    }
  };

  const onRevokeTgForUser = async (tg: any, targetLogin: string) => {
    const id = getTgId(tg);
    if (!id) return toast.error("Не удалось определить ID Telegram аккаунта");
    const key = `${id}:${targetLogin}`;
    try {
      setRevokeBusy(key);
      await revokeTelegramShare(id, targetLogin);
      toast.success("Доступ к Telegram аккаунту отозван");
      onChange(await fetchAccounts());
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось отозвать доступ");
    } finally {
      setRevokeBusy(null);
    }
  };

  const onSetTgRole = async (
    login: string,
    telegramAccountId: string | number,
    role: TelegramRole
  ) => {
    const key = `${login}:${telegramAccountId}:${role}`;
    try {
      setTgRoleBusy(key);
      await setTelegramRole(login, telegramAccountId, role);

      onChange(await fetchAccounts());

      const shouldRefreshMe =
        !!me &&
        (me.login === login ||
          (Array.isArray((me as any).telegram_accounts) &&
            (me as any).telegram_accounts.some(
              (tg: any) => String(getTgId(tg)) === String(telegramAccountId)
            )));

      if (shouldRefreshMe) {
        await fetchMe(dispatch as any);
      }

      toast.success(
        `Назначено: ${role === "first_line" ? "1 линия" : "2 линия"}`
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось назначить роль");
    } finally {
      setTgRoleBusy(null);
    }
  };

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      onChange([]);
      const next = await fetchAccounts();
      onChange(next);
      toast.success("Обновлено");
    } catch {
      toast.error("Не удалось обновить");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <Card className="modern-card overflow-visible z-40 relative visib">
        <CardHeader className="card-header">
          <CardTitle className="section-title">
            <div className="title-icon">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3>Пользователи</h3>
              <p className="section-subtitle">Поиск, фильтры и действия</p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="card-content overflow-visible">
          <div className="mb-4 space-y-2">
            <div className="grid gap-2 md:grid-cols-[1fr_auto] items-center">
              <div className="min-w-0">
                <InputField
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по логину, email, tg…"
                  className="w-full"
                  withSearchIcon
                />
              </div>

              <div className="flex items-center flex-nowrap gap-1">
                <div ref={filterRef} className="relative shrink-0">
                  <Button
                    onClick={() => setFiltersOpen((v) => !v)}
                    className="outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] flex items-center gap-2 whitespace-nowrap"
                    variant="ghost"
                    title="Фильтры"
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Фильтры</span>
                    {activeFiltersCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-4 px-1 text-[10px] rounded bg-[#2b5278] text-[#cfe3ff]">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>

                  {filtersOpen && (
                    <div
                      className="absolute top-full left-0 md:left-auto md:right-0 mt-2 z-[9999999999]
               w-[305px] rounded-xl border border-[#233243]
               bg-[#0c141d] shadow-xl p-3 overflow-auto"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-inactive mb-2">
                        Статус
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                          {
                            key: "onlyWorking",
                            label: "Активные",
                            value: onlyWorking,
                            toggle: () => setOnlyWorking((v) => !v),
                          },
                          {
                            key: "onlyBanned",
                            label: "Забанены",
                            value: onlyBanned,
                            toggle: () => setOnlyBanned((v) => !v),
                          },
                        ].map((it) => (
                          <button
                            key={it.key}
                            onClick={it.toggle}
                            className={`cursor-pointer w-full inline-flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
            ${
              it.value
                ? "border-[#2b5278] bg-[#17212b] text-[#cfe3ff]"
                : "border-white/10 bg-transparent text-white/80 hover:border-[#2b5278]"
            }`}
                          >
                            <span>{it.label}</span>
                            {it.value && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        ))}
                      </div>

                      <div className="text-[11px] uppercase tracking-wide text-inactive mb-2">
                        Роли
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {ALL_ROLES.map((rk) => {
                          const active = rolesFilter.includes(rk);
                          return (
                            <button
                              key={rk}
                              onClick={() => toggleRoleFilter(rk)}
                              className={`cursor-pointer w-full inline-flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                active
                                  ? "border-[#2b5278] bg-[#17212b] text-[#cfe3ff]"
                                  : "border-white/10 bg-transparent text-white/80 hover:border-[#2b5278]"
                              }`}
                              title={`Фильтр: ${permLabel(rk)}`}
                            >
                              <span className="truncate">{permLabel(rk)}</span>
                              {active && <Check className="w-4 h-4 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex items-center justify-between ">
                        <button
                          onClick={clearFilters}
                          className="text-[12px] text-inactive hover:text-[#9ec1ff] cursor-pointer"
                        >
                          Сбросить все
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={refresh}
                  disabled={refreshing}
                  aria-busy={refreshing}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-accent/50 h-9 has-[>svg]:px-3 outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                  variant="ghost"
                  title="Обновить"
                >
                  <RotateCcw
                    className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                </Button>

                <Badge className="ml-1 px-3 py-2 rounded-md border text-[11px] select-none border-[#1e2c3a] bg-[#121a24] text-white/80 shrink-0">
                  <span className="hidden sm:inline">Найдено:&nbsp;</span>
                  {filtered.length}
                </Badge>
              </div>
            </div>
          </div>

          {!filtered.length ? (
            <div className="p-6 text-center text-inactive">
              {query.trim() ? (
                "Ничего не найдено"
              ) : (
                <div className="flex items-center justify-center">
                  <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-accent/50 h-9 has-[>svg]:px-3 outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90">
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
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 items-start">
                {pageItems.map((acc, i) => {
                  const isWorking = Boolean((acc as any)?.is_working);

                  return (
                    <div
                      key={acc.login}
                      className="rounded-2xl border border-white/10 bg-[#0e1621]/60 backdrop-blur hover:border-[#2b5278] transition-colors"
                      style={
                        { ["--delay" as any]: `${i * 0.05}s` } as CSSProperties
                      }
                    >
                      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate flex items-center gap-2">
                            {acc.login}
                            <span
                              className={`block w-1.5 h-1.5 rounded-full ${
                                isWorking ? "bg-[#18a3e6]" : "bg-gray-400"
                              }`}
                            />
                          </div>
                          <div className="text-xs text-inactive truncate">
                            {acc.email || "—"}
                          </div>
                          <div className="text-xs truncate mt-0.5">
                            <span className="text-inactive">Telegram: </span>
                            {acc.telegram ? (
                              <a
                                href={`https://t.me/${String(
                                  acc.telegram
                                ).replace(/^@/, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#9ec1ff] hover:underline"
                                title={String(acc.telegram)}
                              >
                                {String(acc.telegram).startsWith("@")
                                  ? String(acc.telegram)
                                  : `@${String(acc.telegram)}`}
                              </a>
                            ) : (
                              <span className="text-inactive">—</span>
                            )}
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-1 flex-nowrap overflow-x-auto md:overflow-visible
             [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <Button
                            onClick={() => {
                              setSettingsUser({
                                id: (acc as any)?.id ?? acc.login,
                                username: acc.login,
                                login: acc.login,
                                telegramAccounts:
                                  (acc as any)?.telegram_accounts ?? [],
                              });
                            }}
                            className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                            variant="ghost"
                            title="Настройки пользователя (Видео/Скрипты)"
                          >
                            <Settings size={18} />
                          </Button>

                          {Boolean((acc as any)?.banned) ? (
                            <Button
                              onClick={() => onBan(acc.login, false)}
                              disabled={banBusy === acc.login}
                              className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border
                 border-emerald-700/40 bg-emerald-900/10 text-emerald-300/90 hover:border-emerald-600"
                              variant="ghost"
                              title="Разблокировать пользователя"
                            >
                              <UserCheck size={18} />
                            </Button>
                          ) : (
                            <Button
                              onClick={() => onBan(acc.login, true)}
                              disabled={banBusy === acc.login}
                              className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border
                 border-red-400/40 bg-red-900/20 text-red-300/90 hover:border-red-400"
                              variant="ghost"
                              title="Удалить пользователя"
                            >
                              <UserRoundX size={18} />
                            </Button>
                          )}

                          <IfPerm perm="chief_admin">
                            {Boolean((acc as any)?.["2fa"]) && (
                              <Button
                                onClick={() => onDisable2FA(acc.login)}
                                disabled={twoFaBusy === acc.login}
                                className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border
                   border-[#2f6ea5]/40 bg-[#2f6ea5]/10 text-[#4d91ce] hover:border-[#2f6ea5]"
                                variant="ghost"
                                title="Отключить 2FA"
                              >
                                <ShieldOff className="w-3.5 h-3.5 mr-1" />
                                Отключить 2FA
                              </Button>
                            )}
                          </IfPerm>
                        </div>
                      </div>

                      <div className="px-4 mt-3">
                        <div className="text-[11px] tracking-wide text-[#69b2f1] font-semibold mb-2">
                          РОЛИ ПОЛЬЗОВАТЕЛЯ
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {(acc.perms ?? []).length ? (
                            (acc.perms ?? []).map((perm, idx) => {
                              const label = permLabel(perm);
                              const rk = toRoleKey(String(perm));
                              const busy = roleBusy === `${acc.login}:${rk}`;
                              return (
                                <div
                                  key={idx}
                                  title={
                                    rk
                                      ? "Нажмите, чтобы снять роль"
                                      : "Системная роль"
                                  }
                                  className={`border rounded-full px-3 py-0.5 text-xs cursor-pointer border-[#2f6ea5] ${
                                    busy ? "opacity-60 pointer-events-none" : ""
                                  }`}
                                  onClick={() =>
                                    rk && onRemoveRole(acc.login, String(perm))
                                  }
                                >
                                  {label}
                                </div>
                              );
                            })
                          ) : (
                            <Badge className="border rounded-full px-3 py-0.5 text-xs cursor-pointer border-[#2f6ea5]">
                              Без прав
                            </Badge>
                          )}
                          <button
                            className="border rounded-full px-2.5 py-0.5 text-xs cursor-pointer border-[#2f6ea5]"
                            onClick={() =>
                              setRolePickerFor((cur) =>
                                cur === acc.login ? null : acc.login
                              )
                            }
                          >
                            <Plus size={15} />
                          </button>
                        </div>

                        {rolePickerFor === acc.login && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {ALL_ROLES.map((rk) => {
                              const busy = roleBusy === `${acc.login}:${rk}`;
                              const already = (acc.perms ?? []).some(
                                (p) => toRoleKey(String(p)) === rk
                              );

                              const Btn = (
                                <button
                                  key={rk}
                                  disabled={busy || already}
                                  onClick={() => onGiveRole(acc.login, rk)}
                                  className={`border rounded-full px-3 py-0.5 text-xs cursor-pointer border-[#2f6ea5] ${
                                    already
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  } ${
                                    busy ? "opacity-60 pointer-events-none" : ""
                                  }`}
                                  title={
                                    already
                                      ? "У пользователя уже есть эта роль"
                                      : `Выдать: ${permLabel(rk)}`
                                  }
                                >
                                  {permLabel(rk)}
                                </button>
                              );
                              if (rk === "chief_admin") return null;
                              if (rk === "admin") {
                                return (
                                  <IfPerm key={rk} perm="chief_admin">
                                    {Btn}
                                  </IfPerm>
                                );
                              }

                              return Btn;
                            })}

                            <button
                              onClick={() => setRolePickerFor(null)}
                              className="border rounded-full px-3 py-0.5 text-xs cursor-pointer border-[#2f6ea5]"
                            >
                              Отмена
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="px-4 mt-4 pb-4">
                        <div className="flex items							-center justify-between mb-2">
                          <div className="text-[11px] tracking-wide text-[#69b2f1] font-semibold">
                            TELEGRAM АККАУНТЫ
                          </div>
                          <button
                            className="outline-none cursor-pointer px-2 py-1 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/80 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] text-xs inline-flex items-center gap-1"
                            onClick={() => toggleTg(acc.login)}
                          >
                            {isTgOpen(acc.login) ? (
                              <>
                                Скрыть <ChevronUp className="w-3 h-3" />
                              </>
                            ) : (
                              <>
                                Показать <ChevronDown className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>

                        {isTgOpen(acc.login) && (
                          <>
                            {!Array.isArray((acc as any).telegram_accounts) ||
                            (acc as any).telegram_accounts.length === 0 ? (
                              <div className="rounded-lg border border-white/5 bg-[#313c4933] px-3 py-2 text-xs text-inactive">
                                Нет привязанных аккаунтов
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {(acc as any).telegram_accounts.map(
                                  (tg: any, j: number) => {
                                    const id = getTgId(tg);
                                    const lines = extractTgLines(tg);
                                    const fPresent = hasLine(
                                      lines,
                                      "first_line"
                                    );
                                    const sPresent = hasLine(
                                      lines,
                                      "second_line"
                                    );
                                    const busyFirst =
                                      tgRoleBusy ===
                                      `${acc.login}:${id}:first_line`;
                                    const busySecond =
                                      tgRoleBusy ===
                                      `${acc.login}:${id}:second_line`;

                                    return (
                                      <div
                                        key={
                                          tg?.telegram_id ||
                                          tg?.user_id ||
                                          tg?.phone ||
                                          j
                                        }
                                        className="rounded-xl border border-white/5 bg-[#313c4933] p-3 flex flex-col gap-3"
                                      >
                                        <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto] items-center gap-3">
                                          <div
                                            className={`shrink-0 ${
                                              tg?.is_premium
                                                ? "ring-1 ring-[#cba6f7]/40 rounded-full"
                                                : ""
                                            }`}
                                          >
                                            {tg?.avatar ? (
                                              <img
                                                src={tg.avatar}
                                                alt=""
                                                className="w-9 h-9 rounded-full object-cover"
                                                referrerPolicy="no-referrer"
                                              />
                                            ) : (
                                              <div className="w-9 h-9 rounded-full bg-[#1e2c3a] flex items-center justify-center text[10px] text-white/70">
                                                TG
                                              </div>
                                            )}
                                          </div>

                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="truncate text-white/90 text-sm">
                                                {tgDisplayName(tg)}
                                              </span>
                                            </div>
                                            <p className="text-xs text-inactive truncate">
                                              {tgSecondaryLine(tg) || "—"}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="mt-2 md:mt-0 flex items-center justify-between md:justify-between gap-2 w-full flex-nowrap">
                                          <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                              onClick={() =>
                                                id &&
                                                !busyFirst &&
                                                onSetTgRole(
                                                  acc.login,
                                                  id,
                                                  "first_line"
                                                )
                                              }
                                              disabled={busyFirst}
                                              title={
                                                fPresent
                                                  ? "Переназначить 1 линию"
                                                  : "Назначить 1 линию"
                                              }
                                              className={`outline-none cursor-pointer px-3 py-1 rounded-lg border
        ${busyFirst ? "opacity-60 pointer-events-none" : ""}
        ${
          fPresent
            ? "border-[#2b5278] bg-[#17212b] text-[#18a3e6]"
            : "border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
        }`}
                                              variant="ghost"
                                            >
                                              1 <Spline />
                                            </Button>

                                            <Button
                                              onClick={() =>
                                                id &&
                                                !busySecond &&
                                                onSetTgRole(
                                                  acc.login,
                                                  id,
                                                  "second_line"
                                                )
                                              }
                                              disabled={busySecond}
                                              title={
                                                sPresent
                                                  ? "Переназначить 2 линию"
                                                  : "Назначить 2 линию"
                                              }
                                              className={`outline-none cursor-pointer px-3 py-1 rounded-lg border
        ${busySecond ? "opacity-60 pointer-events-none" : ""}
        ${
          sPresent
            ? "border-[#2b5278] bg-[#17212b] text-[#18a3e6]"
            : "border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
        }`}
                                              variant="ghost"
                                            >
                                              2 <Spline />
                                            </Button>
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0">
                                            <IfPerm
                                              anyOf={["chief_admin", "admin"]}
                                            >
                                              <Button
                                                onClick={() =>
                                                  onRevokeTgForUser(
                                                    tg,
                                                    acc.login
                                                  )
                                                }
                                                disabled={
                                                  revokeBusy ===
                                                  `${id}:${acc.login}`
                                                }
                                                className="outline-none cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                                                variant="ghost"
                                                title="Отозвать доступ у пользователя"
                                              >
                                                Отозвать
                                              </Button>
                                            </IfPerm>

                                            <Button
                                              onClick={() =>
                                                openChatsWithTg(tg)
                                              }
                                              className="outline-none cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                                              variant="ghost"
                                              title="Перейти к чатам"
                                            >
                                              <ExternalLink />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* pagination */}
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  onClick={prevPage}
                  disabled={page === 1}
                  className="outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed"
                  variant="ghost"
                >
                  Назад
                </Button>
                <span className="text-sm text-inactive px-2">
                  Страница {page} / {totalPagesMemo}
                </span>
                <Button
                  onClick={nextPage}
                  disabled={page === totalPagesMemo}
                  className="outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed"
                  variant="ghost"
                >
                  Далее
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 👇 сама модалка; портал рисуется в document.body */}
      <UserContentSettingsModal
        open={!!settingsUser}
        onClose={() => setSettingsUser(null)}
        userId={settingsUser?.id ?? ""}
        username={settingsUser?.username}
        initialTab="scripts"
        login={settingsUser?.login ?? ""}
        telegramAccounts={settingsUser?.telegramAccounts ?? []}
      />
    </>
  );
}
