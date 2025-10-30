"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getChatsByStatus,
  createAutoPush,
  getActiveAutoPushes,
  getAutoPushHistory,
  type AutoPushStatusItem,
  type AutoPushActiveItem,
  type AutoPushHistoryItem,
} from "@/features/admin/services/autoPush";
import {
  RefreshCcw,
  Send,
  History as HistoryIcon,
  ListFilter,
  SplinePointer,
} from "lucide-react";
import TextareaField from "./TextareaField";
import InputField from "./InputField";

/* ======================== utils ======================== */
const normArray = <T,>(x: any): T[] => {
  if (!x) return [];
  if (Array.isArray(x)) return x as T[];
  if (typeof x === "object") return Object.values(x) as T[];
  return [];
};
const s = (v: any) => (v == null ? "" : String(v));
const n = (v: any, d = 0) => {
  const num = Number(v);
  return Number.isFinite(num) ? num : d;
};
const dSafe = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const fmt = (d: Date | null) => (d ? d.toLocaleString() : "—");
const idStr = (id: string | number) => String(id);

/* ======================== StatusSelect ======================== */
function StatusSelect({
  options,
  value,
  onChange,
  placeholder = "— статусы не найдены —",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const clean = (options || []).filter(
    (x) => typeof x === "string" && x.trim()
  );
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(
    Math.max(
      0,
      clean.findIndex((t) => t === value)
    )
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const i = clean.findIndex((t) => t === value);
    setHoverIdx(Math.max(0, i));
  }, [value, options]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIdx((i) => (i + 1) % clean.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx((i) => (i - 1 + clean.length) % clean.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (clean.length) onChange(clean[hoverIdx] ?? value);
      setOpen(false);
    }
  };

  const display = value || (clean.length ? clean[0] : "");

  return (
    <div className="w-full" ref={wrapRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          onKeyDown={onKeyDown}
          className="w-full mt-1 px-3 py-2 rounded-lg border border-white/5 bg-[#313c4933] text-white/90 outline-none flex items-center justify-between cursor-pointer"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">
            {display || <span className="text-inactive">{placeholder}</span>}
          </span>
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 opacity-80"
            fill="none"
            stroke="currentColor"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <ul
            role="listbox"
            tabIndex={-1}
            className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-[#1e2c3a] bg-[#222c38] shadow-xl tg-scroll"
          >
            {!clean.length ? (
              <li className="px-3 py-2 text-sm text-inactive">{placeholder}</li>
            ) : (
              clean.map((opt, idx) => {
                const active = opt === value;
                const hovered = idx === hoverIdx;
                return (
                  <li key={`${opt}-${idx}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHoverIdx(idx)}
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm cursor-pointer text-white/90 hover:bg-[#17212b] ${
                        active ? "bg-[#182432] text-[#9ec1ff]" : ""
                      } ${hovered ? "bg-[#17212b]" : ""}`}
                    >
                      {opt}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ======================== Component ======================== */
type Props = {
  telegramAccountId: string | number;
  className?: string;
};

export default function TgAutopushPanel({
  telegramAccountId,
  className = "",
}: Props) {
  type Line = "FIRST" | "SECOND";

  const [line, setLine] = useState<Line>("FIRST");
  const [statusItems, setStatusItems] = useState<AutoPushStatusItem[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  const statusOptions = useMemo((): string[] => {
    return (statusItems || [])
      .filter(Boolean)
      .filter((s) => {
        const ln = ((s as any).line || "FIRST") as "FIRST" | "SECOND" | "BOTH";
        return ln === line || ln === "BOTH";
      })
      .map((s) => String((s as any).status ?? "").trim())
      .filter((x) => x.length > 0);
  }, [statusItems, line]);

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [photos, setPhotos] = useState<string>("");
  const [videos, setVideos] = useState<string>("");

  const [creating, setCreating] = useState(false);

  const [activeList, setActiveList] = useState<AutoPushActiveItem[]>([]);
  const [historyList, setHistoryList] = useState<AutoPushHistoryItem[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const reloadStatuses = async () => {
    try {
      setLoadingStatuses(true);
      const raw = await getChatsByStatus(idStr(telegramAccountId));
      const normalized = normArray<AutoPushStatusItem>(raw)
        .filter(Boolean)
        .map((it: any) => {
          const ln = String(it?.line || "").toUpperCase();
          const lineNorm =
            ln === "SECOND" ? "SECOND" : ln === "BOTH" ? "BOTH" : "FIRST";
          const statusNorm = s(it?.status).trim();
          return { status: statusNorm, line: lineNorm } as AutoPushStatusItem;
        })
        .filter((it) => !!it.status);
      setStatusItems(normalized);

      const firstForLine =
        normalized.find((s) => s.line === line || s.line === "BOTH") || null;
      setSelectedStatus(firstForLine?.status || "");
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Не удалось получить статусы для автопуша"
      );
      setStatusItems([]);
      setSelectedStatus("");
    } finally {
      setLoadingStatuses(false);
    }
  };

  const reloadActive = async () => {
    try {
      setLoadingActive(true);
      const data = await getActiveAutoPushes();
      const list = normArray<AutoPushActiveItem>(data)
        .filter((it) => it && typeof it === "object" && s((it as any).id))
        .map((it: any) => ({
          ...it,
          id: s(it.id),
          status: s(it.status),
          telegram_account_id: s(it.telegram_account_id),
          message: s(it.message),
          delay_seconds: n(it.delay_seconds, 0),
          created_at: s(it.created_at || it.started_at || ""),
        }))
        .sort((a, b) => {
          const da = dSafe(a.created_at);
          const db = dSafe(b.created_at);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        });
      setActiveList(list);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Не удалось получить активные автопуши"
      );
      setActiveList([]);
    } finally {
      setLoadingActive(false);
    }
  };

  const reloadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await getAutoPushHistory(100);
      const list = normArray<AutoPushHistoryItem>(data)
        .filter((it) => it && typeof it === "object" && s((it as any).id))
        .map((it: any) => ({
          ...it,
          id: s(it.id),
          auto_push_id: s(it.auto_push_id),
          manager_login: s(it.manager_login),
          telegram_account_id: s(it.telegram_account_id),
          chat_id: s(it.chat_id),
          message: s(it.message),
          status: s(it.status),
          sent_at: s(it.sent_at || ""),
          delay_seconds: n(it.delay_seconds, 0),
        }))
        .sort((a, b) => {
          const da = dSafe(a.sent_at);
          const db = dSafe(b.sent_at);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        });
      setHistoryList(list);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Не удалось получить историю автопушей"
      );
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    reloadStatuses();
    reloadActive();
    reloadHistory();
  }, [telegramAccountId]);

  useEffect(() => {
    if (!statusItems.length) return;
    const firstForLine =
      statusItems.find((s) => s.line === line || s.line === "BOTH") || null;
    setSelectedStatus(firstForLine?.status || "");
  }, [line]);

  const doCreate = async () => {
    if (!selectedStatus) return toast.warning("Выберитете статус");
    if (!message.trim()) return toast.warning("Введите текст сообщения");

    try {
      setCreating(true);
      const payload = {
        telegram_account_id: idStr(telegramAccountId),
        status: selectedStatus,
        message: message.trim(),
        delay_seconds: Math.max(0, Number(delaySeconds) || 0),
        photos: photos
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        videos: videos
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await createAutoPush(payload);
      toast.success("Автопуш создан и запущен");
      setMessage("");
      setDelaySeconds(0);
      setPhotos("");
      setVideos("");
      reloadActive();
      reloadHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось создать автопуш");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-4 items-start ${className}`}
    >
      <div className="rounded-xl border border-white/10 bg-[#313c4933] p-4">
        <div className="text-[12px] uppercase tracking-wide text-inactive mb-3">
          Создать автопуш
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <div className="mt-1 flex gap-2">
              {(["FIRST", "SECOND"] as const).map((ln) => (
                <button
                  key={ln}
                  onClick={() => setLine(ln)}
                  className={`px-3 py-2 rounded-md text-sm cursor-pointer border outline-none transition flex gap-1 items-center ${
                    line === ln
                      ? "bg-[#313c4933] border-[#2b5278] text-[#9ec1ff]"
                      : "bg-[#3e4a5a33] border-[#1e2c3a] text-white/90 hover:border-[#2b5278] focus:border-[#2b5278]"
                  }`}
                  type="button"
                >
                  {ln === "FIRST" ? "1" : "2"}
                  <SplinePointer size={16} />
                </button>
              ))}
              <button
                onClick={reloadStatuses}
                className="ml-auto px-3 py-2 rounded-md border bg-[#313c4933] text-white/90 hover:border-[#2b5278] outline-none cursor-pointer inline-flex items-center gap-2 text-xs border-white/5"
                title="Обновить статусы"
                type="button"
              >
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label className="text-[12px] text-inactive">Статус</Label>
            <div className="mt-1">
              {loadingStatuses ? (
                <div className="flex items-center gap-2 text-sm text-inactive py-3">
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  Загрузка статусов…
                </div>
              ) : (
                <StatusSelect
                  options={statusOptions}
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  placeholder="— статусы не найдены —"
                />
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label className="text-[12px] text-inactive flex items-center gap-2">
              Текст сообщения
            </Label>
            <TextareaField
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Сообщение"
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="text-[12px] text-inactive flex items-center gap-2">
              Задержка между отправками (сек)
            </Label>
            <InputField
              inputMode="numeric"
              value={String(delaySeconds)}
              onChange={(e) =>
                setDelaySeconds(
                  Number(e.target.value.replace(/[^\d]/g, "")) || 0
                )
              }
              placeholder="0"
            />
          </div>

          <div className="col-span-1">
            <Label className="text-[12px] text-inactive flex items-center gap-2">
              Фото (по одному URL на строку)
            </Label>
            <TextareaField
              value={photos}
              onChange={(e) => setPhotos(e.target.value)}
              placeholder="https://...jpg"
            />
          </div>

          <div className="col-span-1">
            <Label className="text-[12px] text-inactive flex items-center gap-2">
              Видео (по одному URL на строку)
            </Label>
            <TextareaField
              value={videos}
              onChange={(e) => setVideos(e.target.value)}
              placeholder="https://...mp4"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            onClick={doCreate}
            disabled={creating || loadingStatuses}
            className="px-3 py-2 rounded-lg border border-[#2b5278] bg-[#313c4933] text-[#9ec1ff] hover:bg-[#43516333] inline-flex items-center gap-2 cursor-pointer ml-auto"
          >
            <Send />
            Создать
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#313c4933] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[12px] uppercase tracking-wide text-inactive">
            Автопуши
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                reloadActive();
                reloadHistory();
              }}
              className="ml-auto px-3 py-2 rounded-md border bg-[#313c4933] text-white/90 hover:border-[#2b5278] outline-none cursor-pointer inline-flex items-center gap-2 text-xs border-white/5"
              title="Обновить статусы"
              type="button"
            >
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#313c4933] p-3">
          <div className="text-sm text-white/90 flex items-center gap-2 mb-2">
            <ListFilter className="w-4 h-4 text-[#9ec1ff]" />
            Активные
          </div>
          {loadingActive ? (
            <div className="flex items-center gap-2 text-sm text-inactive py-3">
              <RefreshCcw className="w-4 h-4 animate-spin" />
              Загрузка…
            </div>
          ) : !activeList.length ? (
            <div className="text-sm text-inactive">Нет активных автопушей</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {(activeList || []).map((raw) => {
                const it = raw as any;
                if (!it || typeof it !== "object") return null;
                const status = s(it.status) || "—";
                const msg = s(it.message);
                const id = s(it.id);
                if (!id) return null;

                return (
                  <li
                    key={id}
                    className="flex flex-col gap-2 pl-2 border-0 border-l-2 border-[#9ec1ff] roude-3xl"
                  >
                    <ul className="text-inactive truncate mt-0.5">
                      <li className="text-sm font-bold">Статус: {status}</li>
                      <li className="text-sm font-bold">Текст: {msg}</li>
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-[#313c4933] p-3 mt-3">
          <div className="text-sm text-white/90 flex items-center gap-2 mb-2">
            <HistoryIcon className="w-4 h-4 text-[#9ec1ff]" />
            История
          </div>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-inactive py-3">
              <RefreshCcw className="w-4 h-4 animate-spin" />
              Загрузка…
            </div>
          ) : !historyList.length ? (
            <div className="text-sm text-inactive">История пуста</div>
          ) : (
            <ul className="divide-y divide-white/5 max-h-64 overflow-auto tg-scroll flex flex-col gap-2">
              {(historyList || []).map((raw) => {
                const it = raw as any;
                if (!it || typeof it !== "object") return null;
                const status = s(it.status) || "—";
                const msg = s(it.message);
                const id = s(it.id);
                const when = fmt(dSafe(it.sent_at));
                if (!id) return null;

                return (
                  <li
                    key={id}
                    className="flex flex-col gap-2 pl-2 border-0 border-l-2 border-[#9ec1ff] roude-3xl"
                  >
                    <ul className="text-inactive truncate mt-0.5">
                      <li className="text-sm font-bold">Статус: {status}</li>
                      <li className="text-sm font-bold">Текст: {msg}</li>
                      <li className="text-sm font-bold">Дата: {when}</li>
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
