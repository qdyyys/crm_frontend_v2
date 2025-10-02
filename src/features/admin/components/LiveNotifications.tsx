import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, BellRing } from "lucide-react";
import { wsPath } from "@/lib/backend";

type WorkerNotification = {
  type: string;
  message: string;
  data?: any;
};

const toneByKind = (kind: string) => {
  // оформление ближе к логам, но с мягкими акцентами
  if (kind.includes("error") || kind.includes("fail")) {
    return {
      chip: "border-red-700/40 bg-red-900/20 text-red-300",
      bar: "bg-red-600/70",
    };
  }
  if (kind.includes("warn")) {
    return {
      chip: "border-amber-700/40 bg-amber-900/20 text-amber-300",
      bar: "bg-amber-500/70",
    };
  }
  if (kind.includes("success") || kind.includes("ok")) {
    return {
      chip: "border-emerald-700/40 bg-emerald-900/20 text-emerald-300",
      bar: "bg-emerald-500/70",
    };
  }
  return {
    chip: "border-[#2f6ea5]/40 bg-[#2f6ea5]/10 text-[#9ec1ff]",
    bar: "bg-[#2b5278]/70",
  };
};

export default function LiveNotifications() {
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [status, setStatus] = useState<
    "connecting" | "open" | "closed" | "error"
  >("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number>(0);

  const connect = () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setStatus("error");
      return;
    }

    setStatus("connecting");

    const ws = new WebSocket(
      wsPath("/panel/accounts/admin/ws", `token=${encodeURIComponent(token)}`)
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("open");
      retryRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed && typeof parsed === "object") {
          // noise filter injected below
          if (isSystemNoise(parsed)) return;
          setNotifications((prev: WorkerNotification[]) =>
            [
              ...prev,
              {
                type: parsed.type ?? "notification",
                message: parsed.message ?? JSON.stringify(parsed),
                data: parsed.data,
              },
            ].slice(-500)
          );
        }
      } catch {
        const raw = String(event.data || "");
        if (isSystemNoise(raw)) return;
        setNotifications((prev: WorkerNotification[]) =>
          [...prev, { type: "raw", message: raw }].slice(-500)
        );
      }
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus("closed");
      const delay = Math.min(1000 * Math.pow(2, retryRef.current), 15000);
      retryRef.current += 1;
      window.setTimeout(() => {
        if (wsRef.current === ws) connect();
      }, delay);
    };
  };

  useEffect(() => {
    connect();
    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, []);

  const humanizeKey = (key: string) => {
    const map: Record<string, string> = {
      detected_at: "Обнаружено",
      created_at: "Создано",
      updated_at: "Обновлено",
      inactivity_duration: "Время простоя",
      // time/datetime keys (EN and variations)
      started_at: "Начало",
      startedAt: "Начало",
      start_time: "Начало",
      startTime: "Начало",
      finished_at: "Завершено",
      finishedAt: "Завершено",
      end_time: "Окончание",
      endTime: "Окончание",
      // duration
      duration: "Длительность",
      total_duration: "Длительность",
      processing_duration: "Длительность",
      // common fields
      wallet_address: "Кошелек",
      worker_login: "Логин воркера",
      type: "Тип",
      message: "Сообщение",
      recent_notification: "Недавнее уведомление",
      worker_notification: "Уведомление воркера",
      foreign_wallet: "Чужой кошелёк",
    };
    if (map[key]) return map[key];
    const spaced = key.replace(/_/g, " ").trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

  const humanizeType = (type?: string): string => {
    if (!type) return "Уведомление";
    return humanizeKey(type);
  };

  const formatDateTime = (ts?: string | number | Date) => {
    try {
      const d = ts ? new Date(ts) : new Date();
      return d.toLocaleString([], {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return "—";
    }
  };

  const formatDurationMaybe = (v: any): string | null => {
    const s = String(v ?? "");
    const hasUnits = /[hms]/.test(s);
    if (!hasUnits) return null;
    const h = s.match(/(\d+)h/);
    const m = s.match(/(\d+)m/);
    const sec = s.match(/(\d+(?:\.\d+)?)s/);
    const parts: string[] = [];
    const hours = h ? parseInt(h[1], 10) : 0;
    const minutes = m ? parseInt(m[1], 10) : 0;
    const seconds = sec ? parseFloat(sec[1]) : 0;
    if (hours) parts.push(`${hours} ч`);
    if (minutes) parts.push(`${minutes} м`);
    if (!parts.length && seconds > 0) return "менее минуты";
    return parts.length ? parts.join(" ") : null;
  };

  const sanitizeMessage = (text?: string): string => {
    if (!text) return "";
    let out = String(text);
    // Удаляем фразу "ЧУЖОЙ кошелек: ДА" в любом регистре и с возможными пробелами
    out = out.replace(/чужо[йи]\s+кошел[её]к\s*:\s*да/gi, "Чужой кошелёк");
    // Нормализуем длительности из формата go-like: 14h52m26.858s, 1m0.2s, 3h, 45s и т.п.
    // Сначала самые длинные формы (часы+минуты+секунды)
    out = out.replace(
      /(\d+)h(\d+)m\d+(?:\.\d+)?s/gi,
      (_, h, m) => `${h} ч ${m} м`
    );
    // Часы+минуты без секунд
    out = out.replace(/(\d+)h(\d+)m/gi, (_, h, m) => `${h} ч ${m} м`);
    // Только часы с секундами → только часы
    out = out.replace(/(\d+)h\d+(?:\.\d+)?s/gi, (_, h) => `${h} ч`);
    // Только минуты с секундами → только минуты
    out = out.replace(/(\d+)m\d+(?:\.\d+)?s/gi, (_, m) => `${m} м`);
    // Только часы
    out = out.replace(/(\d+)h\b/gi, (_, h) => `${h} ч`);
    // Только минуты
    out = out.replace(/(\d+)m\b/gi, (_, m) => `${m} м`);
    // Оставшиеся секунды → "менее минуты"
    out = out.replace(/\b\d+(?:\.\d+)?s\b/gi, "менее минуты");
    return out.trim();
  };

  // const clearAll = () => setNotifications([]);

  const isSystemNoise = (payload: any): boolean => {
    try {
      const type = String(payload?.type ?? "").toLowerCase();
      const msg = String(payload?.message ?? payload ?? "").toLowerCase();
      if (!msg && (type === "ping" || type === "pong")) return true;
      if (type === "system" || type === "heartbeat" || type === "ping")
        return true;
      if (/подключение\s+к\s+админскому\s+веб-?сокету\s+установлено/i.test(msg))
        return true;
      if (/connection\s+to\s+admin\s+web-?socket\s+established/i.test(msg))
        return true;
      return false;
    } catch {
      return false;
    }
  };

  return (
    <Card className="modern-card overflow-hidden">
      <CardHeader className="card-header">
        <CardTitle className="section-title">
          <div className="title-icon">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h3>Уведомления</h3>
            <p className="section-subtitle">Трекинг событий</p>
          </div>
        </CardTitle>

        <div className="ml-auto flex items-center gap-2">
          <Badge className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-[#9ec1ff]">
            {status === "connecting" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status === "open" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="card-content">
        <div className="rounded-xl border border-white/5 bg-[#0e1621]/60 max-h-[360px] overflow-auto divide-y divide-white/5 tg-scroll">
          {notifications.length === 0 ? (
            <div className="p-5 text-inactive text-sm text-center">
              Пока нет уведомлений
            </div>
          ) : (
            <ul>
              {notifications
                .slice()
                .reverse()
                .map((n: WorkerNotification, idx: number) => {
                  const kind = String(n.type || "").toLowerCase();
                  const tone = toneByKind(kind);
                  const createdAt =
                    n?.data?.created_at ||
                    n?.data?.details?.detected_at ||
                    Date.now();
                  const title = humanizeType(n.type);
                  const details = n?.data?.details ?? null;

                  return (
                    <li key={idx} className="group">
                      <div className="flex">
                        {/* левая цветная полоса как в логах, но мягче */}
                        <div className={`w-1 ${tone.bar}`} />

                        <div
                          className={`flex-1 px-4 py-3 transition ${
                            idx % 2 === 1 ? "bg-white/2" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center flex-wrap gap-2 min-w-0">
                              {n?.data?.worker_login && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-white/10 bg-[#0b121a] text-[12px] text-inactive">
                                  {n.data.worker_login}
                                </span>
                              )}
                              {title !== "Недавнее уведомление" && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[12px] ${tone.chip}`}
                                >
                                  {title}
                                </span>
                              )}
                            </div>

                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md border text-[12px] border-[#2f6ea5]/40 bg-[#2f6ea5]/10 text-[#9ec1ff]"
                              style={{ fontFeatureSettings: '"tnum" 1' }}
                            >
                              {formatDateTime(createdAt)}
                            </span>
                          </div>

                          {(() => {
                            const msg = sanitizeMessage(n.message);
                            if (!msg) return null;
                            return (
                              <div className="mt-2 rounded-lg border border-white/5 bg-[#0b121a] p-2">
                                <div className="text-[13px] md:text-sm text-gray-200 whitespace-pre-wrap break-words">
                                  {msg}
                                </div>
                              </div>
                            );
                          })()}

                          {(() => {
                            if (!details || typeof details !== "object")
                              return null;
                            const entries = Object.entries(details).filter(
                              ([k, v]) => {
                                const keyNorm = String(k || "").toLowerCase();
                                const valStr = String(v ?? "")
                                  .trim()
                                  .toLowerCase();
                                if (
                                  keyNorm === "wallet_address" &&
                                  valStr === "да"
                                )
                                  return false;
                                if (keyNorm === "detected_at") return false;
                                return true;
                              }
                            );
                            if (!entries.length) return null;
                            return (
                              <div className="mt-2 rounded-lg border border-white/5 bg-[#0b121a] p-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[13px] text-gray-300">
                                  {entries.map(([k, v]) => {
                                    let val: any = v;
                                    if (
                                      /(?:^|_)(at|time)$/i.test(k) ||
                                      k === "detected_at" ||
                                      k === "created_at"
                                    ) {
                                      val = formatDateTime(v as any);
                                    } else {
                                      const maybe = formatDurationMaybe(v);
                                      if (maybe) val = maybe;
                                    }
                                    return (
                                      <div
                                        key={k}
                                        className="flex items-center justify-between gap-2 py-1 last:border-b-0"
                                      >
                                        <div className="text-inactive">
                                          {humanizeKey(k)}
                                        </div>
                                        <div
                                          className="text-right break-words whitespace-pre-wrap"
                                          title={String(val)}
                                        >
                                          {String(val)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
