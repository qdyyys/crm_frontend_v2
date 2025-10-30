"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Settings2,
  Video as VideoIcon,
  FileText,
  Trash2,
  Plus,
  Loader2,
  ChevronDown,
  Check,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/axios";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | number;
  username?: string;
  initialTab?: "videos" | "scripts";
  login: string;
  telegramAccounts: any[];
};

const getTgId = (tg: any): string | null => {
  return (
    tg &&
    (tg.telegram_id || tg.user_id || tg.phone || null) &&
    String(tg.telegram_id ?? tg.user_id ?? tg.phone)
  );
};

const readFileAsDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });

const defaultAvatar =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect width='100%' height='100%' fill='%231e2c3a'/><text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-size='22' fill='%23bcd1ff' font-family='system-ui,Segoe UI,Arial'>TG</text></svg>`
  );

const ImagePreload = ({ src, size = 25 }: { src?: string; size?: number }) => {
  const s = src || defaultAvatar;
  return (
    <img
      src={s}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      referrerPolicy="no-referrer"
    />
  );
};

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
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border outline-none transition
                   border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] cursor-pointer"
      >
        <ImagePreload src={selected?.avatarUrl || defaultAvatar} />
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="ml-auto w-4 h-4 opacity-80" />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border
                     border-[#1e2c3a] bg-[#0e1621] shadow-xl"
        >
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
                <ImagePreload src={opt?.avatarUrl || defaultAvatar} />
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

type AutoTAProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
};
const AutoResizeTextarea: React.FC<AutoTAProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
  minRows = 2,
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    resize();
  }, []);

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e);
        requestAnimationFrame(resize);
      }}
      rows={minRows}
      placeholder={placeholder}
      className={`w-full bg-[#0e1621] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2b5278]
                  resize-none overflow-hidden ${className}`}
    />
  );
};

export default function UserContentSettingsModal({
  open,
  onClose,
  userId,
  username,
  initialTab = "scripts",
  login,
  telegramAccounts,
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (cardRef.current && target && cardRef.current.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDocDown, true);
    return () => document.removeEventListener("mousedown", onDocDown, true);
  }, [open, onClose]);

  const [tab, setTab] = useState<"videos" | "scripts">(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const tgOptions: Option[] = useMemo(
    () =>
      (telegramAccounts || []).map((tg) => {
        const id = getTgId(tg);
        const labelSource =
          tg?.username ||
          tg?.phone ||
          tg?.first_name ||
          tg?.last_name ||
          tg?.telegram_id ||
          tg?.user_id;
        const sub =
          (tg?.first_name || tg?.last_name) && tg?.username
            ? `${tg.first_name ?? ""} ${tg.last_name ?? ""} · @${tg.username}`
            : tg?.phone || tg?.username || undefined;

        return {
          value: id ? String(id) : "",
          label: `${labelSource ?? "TG"}${id ? ` · ${id}` : ""}`,
          sub,
          avatarUrl: tg?.avatar,
        };
      }),
    [telegramAccounts]
  );

  const [selectedTg, setSelectedTg] = useState<string>("");
  useEffect(() => {
    if (!open) return;
    setSelectedTg((prev) => prev || tgOptions[0]?.value || "");
  }, [open, tgOptions]);

  type VideoItem = {
    id: string;
    video_id?: string;
    telegram_account_id: string;
    button_name?: string;
    message?: string;
    is_video_note?: boolean;
    created_at?: string;
    updated_at?: string;
  };

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  const fetchVideos = async () => {
    if (!login) return;
    try {
      setVideosLoading(true);
      const { data } = await api.get(
        `/panel/telegram/videos/admin/user/${encodeURIComponent(login)}`
      );
      const list: VideoItem[] = data?.data?.videos ?? [];
      setVideos(list);
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось получить видео пользователя");
    } finally {
      setVideosLoading(false);
    }
  };

  const [assignBusy, setAssignBusy] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoIsNote, setVideoIsNote] = useState(false);
  const [videoButtonName, setVideoButtonName] = useState("");
  const [videoMessage, setVideoMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onPickFile = (f: File | null) => setVideoFile(f);

  const onAssignVideo = async () => {
    if (!selectedTg) return toast.error("Выберитете Telegram-аккаунт");
    if (!videoFile) return toast.error("Выберитете видео-файл");
    try {
      setAssignBusy(true);
      const base64 = await readFileAsDataUrl(videoFile);

      const payload = {
        button_name: videoButtonName || "Видео",
        is_video_note: Boolean(videoIsNote),
        message: videoIsNote ? "" : videoMessage || "",
        target_login: login,
        telegram_account_id: selectedTg,
        video_base64: base64,
      };

      await api.post(`/panel/telegram/videos/admin/assign`, payload);

      toast.success("Видео выдано");
      setVideoFile(null);
      setVideoMessage("");
      setVideoButtonName("");
      setVideoIsNote(false);
      await fetchVideos();
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось выдать видео");
    } finally {
      setAssignBusy(false);
    }
  };

  const [deleteVideoBusy, setDeleteVideoBusy] = useState<string | null>(null);

  const onDeleteVideo = async (video: VideoItem) => {
    const deleteId = video?.id ?? video?.video_id;
    if (!deleteId) return toast.error("Не найден идентификатор видео (id)");

    try {
      setDeleteVideoBusy(String(deleteId));
      await api.delete(
        `/panel/telegram/videos/admin/${encodeURIComponent(String(deleteId))}`
      );
      toast.success("Видео удалено");
      await fetchVideos();
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось удалить видео");
    } finally {
      setDeleteVideoBusy(null);
    }
  };

  type ScriptItem = {
    id?: string;
    telegram_account_id?: string;
    name?: string;
    message?: string;
    title?: string;
    body?: string;
    created_at?: string;
    updated_at?: string;
  };

  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);

  const fetchScripts = async () => {
    if (!login) return;
    try {
      setScriptsLoading(true);
      const { data } = await api.get(
        `/panel/accounts/scripts/admin/user/${encodeURIComponent(login)}`
      );
      const list: ScriptItem[] = data?.data?.scripts ?? data?.scripts ?? [];
      setScripts(list);
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось получить скрипты пользователя");
    } finally {
      setScriptsLoading(false);
    }
  };

  const [assignScriptBusy, setAssignScriptBusy] = useState(false);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptBody, setScriptBody] = useState("");

  const onAssignScript = async () => {
    if (!selectedTg) return toast.error("Выберитете Telegram-аккаунт");
    if (!scriptTitle.trim() && !scriptBody.trim())
      return toast.error("Заполните хотя бы имя и/или текст скрипта");

    try {
      setAssignScriptBusy(true);

      const payload = {
        target_login: login,
        name: scriptTitle || "script",
        message: scriptBody || "",
        telegram_account_id: selectedTg,
      };

      await api.post(`/panel/accounts/scripts/admin/assign`, payload);

      toast.success("Скрипт выдан");
      setScriptTitle("");
      setScriptBody("");
      await fetchScripts();
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось выдать скрипт");
    } finally {
      setAssignScriptBusy(false);
    }
  };

  const [deleteScriptBusy, setDeleteScriptBusy] = useState<string | null>(null);

  const onDeleteScript = async (scr: ScriptItem) => {
    const scriptName = scr.name ?? scr.title;
    if (!scriptName) {
      toast.error("Не найдено имя скрипта (name)");
      return;
    }

    try {
      setDeleteScriptBusy(scriptName);
      await api.delete(`/panel/accounts/scripts/admin/delete`, {
        data: {
          target_login: login,
          name: scriptName,
          telegram_account_id: scr.telegram_account_id ?? selectedTg,
        },
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Скрипт удалён");
      await fetchScripts();
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось удалить скрипт");
    } finally {
      setDeleteScriptBusy(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchVideos();
    fetchScripts();
  }, [open, login]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[10000] overflow-y-auto">
      <div className="min-h-screen flex items-stretch sm:items-center justify-center p-0 sm:p-4">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <div
          ref={cardRef}
          className="relative z-[1] w-full sm:max-w-4xl bg-[#0c141d] border border-[#233243] shadow-2xl rounded-none sm:rounded-2xl flex flex-col max_h-[90vh] max-h-[90vh] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#233243] bg-[#0e1621] flex items-center gap-2 ">
            <Settings2 className="w-5 h-5 text-[#9ec1ff]" />
            <div className="min-w-0">
              <div className="text-white font-semibold truncate">
                Пользователь {username ? `${username}` : ""}
              </div>
              <div className="text-[12px] text-inactive truncate">
                ID: {String(userId)} · Login: {login}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-auto p-2 rounded-lg hover:bg-white/5 cursor-pointer outline-none"
              aria-label="Закрыть"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 pt-3 flex gap-2 items-center">
            <CustomSelect
              value={selectedTg}
              onChange={setSelectedTg}
              options={tgOptions}
              className="w-full"
              placeholder="Выберите аккаунт…"
            />

            <div className="inline-flex rounded-lg border border-white/10 bg-[#0e1621] p-1">
              <button
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 cursor-pointer ${
                  tab === "scripts"
                    ? "bg-[#17212b] text-[#9ec1ff]"
                    : "text-white/80 hover:text-white"
                }`}
                onClick={() => setTab("scripts")}
              >
                <FileText className="w-4 h-4" /> Скрипты
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 cursor-pointer ${
                  tab === "videos"
                    ? "bg-[#17212b] text-[#9ec1ff]"
                    : "text-white/80 hover:text-white"
                }`}
                onClick={() => setTab("videos")}
              >
                <VideoIcon className="w-4 h-4" /> Видео
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto tg-scroll p-4 overflow-visible space-y-4">
            {tab === "videos" && (
              <>
                <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
                  <div className="mt-1 mb-4 flex gap-2">
                    <button
                      onClick={() => setVideoIsNote(true)}
                      className={`outline-none cursor-pointer w-full h-full flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-3 sm:py-3 rounded-lg sm:rounded-xl border transition text-left select-none ${
                        videoIsNote
                          ? "border-[#2b5278] bg-[#17212b] text-[#18a3e6]"
                          : "border-[#1e2c3a] bg-[#121a24] hover:bg-[#17212b] text-white/90"
                      }`}
                    >
                      Кружок
                      {videoIsNote && (
                        <span className="ml-auto inline-block w-2 h-2 rounded-full bg-[#18a3e6]" />
                      )}
                    </button>

                    <button
                      onClick={() => setVideoIsNote(false)}
                      className={`outline-none cursor-pointer w-full h-full flex items-center gap-2 sm:gap-3 px-2.5 py-2 sm:px-3 sm:py-3 rounded-lg sm:rounded-xl border transition text-left select-none ${
                        !videoIsNote
                          ? "border-[#2b5278] bg-[#17212b] text-[#18a3e6]"
                          : "border-[#1e2c3a] bg-[#121a24] hover:bg-[#17212b] text-white/90"
                      }`}
                    >
                      Видео
                      {!videoIsNote && (
                        <span className="ml-auto inline-block w-2 h-2 rounded-full bg-[#18a3e6]" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-full">
                        <p className="text-xs text-inactive">Название кнопки</p>
                        <input
                          value={videoButtonName}
                          onChange={(e) => setVideoButtonName(e.target.value)}
                          className="w-full bg-[#0e1621] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2b5278]"
                          placeholder="Название"
                        />
                      </div>

                      <div className="shrink-0">
                        <div className="flex gap-5 items-center">
                          <p className="text-xs text-inactive mb-1">
                            Файл видео
                          </p>
                          {videoFile?.name && (
                            <span className="text-xs text-inactive truncate max-w-[200px]">
                              {videoFile.name}
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
                            {videoFile ? "Заменить" : "Загрузить"}
                          </button>

                          {videoFile ? (
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

                    {/* Сообщение скрываем для кружков */}
                    {!videoIsNote && (
                      <div className="md:col-span-1">
                        <p className="text-xs text-inactive">
                          Сообщение к видео
                        </p>
                        <AutoResizeTextarea
                          value={videoMessage}
                          onChange={(e) => setVideoMessage(e.target.value)}
                          placeholder="Сообщение"
                          minRows={3}
                        />
                      </div>
                    )}

                    <div className="flex md:justify-end md:col-span-3">
                      <button
                        onClick={onAssignVideo}
                        disabled={assignBusy || !selectedTg || !videoFile}
                        className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-2.5 rounded-lg border border-[#1e2c3a] bg-[#313c49c5] text-white/90 hover:bg-[#394553c5] flex items-center gap-2"
                      >
                        {assignBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        {videoIsNote ? "Добавить кружок" : "Добавить видео"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-white/90 font-semibold">
                      Ваши видео ({videos.length})
                    </div>
                    <button
                      onClick={fetchVideos}
                      className="ml-auto text-xs px-2 py-1 rounded-lg border border-white/10 hover:border-[#2b5278] cursor-pointer"
                      title="Обновить"
                    >
                      <RefreshCcw size={15} />
                    </button>
                  </div>

                  {videosLoading ? (
                    <div className="text-inactive text-sm">Загрузка…</div>
                  ) : videos.length === 0 ? (
                    <div className="text-inactive text-sm">
                      Пока нет выданных видео
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {videos.map((v, index) => {
                        const vid = v.video_id || v.id;
                        return (
                          <div
                            key={vid}
                            className="flex items-center gap-3 p-2 rounded-lg border border-white/5 bg-[#101823] justify-between"
                            style={{ ["--delay" as any]: `${index * 0.08}s` }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`overflow-hidden flex items-center justify-center ${
                                  v.is_video_note
                                    ? "w-20 h-20 rounded-full bg-[#313c4933]"
                                    : "w-28 h-20 rounded-lg bg-[#313c4933]"
                                }`}
                              >
                                <VideoIcon className="w-6 h-6 text-white/40" />
                              </div>

                              <div className="min-w-0">
                                <div className="text-sm text-white/90 font-medium truncate">
                                  {v.button_name || "Видео"}
                                  {v.is_video_note ? " · кружок" : ""}
                                </div>
                                <div className="text-xs text-inactive">
                                  TG: {v.telegram_account_id}
                                  {v.created_at
                                    ? ` • создано ${new Date(
                                        v.created_at
                                      ).toLocaleString()}`
                                    : ""}
                                </div>
                                {!v.is_video_note && v.message ? (
                                  <div className="text-xs text-white/80 mt-1 line-clamp-2">
                                    {v.message}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <Button
                              onClick={() => onDeleteVideo(v)}
                              disabled={deleteVideoBusy === String(vid)}
                              className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                              variant="ghost"
                              title="Настройки пользователя (Видео/Скрипты)"
                            >
                              {deleteVideoBusy === String(vid) ? (
                                <Loader2 size={18} />
                              ) : (
                                <Trash2 size={18} />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === "scripts" && (
              <>
                {/* форма выдачи */}
                <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-white/90 font-semibold">
                      Выдать скрипт
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-inactive">Название</label>
                      <input
                        value={scriptTitle}
                        onChange={(e) => setScriptTitle(e.target.value)}
                        className="bg-[#0e1621] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2b5278]"
                        placeholder="greetings"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-inactive">
                        Текст скрипта
                      </label>
                      <AutoResizeTextarea
                        value={scriptBody}
                        onChange={(e) => setScriptBody(e.target.value)}
                        placeholder="Hello!"
                        minRows={6}
                      />
                    </div>

                    <div>
                      <button
                        onClick={onAssignScript}
                        disabled={assignScriptBusy || !selectedTg}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2b5278] bg-[#17212b] text-[#9ec1ff] hover:border-[#3c78a3] disabled:opacity-60 cursor-pointer"
                      >
                        {assignScriptBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        Выдать скрипт
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-white/90 font-semibold">
                      Ваши скрипты ({scripts.length})
                    </div>
                    <button
                      onClick={fetchScripts}
                      className="ml-auto text-xs px-2 py-1 rounded-lg border border-white/10 hover:border-[#2b5278] cursor-pointer"
                      title="Обновить"
                    >
                      <RefreshCcw size={15} />
                    </button>
                  </div>

                  {scriptsLoading ? (
                    <div className="text-inactive text-sm">Загрузка…</div>
                  ) : scripts.length === 0 ? (
                    <div className="text-inactive text-sm">
                      Пока нет выданных скриптов
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {scripts.map((s) => {
                        const scriptName = s.name ?? s.title ?? "Без имени";
                        const scriptMsg = s.message ?? s.body ?? "";
                        const key = s.id ?? scriptName;

                        return (
                          <div
                            key={key}
                            className="px-3 py-2 rounded-lg border border-white/5 bg-[#101823]"
                          >
                            <div className="flex justify-between items-center">
                              <div className="min-w-0 text-xs flex flex-col gap-1">
                                <div className="items-center">
                                  <div className="whitespace-normal break-words min-w-0 text-[#69b2f1] bg-[#3e84c14a] border border-[#408dd04d] rounded-full px-2 py-0.5 w-max">
                                    /{scriptName}
                                  </div>
                                </div>

                                {scriptMsg && (
                                  <p
                                    className="whitespace-normal break-words w-full min-w-0 text-[#6c7f94]"
                                    title={scriptMsg}
                                  >
                                    {scriptMsg}
                                  </p>
                                )}
                              </div>

                              <Button
                                onClick={() => onDeleteScript(s)}
                                disabled={deleteScriptBusy === scriptName}
                                className="shrink-0 whitespace-nowrap cursor-pointer px-3 py-1 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                                variant="ghost"
                                title="Настройки пользователя (Видео/Скрипты)"
                              >
                                {deleteScriptBusy === scriptName ? (
                                  <Loader2 size={18} />
                                ) : (
                                  <Trash2 size={18} />
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
