"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { TelegramAccount } from "../../types";
import { fetchAllTgAccounts } from "../../services/telegram";
import TgAccountCard from "./TgAccountCard";
import { FileText } from "lucide-react";

const PAGE_SIZE = 6;

export default function TgAccountsSection() {
  const [items, setItems] = useState<TelegramAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil((items?.length ?? 0) / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = useMemo(
    () => (items ?? []).slice(pageStart, pageStart + PAGE_SIZE),
    [items, pageStart]
  );

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));
  const prevPage = () => goToPage(page - 1);
  const nextPage = () => goToPage(page + 1);

  const load = async () => {
    try {
      setLoading(true);
      const list = await fetchAllTgAccounts();
      setItems(list);
    } catch (e: any) {
      setItems([]);
      const msg =
        e?.response?.data?.message || "Не удалось загрузить Telegram аккаунты";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const max = Math.max(1, Math.ceil((items?.length ?? 0) / PAGE_SIZE));
    if (page > max) setPage(max);
  }, [items, page]);

  return (
    <Card className="modern-card mt-8 relative visib">
      <CardHeader className="card-header">
        <CardTitle className="section-title">
          <div className="title-icon">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3>Telegram аккаунты (CRM)</h3>
            <p className="section-subtitle">
              Список всех подключенных Telegram аккаунтов
            </p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="card-content overflow-visible">
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 h-9 has-[>svg]:px-3 outline-none cursor-pointer px-3 py-2 rounded-lg border border-[#1e2c3a] bg-[#121a24] text-white/90">
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
        ) : !items.length ? (
          <div className="p-6 text-center text-inactive border border-white/5 rounded-xl bg-[#313c4933]">
            Аккаунтов пока нет
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {pageItems.map((tg, i) => (
                <div key={i} className="relative group">
                  <TgAccountCard tg={tg} onRefreshAccounts={load} />
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                onClick={prevPage}
                disabled={page === 1}
                className="outline-none cursor-pointer px-3 py-2 rounded-lg border transition select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed "
                variant="ghost"
              >
                Назад
              </Button>

              <span className="text-sm text-inactive px-2">
                Страница {page} / {totalPages}
              </span>

              <Button
                onClick={nextPage}
                disabled={page === totalPages}
                className="outline-none cursor-pointer px-3 py-2 rounded-lg border transition select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6] disabled:opacity-60 disabled:cursor-not-allowed"
                variant="ghost"
              >
                Далее
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
