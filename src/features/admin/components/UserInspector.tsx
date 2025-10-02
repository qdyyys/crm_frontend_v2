import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileTerminal, List, ScanSearch, X } from "lucide-react";
import { getLogs, getStats } from "../services/accounts";
import type { StatPeriod } from "../types";
import { highlightText } from "../utils/text";
import { useLogsBrowser } from "../hooks/useLogsBrowser";
import InputField from "@/components/InputField";

const PERIOD_RU: Record<StatPeriod, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  year: "Год",
};

const PERIOD_RU_GEN: Record<StatPeriod, string> = {
  day: "за день",
  week: "за неделю",
  month: "за месяц",
  year: "за год",
};

export default function UserInspector() {
  const [mode, setMode] = useState<"logs" | "stats">("logs");
  const [login, setLogin] = useState("");
  const [period, setPeriod] = useState<StatPeriod>("day");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    type: "logs" | "stats";
    data: any;
  }>(null);

  const run = async () => {
    const l = login.trim();
    if (!l) {
      toast.warning("Введите логин пользователя");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      if (mode === "logs") setResult({ type: "logs", data: await getLogs(l) });
      else setResult({ type: "stats", data: await getStats(l, period) });
    } catch (e) {
      toast.error(
        mode === "logs"
          ? "Не удалось получить логи"
          : "Не удалось получить статистику"
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setLoading(false);
  };

  const allLogs: string[] = useMemo(
    () => (Array.isArray(result?.data?.logs) ? result!.data!.logs : []),
    [result]
  );
  const logs = useLogsBrowser(allLogs, 300);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [endInView, setEndInView] = useState(false);

  useEffect(() => {
    if (!scrollRef.current || !endRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setEndInView(entry.isIntersecting),
      { root: scrollRef.current, threshold: 1.0 }
    );
    io.observe(endRef.current);
    return () => io.disconnect();
  }, [result?.type]);

  return (
    <Card className="modern-card">
      <CardHeader className="card-header">
        <CardTitle className="section-title">
          <div className="title-icon">
            <List className="w-5 h-5" />
          </div>
          <div>
            <h3>Активность</h3>
            <p className="section-subtitle">Получение логов или статистики</p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="card-content">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex overflow-hidden rounded-lg border border-[#1e2c3a] bg-[#0c141d] w-full">
            <button
              type="button"
              aria-pressed={mode === "logs"}
              onClick={() => {
                setMode("logs");
                reset();
              }}
              className={`px-3 py-3 flex items-center gap-2 text-sm transition w-full cursor-pointer ${
                mode === "logs"
                  ? "bg-[#17212b] text-[#9ec1ff] border-r border-[#1e2c3a]"
                  : "text-white/80 hover:bg-[#121a24] border-r border-[#1e2c3a]"
              }`}
              title="Режим: логи"
            >
              <FileTerminal size={16} /> Логи
            </button>
            <button
              type="button"
              aria-pressed={mode === "stats"}
              onClick={() => {
                setMode("stats");
                reset();
              }}
              className={`px-3 py-3 flex items-center gap-2 text-sm transition w-full cursor-pointer ${
                mode === "stats"
                  ? "bg-[#17212b] text-[#9ec1ff]"
                  : "text-white/80 hover:bg-[#121a24]"
              }`}
              title="Режим: статистика"
            >
              <BarChart3 size={16} /> Статистика
            </button>
          </div>

          {mode === "stats" && (
            <div className="flex items-center gap-2">
              {(["day", "week", "month", "year"] as StatPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 rounded-md text-xs border transition cursor-pointer ${
                    period === p
                      ? "border-[#2b5278] bg-[#17212b] text-[#9ec1ff]"
                      : "border-[#1e2c3a] bg-[#121a24] text-white/80 hover:border-[#2b5278]"
                  }`}
                  title={`Период: ${PERIOD_RU_GEN[p]}`}
                >
                  {PERIOD_RU[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
          <InputField
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Логин пользователя"
          />
          <Button
            onClick={run}
            disabled={loading || !login.trim()}
            className="outline-none cursor-pointer px-3 py-2 rounded-lg border transition select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed"
            variant="ghost"
          >
            <ScanSearch />
          </Button>
          <Button
            onClick={reset}
            disabled={loading && !result}
            className="outline-none cursor-pointer px-3 py-2 rounded-lg border transition select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
            variant="ghost"
          >
            <X />
          </Button>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="p-6 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
              Загрузка…
            </div>
          ) : !result ? (
            <div className="p-4 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
              Укажите логин и нажмите «Получить»
            </div>
          ) : result.type === "logs" ? (
            <div className="space-y-3 relative">
              <div className="flex flex-wrap items-center gap-2 text-xs text-inactive">
                {"total_logs" in (result.data || {}) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[12px] border-[#2f6ea5]/40 bg-[#2f6ea5]/10 text-[#9ec1ff]">
                    всего: {result.data.total_logs}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[12px] border-[#2f6ea5]/40 bg-[#2f6ea5]/10 text-[#9ec1ff]">
                  найдено: {logs.filtered.length}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[12px] border-[#2f6ea5]/40 bg-[#2f6ea5]/10 text-[#9ec1ff]">
                  показано: {logs.visible.length}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <InputField
                  value={logs.query}
                  onChange={(e) => logs.setQuery(e.target.value)}
                  placeholder="Поиск по логам…"
                />
              </div>

              {logs.filtered.length ? (
                <div
                  ref={scrollRef}
                  className="max-h-[60vh] overflow-auto space-y-2 pr-1 tg-scroll rounded-xl border border-white/5 bg-[#0e1621]/60"
                >
                  {logs.visible.map((line: string, i: number) => {
                    const low = String(line);
                    const lowLc = low.toLowerCase();
                    const tone = lowLc.includes("error") || lowLc.includes("fail")
                      ? "bg-red-600/70"
                      : lowLc.includes("warn")
                      ? "bg-amber-500/70"
                      : "bg-[#2b5278]/70";
                    const zebra = i % 2 === 1 ? "bg-white/2" : "";

                    // naive timestamp extraction (ISO or common formats)
                    const iso = low.match(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/);
                    const dmy = low.match(/\b\d{2}[./-]\d{2}[./-]\d{4}[,\s]+\d{2}:\d{2}:\d{2}\b/);
                    const tsRaw = iso?.[0] || dmy?.[0] || "";
                    let tsStr = "—";
                    if (tsRaw) {
                      const d = new Date(tsRaw.replace(",", ""));
                      if (!isNaN(d.getTime())) tsStr = d.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    }
                    let message = tsRaw ? low.replace(tsRaw, "").trim() : low;
                    // убрать ведущие пустые скобки вида "[] " если остались после парсинга
                    message = message.replace(/^\s*\[\s*\]\s*/, "").trim();

                    return (
                      <div key={i} className="group">
                        <div className="flex">
                          <div className={`w-1 ${tone}`} />
                          <div className={`flex-1 px-3 py-2 transition rounded-lg ${zebra}`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center flex-wrap gap-2 min-w-0" />
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[12px] border-[#2f6ea5]/40 bg-[#2f6ea5]/10 text-[#9ec1ff]" style={{ fontFeatureSettings: '"tnum" 1' }}>
                                {tsStr}
                              </span>
                            </div>
                            {message && (
                              <div className="mt-2 rounded-lg border border-white/5 bg-[#0b121a] p-2">
                                <pre className="whitespace-pre-wrap text-xs text-white/90 break-words">
                                  {highlightText(message, logs.debounced)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div ref={endRef} />
                  {endInView && logs.visible.length < logs.filtered.length && (
                    <div className="py-3 flex justify-center">
                      <Button
                        onClick={() =>
                          logs.setShown((prev) =>
                            Math.min(prev + 300, logs.filtered.length)
                          )
                        }
                        className="outline-none cursor-pointer px-3 py-2 rounded-lg border transition select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] absolute -bottom-[0px]"
                        variant="ghost"
                      >
                        Показать ещё
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
                  Ничего не найдено
                </div>
              )}
            </div>
          ) : (
            (() => {
              const d = result.data || {};
              const summary = d?.summary || {};
              const raw = Array.isArray(d?.statistics) ? d.statistics : [];
              const grouped: Record<string, any> = {};
              for (const item of raw) {
                const id = String(item?.telegram_account_id ?? "unknown");
                const s = item?.summary || {};
                if (!grouped[id]) {
                  grouped[id] = {
                    telegram_account_id: id,
                    new_dialogs: 0,
                    replied: 0,
                    unread: 0,
                    active: 0,
                    unanswered: 0,
                    not_replied: 0,
                    total: 0,
                  };
                }
                grouped[id].new_dialogs += Number(s.new_dialogs || 0);
                grouped[id].replied += Number(s.replied || 0);
                grouped[id].unread += Number(s.unread || 0);
                grouped[id].active += Number(s.active || 0);
                grouped[id].unanswered += Number(s.unanswered || 0);
                grouped[id].not_replied += Number(s.not_replied || 0);
                grouped[id].total += Number(s.total || 0);
              }
              const rows = Object.values(grouped).sort(
                (a: any, b: any) => Number(b.total || 0) - Number(a.total || 0)
              );

              const labels: Record<string, string> = {
                new_dialogs: "Новых диалогов",
                replied: "С ответами",
                unread: "Непрочитанные",
                active: "Активные",
                unanswered: "Без ответа",
                not_replied: "Не ответили",
                total: "Всего",
              };

              const shortId = (id: string) =>
                id ? `${String(id).slice(0, 8)}…` : "—";

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
                    {Object.entries(labels).map(([key, title]) => (
                      <div
                        key={key}
                        className="rounded-xl border border-white/5 bg-[#313c4933] p-3"
                      >
                        <p className="text-xs text-inactive">{title}</p>
                        <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                          {Number((summary as any)?.[key] ?? 0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {rows.length ? (
                      rows.map((r: any) => (
                        <div
                          key={r.telegram_account_id}
                          className="rounded-2xl border border-white/5 bg-[#313c4933] p-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-white/90 font-semibold">
                              Telegram-аккаунт
                            </div>
                            <Badge className="action-badge">
                              {shortId(r.telegram_account_id)}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(labels).map(([key, title]) => (
                              <div
                                key={key}
                                className="rounded-lg border border-white/5 bg-[#0b121a] p-2"
                              >
                                <p className="text-[11px] leading-tight text-inactive">
                                  {title}
                                </p>
                                <p className="mt-1 text-base font-semibold text-white tabular-nums">
                                  {Number((r as any)?.[key] ?? 0)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
                        Нет данных по аккаунтам
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </CardContent>
    </Card>
  );
}
