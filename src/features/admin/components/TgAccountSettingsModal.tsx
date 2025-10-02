"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  addProxy,
  updateProxy,
  removeProxy,
  testProxy,
  type ProxyConfig,
  type ProxyResponse,
} from "@/features/admin/services/telegramProxy";
import {
  fetchUserChannels,
  setTelegramChannel,
  setTelegramLanguage,
} from "@/features/admin/services/telegram";
import {
  X,
  Shield,
  RefreshCcw,
  Save,
  Trash2,
  Globe,
  ChevronDown,
  Settings2,
  Group,
  Languages,
} from "lucide-react";

/* ======== helpers ======== */

type Channel = {
  id?: string | number;
  channel_id?: string | number;
  title?: string;
  username?: string;
  name?: string;
};

function getReadableChannelTitle(ch: Channel) {
  const id = String(ch.id ?? ch.channel_id ?? "");
  const main =
    ch.title?.trim() ||
    ch.name?.trim() ||
    ch.username?.trim() ||
    (id ? `#${id}` : "Без названия");
  const handle =
    ch.username && !/^#/.test(main) ? ` @${ch.username.replace(/^@/, "")}` : "";
  return `${main}${handle}`;
}

/* ======== selects ======== */

const PROXY_TYPES: Array<ProxyConfig["type"]> = [
  "http",
  "https",
  "socks4",
  "socks4a",
  "socks5",
];

function ProxyTypeSelect({
  value,
  onChange,
  label = "Тип прокси",
  error,
}: {
  value: ProxyConfig["type"];
  onChange: (v: ProxyConfig["type"]) => void;
  label?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(
    Math.max(
      0,
      PROXY_TYPES.findIndex((t) => t === value)
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
      setHoverIdx((i) => (i + 1) % PROXY_TYPES.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx((i) => (i - 1 + PROXY_TYPES.length) % PROXY_TYPES.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      onChange(PROXY_TYPES[hoverIdx] ?? value);
      setOpen(false);
    }
  };

  return (
    <div className="w-full" ref={wrapRef}>
      <Label className="text-[#69b2f1] text-xs font-semibold">{label}</Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          onKeyDown={onKeyDown}
          className={`w-full mt-1 px-3 py-2 rounded-lg bg-[#121a24] border text-white/90 outline-none flex items-center justify-between cursor-pointer ${
            error
              ? "border-red-500/60"
              : "border-[#1e2c3a] hover:border-[#2b5278]"
          }`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{String(value).toUpperCase()}</span>
          <ChevronDown className="w-4 h-4 opacity-80" />
        </button>

        {open && (
          <ul
            role="listbox"
            tabIndex={-1}
            className="absolute left-0 top-[calc(100%+4px)] w-full z-50 rounded-lg border border-[#1e2c3a] bg-[#0e1621] shadow-xl overflow-hidden"
          >
            {PROXY_TYPES.map((opt, idx) => {
              const active = opt === value;
              const hovered = idx === hoverIdx;
              return (
                <li key={opt}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm cursor-pointer ${
                      active ? "bg-[#182432] text-[#9ec1ff]" : "text-white/90"
                    } ${hovered ? "bg-[#17212b]" : ""}`}
                  >
                    {String(opt).toUpperCase()}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-[12px] leading-4 text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

/** Языки для автоперевода */
/** Языки для автоперевода */
const LANG_MAP = {
  AR: "Arabic",
  BG: "Bulgarian",
  CS: "Czech",
  DA: "Danish",
  DE: "German",
  EL: "Greek",
  EN: "English (all variants)",
  ES: "Spanish (all variants)",
  ET: "Estonian",
  FI: "Finnish",
  FR: "French",
  HE: "Hebrew (text translation via next-gen models only)",
  HU: "Hungarian",
  ID: "Indonesian",
  IT: "Italian",
  JA: "Japanese",
  KO: "Korean",
  LT: "Lithuanian",
  LV: "Latvian",
  NB: "Norwegian Bokmål",
  NL: "Dutch",
  PL: "Polish",
  PT: "Portuguese (all variants)",
  RO: "Romanian",
  RU: "Russian",
  SK: "Slovak",
  SL: "Slovenian",
  SV: "Swedish",
  TH: "Thai (text translation via next-gen models only)",
  TR: "Turkish",
  UK: "Ukrainian",
  VI: "Vietnamese (text translation via next-gen models only)",
  ZH: "Chinese (all variants)",
} as const;

type LangCode = keyof typeof LANG_MAP;

function LanguageSelect({
  value,
  onChange,
  label = "Язык автоперевода",
}: {
  value: LangCode | "";
  onChange: (v: LangCode) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hoverKey, setHoverKey] = useState<LangCode>("EN");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const keys = Object.keys(LANG_MAP) as LangCode[];

  // пересчитать позицию меню
  const positionMenu = () => {
    const el = triggerRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const margin = 6;
    const viewportH = window.innerHeight;
    const menuMaxH = Math.min(320, viewportH - (r.bottom + margin) - margin);

    // если снизу мало места — открываем вверх
    const openUp = menuMaxH < 180 && r.top > viewportH / 2;
    const top = openUp ? Math.max(margin, r.top - 6) : r.bottom + 4;
    const transform = openUp ? "translateY(-100%)" : "none";

    setMenuStyle({
      position: "fixed",
      left: Math.max(
        margin,
        Math.min(r.left, window.innerWidth - r.width - margin)
      ),
      top,
      width: r.width,
      maxHeight: openUp
        ? Math.min(320, r.top - margin * 2)
        : Math.min(320, viewportH - r.bottom - margin),
      transform,
      zIndex: 10050, // выше карточки модалки
    });
  };

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const onResize = () => positionMenu();
    const onScroll = () => positionMenu();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // клик вне — закрыть
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current &&
        (t === triggerRef.current || triggerRef.current.contains(t))
      )
        return;
      // если кликнули по самому меню — ничего не делаем (ниже stopPropagation)
      // иначе закрываем
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="w-full">
      <Label className="text-[#69b2f1] text-xs font-semibold">{label}</Label>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="cursor-pointer w-full mt-1 px-3 py-2 rounded-lg bg-[#121a24] border border-[#1e2c3a] hover:border-[#2b5278] text-white/90 outline-none flex items-center justify-between"
        >
          <span className="truncate">
            {value
              ? `${value} — ${LANG_MAP[value as LangCode]}`
              : "Выберите язык"}
          </span>
          <ChevronDown className="w-4 h-4 opacity-80" />
        </button>

        {open &&
          createPortal(
            <ul
              data-modal-portal="dropdown"
              className="rounded-lg border border-[#1e2c3a] bg-[#0e1621] shadow-xl overflow-auto"
              style={menuStyle}
              onMouseDown={(e) => e.stopPropagation()} // чтобы «клик вне» не схлопывал меню
            >
              {keys.map((code) => {
                const active = value === code;
                const hovered = hoverKey === code;
                return (
                  <li key={code}>
                    <button
                      type="button"
                      onMouseEnter={() => setHoverKey(code)}
                      onClick={() => {
                        onChange(code);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm cursor-pointer ${
                        active ? "bg-[#182432] text-[#9ec1ff]" : "text-white/90"
                      } ${hovered ? "bg-[#17212b]" : ""}`}
                    >
                      {code} — {LANG_MAP[code]}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body
          )}
      </div>
    </div>
  );
}

/* ======== modal ======== */

type Props = {
  open: boolean;
  onClose: () => void;
  telegramAccountId: string | number;
  currentProxy: ProxyConfig | null;
  currentLanguage?: string | null;
  username?: string;
  onChanged?: (next?: ProxyResponse) => void;
  ownerUserId: number | null;
  /** какой таб открыть сразу */
  initialTab?: "channel" | "proxy" | "translation";
};

const normalizeId = (id: string | number) => String(id);

export default function TgAccountSettingsModal({
  open,
  onClose,
  telegramAccountId,
  currentProxy,
  currentLanguage,
  username,
  onChanged,
  ownerUserId,
  initialTab = "channel",
}: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // игнор, если клик внутри самой карточки
      if (cardRef.current && target && cardRef.current.contains(target)) return;
      // игнор кликов по портальным меню селектов (языки и т.п.)
      if (target?.closest('[data-modal-portal="dropdown"]')) return;
      onClose();
    };
    document.addEventListener("mousedown", onDocDown, true);
    return () => document.removeEventListener("mousedown", onDocDown, true);
  }, [open, onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open || !mounted) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [open, mounted]);

  /* --- tabs --- */
  const [tab, setTab] = useState<"channel" | "proxy" | "translation">(
    initialTab
  );
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  /* --- proxy state --- */
  const [form, setForm] = useState<ProxyConfig>({
    type: currentProxy?.type || "http",
    host: currentProxy?.host || "",
    port: (currentProxy?.port as any) || "",
    username: currentProxy?.username || "",
    password: currentProxy?.password || "",
  });

  const [busy, setBusy] = useState<
    "save" | "update" | "remove" | "test" | null
  >(null);
  const hasProxy = useMemo(() => !!currentProxy, [currentProxy]);

  useEffect(() => {
    if (!open) return;
    setForm({
      type: currentProxy?.type || "http",
      host: currentProxy?.host || "",
      port: (currentProxy?.port as any) || "",
      username: currentProxy?.username || "",
      password: currentProxy?.password || "",
    });
  }, [open, currentProxy]);

  const validPort = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n < 65536;
  };

  const onChangeField = (k: keyof ProxyConfig, v: any) => {
    setForm((prev) => ({
      ...prev,
      [k]: k === "port" ? (v === "" ? "" : Number(v)) : v,
    }));
  };

  const doAddOrUpdate = async () => {
    if (!String(form.host).trim()) return toast.error("Укажите host");
    if (!validPort(form.port))
      return toast.error("Некорректный port (1..65535)");
    if (!String(form.type).trim()) return toast.error("Укажите type");

    try {
      setBusy(hasProxy ? "update" : "save");
      const id = normalizeId(telegramAccountId);
      const call = hasProxy ? updateProxy : addProxy;
      const resp = await call(id, {
        type: String(form.type).trim(),
        host: String(form.host).trim(),
        port: Number(form.port),
        username: form.username?.trim() || "",
        password: form.password?.trim() || "",
      });

      toast.success(hasProxy ? "Прокси обновлён" : "Прокси установлен");
      onChanged?.(resp);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось сохранить прокси");
    } finally {
      setBusy(null);
    }
  };

  const doRemove = async () => {
    const ok = window.confirm("Удалить прокси у этого аккаунта?");
    if (!ok) return;
    try {
      setBusy("remove");
      const id = normalizeId(telegramAccountId);
      const resp = await removeProxy(id);
      toast.success("Прокси удалён");
      onChanged?.(resp);
      setForm({
        type: "http",
        host: "",
        port: "" as any,
        username: "",
        password: "",
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось удалить прокси");
    } finally {
      setBusy(null);
    }
  };

  const doTest = async () => {
    try {
      setBusy("test");
      const id = normalizeId(telegramAccountId);
      const resp = await testProxy(id);
      if (resp.test_result?.success) {
        toast.success(
          `Прокси работает (${resp.test_result.response_time || "—"})`
        );
      } else {
        toast.error(
          `Прокси не отвечает: ${resp.test_result?.error || "ошибка"}`
        );
      }
      onChanged?.(resp);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось выполнить тест");
    } finally {
      setBusy(null);
    }
  };

  /* --- channel state --- */
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [assigning, setAssigning] = useState<string | number | null>(null);

  const tryLoadChannels = async () => {
    if (ownerUserId == null) {
      toast.error("Не удалось определить user_id владельца для каналов.");
      return;
    }
    try {
      setLoadingChannels(true);
      const list = await fetchUserChannels(ownerUserId);
      setChannels(list);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось загрузить каналы");
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (open) tryLoadChannels();
  }, [open]);

  const onAssignChannel = async (ch: Channel) => {
    const channel_id = ch.id ?? ch.channel_id;
    if (!telegramAccountId)
      return toast.error("Не удалось определить ID Telegram аккаунта");
    if (!channel_id) return toast.warning("Некорректный канал");

    try {
      setAssigning(String(channel_id));
      await setTelegramChannel({
        channel_id,
        telegram_account_id: telegramAccountId,
      });
      toast.success("Канал назначен Telegram-аккаунту");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось назначить канал");
    } finally {
      setAssigning(null);
    }
  };

  /* --- translation state --- */
  const [lang, setLang] = useState<LangCode | "">(
    ((currentLanguage || "").toUpperCase() as LangCode) in LANG_MAP
      ? ((currentLanguage || "").toUpperCase() as LangCode)
      : ""
  );
  const [savingLang, setSavingLang] = useState(false);

  const saveLanguage = async () => {
    if (!lang) return toast.warning("Выберите язык");
    try {
      setSavingLang(true);
      await setTelegramLanguage({
        telegram_account_id: normalizeId(telegramAccountId),
        language: lang,
      });
      toast.success("Язык автоперевода установлен");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Не удалось установить язык");
    } finally {
      setSavingLang(false);
    }
  };

  if (!open || !mounted) return null;

  const modal = (
    <div className="fixed inset-0 z-[10000]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
        <div
          ref={cardRef}
          className="relative w-full sm:max-w-5xl bg-[#0c141d] border border-[#233243] shadow-2xl rounded-none sm:rounded-2xl flex flex-col overflow-hidden"
        >
          {/* header */}
          <div className="px-4 py-3 border-b border-[#233243] bg-[#0e1621] flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#9ec1ff]" />
            <div className="min-w-0">
              <div className="text-white font-semibold truncate">
                Настройки для {username ? `@${username}` : "Telegram аккаунта"}
              </div>
              <div className="text-[12px] text-inactive truncate">
                ID: {normalizeId(telegramAccountId)}
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

          {/* tabs */}
          <div className="px-4 pt-3">
            <div className="inline-flex rounded-lg border border-white/10 bg-[#0e1621] p-1">
              <button
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 cursor-pointer ${
                  tab === "channel"
                    ? "bg-[#17212b] text-[#9ec1ff]"
                    : "text-white/80 hover:text-white"
                }`}
                onClick={() => setTab("channel")}
              >
                <Group className="w-4 h-4" /> Канал
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 cursor-pointer ${
                  tab === "proxy"
                    ? "bg-[#17212b] text-[#9ec1ff]"
                    : "text-white/80 hover:text-white"
                }`}
                onClick={() => setTab("proxy")}
              >
                <Shield className="w-4 h-4" /> Прокси
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 cursor-pointer ${
                  tab === "translation"
                    ? "bg-[#17212b] text-[#9ec1ff]"
                    : "text-white/80 hover:text-white"
                }`}
                onClick={() => setTab("translation")}
              >
                <Languages className="w-4 h-4" /> Перевод
              </button>
            </div>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "channel" && (
              <div className="space-y-3">
                <div className="text-[12px] uppercase tracking-wide text-inactive">
                  Выбор канала
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0e1621] p-3">
                  {loadingChannels ? (
                    <div className="flex items-center gap-2 text-sm text-inactive py-6 justify-center">
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                      Загрузка каналов…
                    </div>
                  ) : !channels.length ? (
                    <div className="text-sm text-inactive py-6 text-center">
                      Каналы не найдены
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-auto rounded-lg border border-white/5">
                      <ul className="divide-y divide-white/5">
                        {channels.map((ch, idx) => {
                          const title = getReadableChannelTitle(ch);
                          const chId = ch.id ?? ch.channel_id ?? idx;
                          const isThisBusy = assigning === String(chId);
                          return (
                            <li key={idx}>
                              <button
                                onClick={() => onAssignChannel(ch)}
                                disabled={!!assigning}
                                className="w-full text-left px-3 py-2 hover:bg-[#17212b] transition disabled:opacity-60 cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm text-white/90 truncate">
                                    {title}
                                  </span>
                                  {isThisBusy && (
                                    <RefreshCcw className="w-4 h-4 animate-spin text-white/70" />
                                  )}
                                </div>
                                <div className="text-xs text-inactive truncate">
                                  ID: {String(ch.id ?? ch.channel_id ?? "—")}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="mt-3">
                    <Button
                      onClick={tryLoadChannels}
                      className="px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] inline-flex items-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Обновить список каналов
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {tab === "proxy" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* левая: форма прокси */}
                <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
                  <div className="text-[12px] uppercase tracking-wide text-inactive mb-3">
                    Настройка прокси
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="col-span-1">
                      <ProxyTypeSelect
                        value={form.type}
                        onChange={(v) => onChangeField("type", v)}
                        label="Тип"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="text-[12px] text-inactive">Хост</label>
                      <input
                        value={form.host}
                        onChange={(e) => onChangeField("host", e.target.value)}
                        placeholder="1.2.3.4"
                        className="w-full mt-1 rounded-md bg-[#121a24] border border-[#1e2c3a] text-white/90 px-3 py-2 outline-none focus:border-[#2b5278]"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="text-[12px] text-inactive">Порт</label>
                      <input
                        value={form.port as any}
                        onChange={(e) =>
                          onChangeField(
                            "port",
                            e.target.value.replace(/[^\d]/g, "")
                          )
                        }
                        inputMode="numeric"
                        placeholder="1080"
                        className="w-full mt-1 rounded-md bg-[#121a24] border border-[#1e2c3a] text-white/90 px-3 py-2 outline-none focus:border-[#2b5278]"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="text-[12px] text-inactive">Логин</label>
                      <input
                        value={form.username || ""}
                        onChange={(e) =>
                          onChangeField("username", e.target.value)
                        }
                        placeholder="user (опционально)"
                        className="w-full mt-1 rounded-md bg-[#121a24] border border-[#1e2c3a] text-white/90 px-3 py-2 outline-none focus:border-[#2b5278]"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2">
                      <label className="text-[12px] text-inactive">
                        Пароль
                      </label>
                      <input
                        value={form.password || ""}
                        onChange={(e) =>
                          onChangeField("password", e.target.value)
                        }
                        placeholder="password (опционально)"
                        type="password"
                        className="w-full mt-1 rounded-md bg-[#121a24] border border-[#1e2c3a] text-white/90 px-3 py-2 outline-none focus:border-[#2b5278]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      onClick={doAddOrUpdate}
                      disabled={busy === "save" || busy === "update"}
                      className="px-3 py-2 rounded-lg border border-[#2b5278] bg-[#17212b] text-[#9ec1ff] hover:bg-[#1b2836] inline-flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {hasProxy ? "Обновить прокси" : "Сохранить прокси"}
                    </Button>

                    <Button
                      onClick={doTest}
                      disabled={busy === "test"}
                      className="px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] inline-flex items-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Тестировать
                    </Button>

                    {hasProxy && (
                      <Button
                        onClick={doRemove}
                        disabled={busy === "remove"}
                        className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-900/20 text-red-300 hover:border-red-500 hover:bg-red-900/30 inline-flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Удалить прокси
                      </Button>
                    )}
                  </div>
                </div>

                {/* правая колонка: статус */}
                <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
                  <div className="text-[12px] uppercase tracking-wide text-inactive mb-3">
                    Статус
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-white/10 bg-[#0b121a] p-3">
                      <div className="text-sm text-white/90 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[#9ec1ff]" />
                        Текущая конфигурация
                      </div>
                      <div className="mt-2 text-[13px] text-white/80">
                        {hasProxy ? (
                          <ul className="space-y-1">
                            <li>
                              <span className="text-inactive">Тип:</span>{" "}
                              {currentProxy!.type}
                            </li>
                            <li>
                              <span className="text-inactive">Хост:</span>{" "}
                              {currentProxy!.host}:{currentProxy!.port}
                            </li>
                            <li>
                              <span className="text-inactive">Логин:</span>{" "}
                              {currentProxy!.username || "—"}
                            </li>
                          </ul>
                        ) : (
                          <span className="text-inactive">
                            Прокси не установлен
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-[#0b121a] p-3">
                      <div className="text-sm text-white/90 flex items-center gap-2">
                        <RefreshCcw className="w-4 h-4 text-[#9ec1ff]" />
                        Последний тест
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "translation" && (
              <div className="rounded-xl border border-white/10 bg-[#0e1621] p-4">
                <div className="text-[12px] uppercase tracking-wide text-inactive mb-3">
                  Автоперевод исходящих сообщений
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <LanguageSelect
                    value={lang}
                    onChange={(c) => setLang(c)}
                    label="Целевой язык"
                  />
                  <div className="sm:col-span-2 text-sm text-inactive">
                    Сообщения, отправленные из CRM, будут автопереведены на
                    выбранный язык.
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    onClick={saveLanguage}
                    disabled={savingLang}
                    className="px-3 py-2 rounded-lg border border-[#2b5278] bg-[#17212b] text-[#9ec1ff] hover:bg-[#1b2836] inline-flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить язык
                  </Button>

                  {currentLanguage ? (
                    <div className="text-xs text-inactive">
                      Текущий: {(currentLanguage as string).toUpperCase()}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
