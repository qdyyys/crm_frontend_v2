"use client";

import type React from "react";
import { useRef, useState } from "react";
import IosSwitch from "@/components/IosSwitch";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  KeyRound,
  QrCode,
  Copy,
  CircleFadingArrowUp,
  LayoutDashboard,
} from "lucide-react";

import "@/styles/main.css";

import {
  Trash2,
  Plus,
  MessageSquare,
  Settings,
  Video as VideoIcon,
  FileText,
  Eye,
  Edit3,
  Activity,
  Upload,
  LogOut,
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
};

const Panel = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.user);
  console.log(user);

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

  const toggleTranslate = async (next: boolean) => {
    const prev = translateOn;
    setTranslateOn(next); // оптимистично
    setSavingTranslate(true);
    try {
      await api.post("/panel/accounts/set-translate", {
        translate: next,
      });
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
    const name = newScript.name.trim();
    const message = newScript.message.trim();

    if (!name || !message) {
      toast.warning("Заполни название и сообщение");
      return;
    }

    try {
      setAddingScript(true);
      await api.post("/panel/accounts/scripts/add", { name, message });
      setNewScript({ name: "", message: "" });
      await fetchMe(dispatch as any);
      toast.success("Скрипт добавлен");
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

  const handleDeleteScript = async (name: string) => {
    try {
      await api.delete("/panel/accounts/scripts/delete", { data: { name } });
      await fetchMe(dispatch as any);
      toast.success("Скрипт удалён");
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
    const name = newName.trim();
    if (!name) {
      toast.warning("Укажи название кнопки");
      return;
    }
    if (!file) {
      toast.warning("Выбери видеофайл");
      return;
    }

    try {
      toast.message("Загружаем видео…");
      const dataUrl = await fileToDataUrl(file);

      const payload: any = {
        button_name: name,
        is_video_note: isVideoNote,
        video_base64: dataUrl,
      };

      if (!isVideoNote) {
        const msg = videoMessage.trim();
        if (!msg) {
          toast.warning("Добавь сообщение к видео");
          return;
        }
        payload.message = msg;
      } else {
        payload.message = "";
      }

      await api.post("/telegram/videos", payload);
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
      await api.delete(`/telegram/videos/${vid}`);
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

                {/* Ссылка «Чаты» всегда доступна */}
                <Link
                  to="/chats"
                  className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                >
                  <MessageSquare size={16} />
                  <span className="hidden xs:inline">Чаты</span>
                </Link>

                {/* Кнопка «Начать смену» УДАЛЕНА — теперь она только на странице чатов */}

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
            <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4 flex items-center justify-between gap-4">
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
                        <div className="px-2 py-0.5 rounded-md border border-white/10 text-white/90 flex items-center justify-center text-xs">
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
                        className="outline-none cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <KeyRound size={16} />
                        {is2faEnabling ? "Генерация" : "Получить"}
                      </button>
                    </div>

                    {(otpAuthUrl || otpSecret) && (
                      <div className="mt-4 flex items-center gap-4 ">
                        <div className="shrink-0 rounded-lg border border-white/10 bg-[#313c491a] p-3">
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
                          <div className="rounded-lg border border-white/10 bg-[#313c491a] p-3 flex items-center justify-between gap-5">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[#69b2f1] text-xs font-semibold">
                                  Секрет (Base32)
                                </span>
                              </div>
                              <code className="block text-[13px] font-mono text-white/90 whitespace-pre-wrap break-all select-all">
                                {otpSecret || "JBSWY3DPEHPK3PXP"}
                              </code>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  otpSecret || "",
                                  "Secret (Base32)"
                                )
                              }
                              disabled={!otpSecret}
                              className="outline-none cursor-pointer inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition
                   border-[#1e2c3a] bg-[#121a24] text-white/90
                   hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]
                   disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Copy size={17} />
                            </button>
                          </div>

                          {/* otpauth URI */}
                          <div className="rounded-lg border border-white/10 bg-[#313c491a] p-3 flex gap-5 items-center justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[#69b2f1] text-xs font-semibold">
                                  otpauth URI
                                </span>
                              </div>
                              <code className="block text-[13px] font-mono text-white/90 whitespace-pre-wrap break-all select-all">
                                {otpAuthUrl || "otpauth://…"}
                              </code>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(otpAuthUrl || "", "otpauth URI")
                              }
                              disabled={!otpAuthUrl}
                              className="outline-none cursor-pointer inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition
                   border-[#1e2c3a] bg-[#121a24] text-white/90
                   hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]
                   disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Copy size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {(otpAuthUrl || otpSecret) && (
                    <div className="rounded-md border border-white/10 bg-[#313c4933] p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="px-2 py-0.5 rounded-md border border-white/10 text-white/90 flex items-center justify-center text-xs">
                          2
                        </div>
                        <div className="text-white font-medium">
                          Подтверждение кода
                        </div>
                      </div>

                      <p className="text-[#69b2f1] text-xs font-semibold">
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
                          className="outline-none cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed"
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

          <div className="content-grid items-start">
            {/* scripts */}
            <Card className="modern-card">
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
                      <p className="text-[#69b2f1] text-xs font-semibold">
                        Название скрипта
                      </p>

                      <InputField
                        value={newScript.name}
                        onChange={(e) =>
                          setNewScript({ ...newScript, name: e.target.value })
                        }
                        placeholder="Введите название..."
                      />
                    </div>

                    <div>
                      <p className="text-[#69b2f1] text-xs font-semibold">
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

                    <button
                      onClick={handleAddScript}
                      disabled={addingScript}
                      className="outline-none cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed w-max mx-auto"
                    >
                      <Plus size={16} />
                      {addingScript ? "Добавляем..." : "Добавить скрипт"}
                    </button>
                  </div>
                </div>

                {/* scripts list */}
                <div
                  ref={scriptsRef}
                  className="items-list relative max-h-[400px] overflow-y-auto
             snap-y snap-mandatory scroll-smooth overscroll-contain
             scrollbar-invisible mask-fade-smart"
                >
                  {!user?.scripts?.length ? (
                    <div className="p-6 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
                      Скриптов пока нет
                    </div>
                  ) : (
                    user.scripts.map((script: any, index: number) => (
                      <div
                        key={`${script.name}-${index}`}
                        className="item-card script-item group flex snap-start"
                        style={{
                          alignItems: "center",
                          ["--delay" as any]: `${index * 0.06}s`,
                        }}
                      >
                        <div className="item-content flex-1 min-w-0">
                          <div className="item-header items-center gap-3">
                            <Badge className="action-badge truncate max-w-[220px] justify-start">
                              /{script.name}
                            </Badge>
                          </div>
                          <p
                            className="item-description mt-3 whitespace-normal break-words w-full min-w-0"
                            title={script.message}
                          >
                            {script.message}
                          </p>
                        </div>
                        <div className="item-actions opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="action-btn delete cursor-pointer"
                            onClick={() => handleDeleteScript(script.name)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* videos */}
            <Card className="modern-card">
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
                      className={`outline-none
                      cursor-pointer
                    w-full h-full
                    flex items-center gap-2 sm:gap-3
                    px-2.5 py-2 sm:px-3 sm:py-3
                    rounded-lg sm:rounded-xl border transition
                    text-left select-none
                    ${
                      isVideoNote
                        ? "border-[#2b5278] bg-[#17212b] text-[#18a3e6]"
                        : "border-[#1e2c3a] bg-[#121a24] hover:bg-[#17212b] text-white/90"
                    }
                  `}
                    >
                      Кружок
                      {isVideoNote && (
                        <span className="ml-auto inline-block w-2 h-2 rounded-full bg-[#18a3e6]" />
                      )}
                    </button>

                    <button
                      onClick={() => setIsVideoNote(false)}
                      className={`outline-none
                      cursor-pointer
                    w-full h-full
                    flex items-center gap-2 sm:gap-3
                    px-2.5 py-2 sm:px-3 sm:py-3
                    rounded-lg sm:rounded-xl border transition
                    text-left select-none
                    ${
                      !isVideoNote
                        ? "border-[#2b5278] bg-[#17212b] text-[#18a3e6]"
                        : "border-[#1e2c3a] bg-[#121a24] hover:bg-[#17212b] text-white/90"
                    }
                  `}
                    >
                      Видео
                      {!isVideoNote && (
                        <span className="ml-auto inline-block w-2 h-2 rounded-full bg-[#18a3e6]" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-full">
                        <p className="text-[#69b2f1] text-xs font-semibold">
                          Название кнопки
                        </p>

                        <InputField
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Введите название…"
                        />
                      </div>

                      <div>
                        <div className="flex gap-5 itemc-center">
                          <p className="text-[#69b2f1] text-xs font-semibold mb-1">
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
                            className="outline-none cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                          >
                            {file ? "Заменить" : "Загрузить"}
                          </button>

                          {file ? (
                            <>
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
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {!isVideoNote && (
                      <div className=" md:col-span-1">
                        <p className="text-[#69b2f1] text-xs font-semibold">
                          Сообщение к видео
                        </p>
                        <TextareaField
                          value={videoMessage}
                          onChange={(e) => setVideoMessage(e.target.value)}
                          placeholder="Краткое сообщение…"
                        />
                      </div>
                    )}

                    <div className="flex md:justify-end md:col-span-3">
                      <button
                        onClick={addVideo}
                        disabled={addingScript}
                        className="outline-none cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed w-max mx-auto"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isVideoNote ? "Добавить видео" : "Добавить кружок"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* videos list */}
                <div
                  ref={videosRef}
                  className="items-list mt-6 relative max-h-[400px] overflow-y-auto
             snap-y snap-mandatory scroll-smooth overscroll-contain
             scrollbar-invisible mask-fade-smart"
                >
                  {!user?.videos || user.videos.length === 0 ? (
                    <div className="p-6 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
                      Видео пока нет
                    </div>
                  ) : (
                    user.videos.map((raw: any, index: number) => {
                      const video = normalizeVideo(raw);
                      const src = video.video_base64 || video.old_video_base64;
                      const title = video.button_name || "Без названия";
                      const key = (video.id ??
                        video.video_id ??
                        index) as React.Key;

                      return (
                        <div
                          key={key}
                          className="item-card video-item grid md:grid-cols-[auto,1fr,auto] gap-4 snap-start snap-always"
                          style={{ ["--delay" as any]: `${index * 0.08}s` }}
                        >
                          <div
                            className={`overflow-hidden flex items-center justify-center ${
                              video.is_video_note
                                ? "w-20 h-20 rounded-full bg-[#313c4933]"
                                : "w-28 h-20 rounded-lg bg-[#313c4933]"
                            }`}
                          >
                            {src ? (
                              <video
                                src={src}
                                className="w-full h-full object-cover"
                                muted
                                loop
                                controls={false}
                                onMouseEnter={(e) =>
                                  (e.currentTarget as HTMLVideoElement)
                                    .play()
                                    .catch(() => {})
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget as HTMLVideoElement).pause()
                                }
                              />
                            ) : (
                              <VideoIcon className="w-6 h-6 text-active" />
                            )}
                          </div>

                          <div className="item-content min-w-0">
                            <div className="item-header">
                              <h4 className="item-title truncate">{title}</h4>
                            </div>
                            <p className="item-description text-sm text-inactive">
                              {video.is_video_note ? "Видео-кружок" : "Видео"}
                              {video.created_at
                                ? ` • создано ${new Date(
                                    video.created_at
                                  ).toLocaleString()}`
                                : ""}
                            </p>
                            {!video.is_video_note && video.message ? (
                              <p className="text-sm mt-1 text-white/80 line-clamp-2">
                                {video.message}
                              </p>
                            ) : null}
                          </div>

                          <div className="item-actions flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="action-btn view"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="action-btn edit"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="action-btn delete"
                              onClick={() => deleteVideo(raw)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Panel;
