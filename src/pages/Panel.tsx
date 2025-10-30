import type React from "react";
import { useEffect, useRef, useState } from "react";
import IosSwitch from "@/components/IosSwitch";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  KeyRound,
  QrCode,
  Copy,
  CircleFadingArrowUp,
  LayoutDashboard,
  Mails,
} from "lucide-react";

import "@/styles/main.css";

import {
  Trash2,
  Plus,
  MessageSquare,
  Settings,
  Video as VideoIcon,
  FileText,
  Activity,
  LogOut,
  ChevronDown,
  Check,
} from "lucide-react";

import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@/store";
import { api } from "@/lib/axios";
import { fetchMe } from "@/services/authService";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import InputField from "@/components/InputField";
import ImagePreload from "@/components/ImagePreload";
import TextareaField from "@/components/TextareaField";
import { useSmartMaskFade } from "@/features/utils/useSmartMaskFade";
import { clearUser } from "@/store/UserSlice";
import defaultAvatar from "@public/images/df_avatar.jpg";
import TgAutopushPanel from "@/components/TgAutopushPanel";

type Option = {
  value: string;
  label: string;
  sub?: string;
  avatarUrl?: string;
};

const CustomSelect: React.FC<{
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
}> = ({
  value,
  options,
  placeholder = "Выберите аккаунт…",
  onChange,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border outline-none transition border-white/5 bg-[#313c4933] text-white/90 cursor-pointer"
      >
        <ImagePreload src={selected?.avatarUrl || defaultAvatar} width={25} />
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="ml-auto w-4 h-4 opacity-80" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-[#1e2c3a] bg-[#222c38] shadow-xl tg-scroll">
          {!options.length ? (
            <div className="px-3 py-2 text-sm text-inactive">
              Нет доступных аккаунтов
            </div>
          ) : (
            options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#16202b] transition cursor-pointer"
              >
                <ImagePreload
                  src={opt?.avatarUrl || defaultAvatar}
                  width={25}
                />
                <div className="min-w-0">
                  <div className="text-white/90 truncate">{opt.label}</div>
                  {opt.sub && (
                    <div className="text-xs text-inactive truncate">
                      {opt.sub}
                    </div>
                  )}
                </div>
                {value === opt.value && (
                  <Check className="ml-auto w-4 h-4 text-[#18a3e6]" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

type ApiVideo = {
  id?: string;
  video_id?: string;
  button_name?: string;
  message?: string;
  video_base64?: string;
  old_video_base64?: string;
  created_at?: string;
  updated_at?: string;
  is_video_note?: boolean;
  telegram_account_id?: string | number;
};

const Panel = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.user);

  const perms = user?.perms ?? [];
  const rolePriority = ["chief_admin", "admin", "manager"] as const;

  const effectiveRole =
    rolePriority.find((r) => perms.includes(r)) ??
    ((user as any)?.manager ? "manager" : null);

  const isAdminLike =
    effectiveRole === "admin" || effectiveRole === "chief_admin";
  const hasPanelAccess = Boolean(effectiveRole);
  const canSeeSections = hasPanelAccess;
  const [addingScript, setAddingScript] = useState(false);
  const [newScript, setNewScript] = useState({ name: "", message: "" });

  const [newName, setNewName] = useState("");
  const [isVideoNote, setIsVideoNote] = useState(true);
  const [videoMessage, setVideoMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [translateOn, setTranslateOn] = useState<boolean>(
    Boolean(user?.translate)
  );
  const [savingTranslate, setSavingTranslate] = useState(false);

  const getAccountId = (a: any) =>
    String(a?.crm_id ?? a?._id ?? a?.id ?? a?.telegram_id ?? a?.user_id ?? "");

  const mapTgToOption = (a: any): Option => {
    const id = getAccountId(a);
    const main =
      a?.username ||
      a?.phone ||
      (a?.user_id ? String(a.user_id) : id) ||
      "Аккаунт";

    const sub =
      a?.username && a?.phone
        ? a.phone
        : a?.phone && a?.user_id
        ? String(a.user_id)
        : undefined;

    const avatarUrl =
      a?.avatar && typeof a.avatar === "string"
        ? a.avatar.startsWith("/files/")
          ? a.avatar
          : undefined
        : undefined;

    return { value: id, label: main, sub, avatarUrl };
  };

  const myTgAccounts = (user?.telegram_accounts ?? []).map(mapTgToOption);

  const [adminTgAccounts, setAdminTgAccounts] = useState<Option[]>([]);
  const [, setLoadingAdminTg] = useState(false);

  const tgOptions: Option[] = isAdminLike
    ? adminTgAccounts.length
      ? adminTgAccounts
      : myTgAccounts
    : myTgAccounts;

  const [scriptTgId, setScriptTgId] = useState<string>("");
  const [videoTgId, setVideoTgId] = useState<string>("");
  const [autopushTgId, setAutopushTgId] = useState<string>("");

  const rawTgAccounts = (user?.telegram_accounts ?? []) as any[];

  const findRawAccountByOptionValue = (val?: string) =>
    rawTgAccounts.find((a) => getAccountId(a) === String(val || ""));

  const selectedScriptAccount = findRawAccountByOptionValue(scriptTgId);
  const selectedVideoAccount = findRawAccountByOptionValue(videoTgId);

  const selectedScripts = Array.isArray(selectedScriptAccount?.scripts)
    ? selectedScriptAccount!.scripts
    : [];

  const selectedVideos = Array.isArray(selectedVideoAccount?.videos)
    ? selectedVideoAccount!.videos
    : [];

  useEffect(() => {
    if (!hasPanelAccess) return;
    const first = tgOptions[0]?.value;
    if (first) {
      setScriptTgId((v) => v || first);
      setVideoTgId((v) => v || first);
      setAutopushTgId((v) => v || first);
    }
  }, [hasPanelAccess, tgOptions]);

  useEffect(() => {
    if (!isAdminLike) return;

    let cancelled = false;
    (async () => {
      try {
        setLoadingAdminTg(true);
        const { data } = await api.get("/panel/accounts/admin/telegram/all");

        const rawList =
          (Array.isArray(data) && data) ||
          data?.telegram_accounts ||
          data?.items ||
          data?.accounts ||
          data?.data ||
          [];

        const list = (rawList as any[])
          .map(mapTgToOption)
          .filter((o) => o.value);

        if (!cancelled) {
          setAdminTgAccounts(list);
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Не удалось загрузить список Telegram-аккаунтов";
        toast.error(msg);
        if (!cancelled) setAdminTgAccounts([]);
      } finally {
        if (!cancelled) setLoadingAdminTg(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdminLike]);

  const toggleTranslate = async (next: boolean) => {
    const prev = translateOn;
    setTranslateOn(next);
    setSavingTranslate(true);
    try {
      await api.post("/panel/accounts/set-translate", { translate: next });
      toast.success(next ? "Автоперевод включён" : "Автоперевод выключен");
      try {
        await fetchMe(dispatch as any);
      } catch {}
    } catch (e: any) {
      setTranslateOn(prev);
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Не удалось изменить флаг перевода"
      );
    } finally {
      setSavingTranslate(false);
    }
  };

  const [is2faEnabling, setIs2faEnabling] = useState(false);
  const [otpAuthUrl, setOtpAuthUrl] = useState<string | null>(null);
  const [otpSecret, setOtpSecret] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  const handleLogout = () => {
    try {
      ["token", "access_token", "refresh_token"].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } finally {
      dispatch(clearUser());
      navigate("/sign-in", { replace: true });
    }
  };

  const is2faOn = Boolean(
    (user as any)?.["2fa"] ?? (user as any)?.twofa ?? false
  );

  const normalizeVideo = (v: any): ApiVideo => ({
    id: v?.id ?? v?._id ?? v?.video_id ?? undefined,
    video_id: v?.video_id,
    button_name: v?.button_name ?? v?.name ?? "",
    message: v?.message ?? "",
    video_base64: v?.video_base64,
    old_video_base64: v?.old_video_base64,
    created_at: v?.created_at,
    updated_at: v?.updated_at,
    is_video_note: v?.is_video_note ?? true,
    telegram_account_id:
      v?.telegram_account_id ??
      v?.telegramAccountId ??
      v?.telegram_id ??
      v?.account_id ??
      v?.tg_id ??
      undefined,
  });

  const fileToDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(f);
    });

  const resetVideoForm = () => {
    setNewName("");
    setIsVideoNote(true);
    setVideoMessage("");
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value || "");
      toast.success(`Скопировано: ${label}`);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const handleAddScript = async () => {
    if (!hasPanelAccess) {
      toast.error("Добавление скриптов доступно только менеджерам");
      return;
    }

    const name = newScript.name.trim();
    const message = newScript.message.trim();
    const tgId = scriptTgId.trim();

    if (!name || !message) {
      toast.warning("Заполни название и сообщение");
      return;
    }
    if (!tgId) {
      toast.warning("Выберите Telegram аккаунт");
      return;
    }

    try {
      setAddingScript(true);
      await api.post("/panel/accounts/scripts/add", {
        name,
        message,
        telegram_account_id: tgId,
      });
      toast.success("Скрипт добавлен");

      setNewScript({ name: "", message: "" });
      await fetchMe(dispatch as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.message === "string"
          ? err.message
          : "Не удалось добавить скрипт");
      toast.error(msg);
    } finally {
      setAddingScript(false);
    }
  };

  const handleDeleteScript = async (
    name: string,
    telegram_account_id?: string
  ) => {
    const scriptName = String(name || "").trim();

    const tgId =
      (telegram_account_id && String(telegram_account_id)) ||
      (selectedScriptAccount?.telegram_id
        ? String(selectedScriptAccount.telegram_id)
        : "") ||
      (scriptTgId ? String(scriptTgId) : "");

    if (!scriptName) {
      toast.warning("Не указано имя скрипта");
      return;
    }
    if (!tgId) {
      toast.warning("Не удалось определить telegram_account_id для удаления");
      return;
    }

    try {
      await api.delete("/panel/accounts/scripts/delete", {
        data: { name: scriptName, telegram_account_id: tgId },
      });
      toast.success("Скрипт удалён");
      await fetchMe(dispatch as any);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.message === "string"
          ? err.message
          : "Не удалось удалить скрипт");
      toast.error(msg);
    }
  };

  const addVideo = async () => {
    if (!hasPanelAccess) {
      toast.error("Добавление видео доступно только менеджерам");
      return;
    }

    const name = newName.trim();
    const tgId = videoTgId.trim();

    if (!name) {
      toast.warning("Укажите название кнопки");
      return;
    }
    if (!tgId) {
      toast.warning("Выберите Telegram аккаунт");
      return;
    }
    if (!file) {
      toast.warning("Выберите видео");
      return;
    }

    try {
      toast.message("Загружаем видео…");
      const dataUrl = await fileToDataUrl(file);

      const payload: any = {
        button_name: name,
        is_video_note: isVideoNote,
        video_base64: dataUrl,
        telegram_account_id: tgId,
        message: "",
      };

      if (!isVideoNote) {
        const msg = videoMessage.trim();
        if (!msg) {
          toast.warning("Добавь сообщение к видео");
          return;
        }
        payload.message = msg;
      }

      await api.post("/panel/telegram/videos", payload);
      toast.success("Видео добавлено");

      resetVideoForm();
      try {
        await fetchMe(dispatch as any);
      } catch {
        /* ignore refresh error */
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Не удалось добавить видео";
      toast.error(msg);
    }
  };

  const deleteVideo = async (raw: any) => {
    const v = normalizeVideo(raw);
    const vid = v.id ?? v.video_id;
    if (!vid) {
      toast.error("Не найден идентификатор видео");
      return;
    }
    try {
      await api.delete(`/panel/telegram/videos/${vid}`);
      toast.success("Видео удалено");
      try {
        await fetchMe(dispatch as any);
      } catch {
        /* ignore refresh error */
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || "Не удалось удалить видео";
      toast.error(msg);
    }
  };

  const start2faEnable = async () => {
    try {
      setIs2faEnabling(true);
      const { data } = await api.post("/panel/accounts/2fa/enable");
      setOtpAuthUrl(data?.otpauth_url || data?.otpauth || null);
      setOtpSecret(data?.secret || data?.base32 || null);
      toast.message("Сканируй QR в приложении и введи код ниже");
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Не удалось получить секрет 2FA";
      toast.error(msg);
    } finally {
      setIs2faEnabling(false);
    }
  };

  const verify2fa = async () => {
    const raw = otpCode.trim();
    const code = raw.replace(/\D/g, "");
    if (code.length < 6) {
      toast.warning("Введи 6-значный код");
      return;
    }

    try {
      await api.post("/panel/accounts/2fa/verify", { token: code });

      toast.success("2FA включена");
      setOtpAuthUrl(null);
      setOtpSecret(null);
      setOtpCode("");
      await fetchMe(dispatch as any);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;

      if (status === 400 && /токен|token/i.test(String(msg))) {
        try {
          await api.post("/panel/accounts/2fa/verify", {
            data: { token: code },
          });
          toast.success("2FA включена");
          setOtpAuthUrl(null);
          setOtpSecret(null);
          setOtpCode("");
          await fetchMe(dispatch as any);
          return;
        } catch (e2: any) {
          const msg2 =
            e2?.response?.data?.message || e2?.message || "Код не подошёл";
          toast.error(msg2);
          return;
        }
      }

      toast.error(msg || e?.message || "Код не подошёл");
    }
  };

  const scriptsRef = useRef<HTMLDivElement | null>(null);
  const videosRef = useRef<HTMLDivElement | null>(null);

  useSmartMaskFade(scriptsRef, 12);
  useSmartMaskFade(videosRef, 12);

  return (
    <div className="min-h-screen dashboard-container">
      {/* bg effects */}
      <div className="background-effects">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="relative z-10">
        {/* header */}
        <header className="glass-header">
          <div className="container mx-auto px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="logo-section flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="logo-icon shrink-0">
                    <Settings className="w-6 h-6 sm:w-[30px] sm:h-[30px]" />
                  </div>
                  <div className="min-w-0 leading-tight">
                    <h1 className="font-bold text-white text-[15px] sm:text-2xl">
                      Панель управления
                    </h1>
                    <p className="text-[11px] sm:text-sm text-inactive">
                      Скрипты, видео и безопасность
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                {(user?.perms?.includes("chief_admin") ||
                  user?.perms?.includes("admin")) && (
                  <Link
                    to="/panel"
                    className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                  >
                    <LayoutDashboard size={16} />
                    <span className="hidden xs:inline">Админ панель</span>
                  </Link>
                )}

                <Link
                  to="/chats"
                  className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                >
                  <MessageSquare size={16} />
                  <span className="hidden xs:inline">Чаты</span>
                </Link>

                <Button
                  onClick={handleLogout}
                  className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                  title="Выйти из аккаунта"
                >
                  <LogOut size={16} />
                  <span className="hidden xs:inline">Выйти</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* main content */}
        <main className="container mx-auto px-6 py-8">
          {/* stats cards */}
          <div className="stats-grid mb-8">
            <div className="stat-card">
              <div className="stat-icon">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="stat-number">{user?.scripts?.length || 0}</p>
                <p className="stat-label">Скриптов</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <VideoIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="stat-number">{user?.videos?.length || 0}</p>
                <p className="stat-label">Видео</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="stat-number">{user?.is_working ? "ON" : "OFF"}</p>
                <p className="stat-label">Статус</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="stat-number">{is2faOn ? "ON" : "OFF"}</p>
                <p className="stat-label">2FA</p>
              </div>
            </div>
          </div>

          {/* preferences / translate */}
          <div className="mb-8">
            <div className="rounded-xl border border-white/5 bg-[#313c4933] p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-white font-medium">
                  Автоперевод исходящих
                </div>
                <div className="text-xs text-inactive">
                  При отправке из CRM текст будет автоматически переводиться на
                  выбранный язык.
                </div>
              </div>

              <IosSwitch
                checked={translateOn}
                disabled={savingTranslate}
                onChange={toggleTranslate}
              />
            </div>
          </div>

          {/* security */}
          {!is2faOn && (
            <Card className="modern-card mb-8" data-section="twofa-connect">
              <CardHeader className="card-header">
                <CardTitle className="section-title">
                  <div className="title-icon">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3>Подключение 2FA</h3>
                    <p className="section-subtitle">
                      Секрет + подтверждение кода
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="card-content">
                <div className="space-y-6">
                  <div className="rounded-md bg-[#313c4933] border border-xbor p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="px-2 py-0.5 rounded-md border border-white/5 text-white/90 flex items-center justify-center text-xs bg-[#313c4933]">
                          1
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            Получить секрет / QR
                          </div>
                          <div className="text-xs text-inactive">
                            Добавь секрет в приложение (Google Authenticator,
                            1Password и т.п.)
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={start2faEnable}
                        disabled={is2faEnabling}
                        className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-2.5 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5] flex items-center gap-2"
                      >
                        <KeyRound size={16} />
                        {is2faEnabling ? "Генерация" : "Получить"}
                      </button>
                    </div>

                    {(otpAuthUrl || otpSecret) && (
                      <div className="mt-4 flex items-center gap-4 ">
                        <div className="shrink-0 rounded-lg border border-white/5 bg-[#313c491a] p-3">
                          {otpAuthUrl ? (
                            <>
                              <ImagePreload
                                alt="2FA QR"
                                className="rounded-lg shadow-sm max-w-[200px]"
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                                  otpAuthUrl
                                )}`}
                              />
                            </>
                          ) : (
                            <div className="w-[220px] h-[220px] flex items-center justify-center rounded-lg">
                              <QrCode className="w-6 h-6 text-inactive" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-4">
                          {/* secret */}
                          <div className="rounded-lg border border-white/5 bg-[#313c4933] p-3 flex items-center justify-between gap-5">
                            <div>
                              <div className="flex items-center justify между gap-2">
                                <span className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2">
                                  Секрет (Base32)
                                </span>
                              </div>
                              <code className="block text-[13px] font-mono text-white/90 whitespace-pre-wrap break-all select-all">
                                {otpSecret || "JBSWY3DPEHPK3PXP"}
                              </code>
                            </div>

                            <Button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  otpSecret || "",
                                  "Secret (Base32)"
                                )
                              }
                              disabled={!otpSecret}
                              className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5]"
                              variant="ghost"
                            >
                              <Copy size={17} />
                            </Button>
                          </div>

                          {/* otpauth URI */}
                          <div className="rounded-lg border border-white/5 bg-[#313c4933] p-3 flex items-center justify-between gap-5">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2">
                                  otpauth URI
                                </span>
                              </div>
                              <code className="block text-[13px] font-mono text-white/90 whitespace-pre-wrap break-all select-all">
                                {otpAuthUrl || "otpauth://…"}
                              </code>
                            </div>

                            <Button
                              type="button"
                              onClick={() =>
                                copyToClipboard(otpAuthUrl || "", "otpauth URI")
                              }
                              disabled={!otpAuthUrl}
                              className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5]"
                              variant="ghost"
                            >
                              <Copy size={17} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {(otpAuthUrl || otpSecret) && (
                    <div className="rounded-md border border-white/5 bg-[#313c4933] p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="px-2 py-0.5 rounded-md border border-white/5 text-white/90 flex items-center justify-center text-xs bg-[#313c4933]">
                          2
                        </div>
                        <div className="text-white font-medium">
                          Подтверждение кода
                        </div>
                      </div>

                      <p className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2">
                        Код из приложения
                      </p>
                      <div className="flex gap-2">
                        <InputField
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="6 цифр"
                        />

                        <button
                          onClick={verify2fa}
                          className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-2.5 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5] flex items-center gap-2"
                        >
                          <CircleFadingArrowUp size={16} />
                          Подтвердить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {canSeeSections && (
            <div className="grid items-start gap-6 grid-cols-1 lg:grid-cols-2">
              <Card className="modern-card overflow-visible visib relative z-50">
                <CardHeader className="card-header">
                  <CardTitle className="section-title">
                    <div className="title-icon">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3>Скрипты для чата</h3>
                      <p className="section-subtitle">Автоматические ответы</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="card-content">
                  {/* add script form */}
                  <div className="add-form">
                    <div className="form-fields">
                      <div>
                        <p className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2">
                          Название скрипта
                        </p>

                        <InputField
                          value={newScript.name}
                          onChange={(e) =>
                            setNewScript({
                              ...newScript,
                              name: e.target.value,
                            })
                          }
                          placeholder="Название"
                        />
                      </div>

                      <div>
                        <p className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2">
                          Сообщение
                        </p>

                        <TextareaField
                          value={newScript.message}
                          onChange={(e) =>
                            setNewScript({
                              ...newScript,
                              message: e.target.value,
                            })
                          }
                          placeholder="Текст сообщения..."
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <CustomSelect
                          value={scriptTgId}
                          onChange={setScriptTgId}
                          options={tgOptions}
                          placeholder="Выберите аккаунт…"
                          className="w-full"
                        />

                        <button
                          onClick={handleAddScript}
                          disabled={addingScript}
                          className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-2.5 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5] flex items-center gap-2"
                        >
                          <Plus size={16} />
                          {addingScript ? "Добавляем..." : "Добавить"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* scripts list — компактный стиль */}
                  <div className="rounded-xl border border-white/5 bg-[#313c4933] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-white/90 font-semibold">
                        Ваши скрипты ({selectedScripts.length})
                      </div>
                    </div>

                    {selectedScripts.length === 0 ? (
                      <div className="text-inactive text-sm">
                        Скриптов пока нет для выбранного аккаунта
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedScripts.map((s: any, i: number) => {
                          const scriptName = s.name ?? s.title ?? "Без имени";
                          const scriptMsg = s.message ?? s.body ?? "";
                          const key =
                            s.id ??
                            `${s.telegram_account_id}-${scriptName}-${i}`;
                          const tgForDelete =
                            selectedScriptAccount?.telegram_id ||
                            s.telegram_account_id;

                          return (
                            <div
                              key={key}
                              className="px-3 py-2 rounded-lg border border-white/5 bg-[#313c4933]"
                            >
                              <div className="flex justify-between items-center gap-3">
                                <div className="min-w-0 text-xs flex flex-col gap-1">
                                  <div className="items-center">
                                    <div className="whitespace-normal break-words min-w-0 text-[#69b2f1] bg-[#3e84c14a] border border-[#408dd04d] rounded-full px-2 py-0.5 w-max">
                                      /{scriptName}
                                    </div>
                                  </div>

                                  {!!scriptMsg && (
                                    <p
                                      className="whitespace-normal break-words w-full min-w-0 text-[#6c7f94]"
                                      title={scriptMsg}
                                    >
                                      {scriptMsg}
                                    </p>
                                  )}
                                </div>

                                <Button
                                  onClick={() =>
                                    handleDeleteScript(scriptName, tgForDelete)
                                  }
                                  className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5]"
                                  variant="ghost"
                                  title="Удалить скрипт"
                                >
                                  <Trash2 size={18} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* videos */}
              <Card className="modern-card realative visib relative z-50">
                <CardHeader className="card-header">
                  <CardTitle className="section-title">
                    <div className="title-icon">
                      <VideoIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3>Видео пресеты</h3>
                      <p className="section-subtitle">
                        Обычные видео и видео-кружки
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>

                <CardContent className="card-content">
                  {/* add video form */}
                  <div className="add-form">
                    <div className="mt-3 mb-4 flex gap-2">
                      <button
                        onClick={() => setIsVideoNote(true)}
                        className={`outline-none cursor-pointer w-full h-full flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-3 sm:py-3 rounded-lg sm:rounded-xl border transition text-left select-none ${
                          isVideoNote
                            ? "border-[#2b5278] text-[#9ec1ff] bg-[#3d4d5f80]"
                            : "border-[#1e2c3a] bg-[#313c4980] hover:bg-[#47566933] text-white/90"
                        }`}
                      >
                        Кружок
                        {isVideoNote && (
                          <span className="ml-auto inline-block w-2 h-2 rounded-full bg-[#9ec1ff]" />
                        )}
                      </button>

                      <button
                        onClick={() => setIsVideoNote(false)}
                        className={`outline-none cursor-pointer w-full h-full flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-3 sm:py-3 rounded-lg sm:rounded-xl border transition text-left select-none ${
                          !isVideoNote
                            ? "border-[#2b5278] text-[#9ec1ff] bg-[#3d4d5f80]"
                            : "border-[#1e2c3a] bg-[#313c4980] hover:bg-[#47566933] text-white/90"
                        }`}
                      >
                        Видео
                        {!isVideoNote && (
                          <span className="ml-auto inline-block w-2 h-2 rounded-full bg-[#9ec1ff]" />
                        )}
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="w-full">
                          <p className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2">
                            Название кнопки
                          </p>

                          <InputField
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Название"
                          />
                        </div>

                        <div>
                          <div className="flex gap-5 itemc-center">
                            <p className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2 mb-1">
                              Файл видео
                            </p>
                            {file?.name && (
                              <span className="text-xs text-xinactive truncate max-w-[200px]">
                                {file.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="video/*"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                onPickFile(f);
                                if (fileInputRef.current)
                                  fileInputRef.current.value = "";
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-2.5 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5] flex items-center gap-2"
                            >
                              {file ? "Заменить" : "Загрузить"}
                            </button>

                            {file ? (
                              <button
                                className="outline-none cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                                onClick={() => {
                                  onPickFile(null);
                                  if (fileInputRef.current)
                                    fileInputRef.current.value = "";
                                }}
                              >
                                Очистить
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <CustomSelect
                          value={videoTgId}
                          onChange={setVideoTgId}
                          options={tgOptions}
                          placeholder="Выберите аккаунт…"
                          className="w-full"
                        />

                        <button
                          onClick={addVideo}
                          disabled={addingScript}
                          className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-2.5 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5] flex items-center gap-2"
                        >
                          Добавить
                        </button>
                      </div>

                      {!isVideoNote && (
                        <div className="md:col-span-1">
                          <p className="font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 text-[12px] text-inactive flex items-center gap-2">
                            Сообщение к видео
                          </p>
                          <TextareaField
                            value={videoMessage}
                            onChange={(e) => setVideoMessage(e.target.value)}
                            placeholder="Краткое сообщение…"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* videos list — компактный стиль */}
                  <div className="rounded-xl border border-white/5 bg-[#313c4933] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-white/90 font-semibold">
                        Ваши видео ({selectedVideos.length})
                      </div>
                    </div>

                    {selectedVideos.length === 0 ? (
                      <div className="text-inactive text-sm">
                        Видео пока нет для выбранного аккаунта
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedVideos.map((raw: any, index: number) => {
                          const v = normalizeVideo(raw);
                          const vid = v.video_id || v.id || index;
                          const title = v.button_name || "Видео";
                          const isNote = !!v.is_video_note;
                          const created = v.created_at
                            ? new Date(v.created_at).toLocaleString()
                            : null;

                          return (
                            <div
                              key={vid}
                              className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-[#313c4933] justify-between"
                              style={{ ["--delay" as any]: `${index * 0.08}s` }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`overflow-hidden flex items-center justify-center ${
                                    isNote
                                      ? "w-20 h-20 rounded-full bg-[#313c4933]"
                                      : "w-28 h-20 rounded-lg bg-[#313c4933]"
                                  }`}
                                >
                                  <VideoIcon className="w-6 h-6 text-white/40" />
                                </div>

                                <div className="min-w-0">
                                  <div className="text-sm text-white/90 font-medium truncate">
                                    {title}
                                    {isNote ? " · кружок" : ""}
                                  </div>
                                  <div className="text-xs text-inactive">
                                    TG: {v.telegram_account_id}
                                    {created ? ` • создано ${created}` : ""}
                                  </div>
                                  {!isNote && v.message ? (
                                    <div className="text-xs text-white/80 mt-1 line-clamp-2">
                                      {v.message}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <Button
                                onClick={() => deleteVideo(raw)}
                                className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5]"
                                variant="ghost"
                                title="Удалить видео"
                              >
                                <Trash2 size={18} />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* autopush for manager and admins */}
              <Card className="modern-card realative visib lg:col-span-2">
                <CardHeader className="card-header">
                  <CardTitle className="section-title">
                    <div className="title-icon">
                      <Mails className="w-5 h-5" />
                    </div>
                    <div>
                      <h3>Автопуш</h3>
                      <p className="section-subtitle">
                        Массовая рассылка по выбранному статусу
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>

                <CardContent className="card-content">
                  <div className="mb-4">
                    <CustomSelect
                      value={autopushTgId}
                      onChange={setAutopushTgId}
                      options={tgOptions}
                      placeholder="Выберите аккаунт…"
                      className="w-full"
                    />
                  </div>

                  {autopushTgId ? (
                    <TgAutopushPanel telegramAccountId={autopushTgId} />
                  ) : (
                    <div className="p-6 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
                      Выберите Telegram-аккаунт, чтобы настроить автопуш.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Panel;
