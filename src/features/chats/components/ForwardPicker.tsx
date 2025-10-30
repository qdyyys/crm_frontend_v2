import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import clsx from "clsx";
import { User, UserX } from "lucide-react";
import ImagePreload from "@/components/ImagePreload";
import defaultAvatar from "@public/images/df_avatar.jpg";

type Chat = {
  id: number | string;
  title?: string;
  username?: string;
  last_message?: { from_user?: { first_name?: string } };
  is_pinned?: boolean;
  pinned_pos?: number;
  line?: "first" | "second" | string;
  avatar: string;
};

export type ForwardPickerProps = {
  open: boolean;

  chats: Chat[];
  onPick: (chat: Chat) => void;
  onClose: () => void;

  dropAuthor: boolean;
  onToggleDropAuthor: (v: boolean) => void;

  loadMoreChats: (line: "first" | "second") => void;
  hasMoreChatsFirst: boolean;
  hasMoreChatsSecond: boolean;
  isLoadingMoreFirst: boolean;
  isLoadingMoreSecond: boolean;
};

const nameOf = (c: Chat) =>
  c.title ||
  c.username ||
  c.last_message?.from_user?.first_name ||
  String(c.id);

const normLine = (v: any): "first" | "second" | null => {
  const s = String(v ?? "").toLowerCase();
  if (
    s.includes("first") ||
    s.includes("first_line") ||
    s === "1" ||
    s === "1st" ||
    s.includes("первая")
  )
    return "first";
  if (
    s.includes("second") ||
    s.includes("second_line") ||
    s === "2" ||
    s === "2nd" ||
    s.includes("вторая")
  )
    return "second";
  return null;
};

export default function ForwardPicker({
  open,
  chats,
  onPick,
  onClose,
  dropAuthor,
  onToggleDropAuthor,

  loadMoreChats,
  hasMoreChatsFirst,
  hasMoreChatsSecond,
  isLoadingMoreFirst,
  isLoadingMoreSecond,
}: ForwardPickerProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);

  const [lineTab, setLineTab] = useState<"first" | "second">("first");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    return chats.filter(
      (c) => normLine(c.line) === lineTab || normLine(c.line) === null
    );
  }, [chats, lineTab]);

  const ordered = useMemo(() => {
    const pinned = filtered
      .filter((c: any) => c.is_pinned)
      .sort((a: any, b: any) => (a.pinned_pos ?? 1e9) - (b.pinned_pos ?? 1e9));
    const others = filtered.filter((c: any) => !c.is_pinned);
    return [...pinned, ...others];
  }, [filtered]);

  const tryLoadMore = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) <= 80;

    const isFirst = lineTab === "first";
    const hasMore = isFirst ? hasMoreChatsFirst : hasMoreChatsSecond;
    const isLoading = isFirst ? isLoadingMoreFirst : isLoadingMoreSecond;

    if (nearBottom && hasMore && !isLoading) {
      loadMoreChats(lineTab);
    }
  }, [
    lineTab,
    hasMoreChatsFirst,
    hasMoreChatsSecond,
    isLoadingMoreFirst,
    isLoadingMoreSecond,
    loadMoreChats,
  ]);

  const onScroll = () => tryLoadMore();
  useEffect(() => {
    if (!open) return;
    const root = listRef.current;
    const target = bottomRef.current;
    if (!root || !target) return;

    ioRef.current?.disconnect();
    ioRef.current = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;

        const isFirst = lineTab === "first";
        const hasMore = isFirst ? hasMoreChatsFirst : hasMoreChatsSecond;
        const isLoading = isFirst ? isLoadingMoreFirst : isLoadingMoreSecond;

        if (hasMore && !isLoading) {
          loadMoreChats(lineTab);
        }
      },
      { root, threshold: 0.01 }
    );
    ioRef.current.observe(target);

    return () => ioRef.current?.disconnect();
  }, [
    open,
    lineTab,
    hasMoreChatsFirst,
    hasMoreChatsSecond,
    isLoadingMoreFirst,
    isLoadingMoreSecond,
    loadMoreChats,
  ]);

  useEffect(() => {
    if (!open) return;
    const isFirst = lineTab === "first";
    const hasMore = isFirst ? hasMoreChatsFirst : hasMoreChatsSecond;
    const isLoading = isFirst ? isLoadingMoreFirst : isLoadingMoreSecond;

    if (!isLoading && hasMore && ordered.length < 20) {
      loadMoreChats(lineTab);
    }
  }, [lineTab, open]);

  if (!open) return null;

  const isFirst = lineTab === "first";
  const isLoadingNow = isFirst ? isLoadingMoreFirst : isLoadingMoreSecond;
  const hasMoreNow = isFirst ? hasMoreChatsFirst : hasMoreChatsSecond;

  return (
    <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex">
      <div
        ref={boxRef}
        className="w-full m-auto max-w-md rounded-2xl border border-[#1e2c3a] bg-[#17212b] shadow-2xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[#1e2c3a] flex items-center justify-between">
          <div className="text-base font-semibold">Переслать…</div>
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-[#1e2c3a]">
          <div
            role="tablist"
            aria-label="Линия"
            className="relative w-full rounded-xl border border-[#223140] bg-[#242f3d] backdrop-blur
               px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
          >
            <div
              className="
        pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)]
        rounded-lg bg-gradient-to-b from-[#214469] to-[#2b5278]
        shadow-[0_6px_16px_rgba(15,23,34,.6),inset_0_1px_0_rgba(255,255,255,.06)]
        transition-transform duration-300 will-change-transform
      "
              style={{
                transform:
                  lineTab === "first"
                    ? "translateX(0)"
                    : "translateX(calc(100% + 8px))",
              }}
              aria-hidden
            />

            <div className="grid grid-cols-2 gap-2 relative z-10">
              <button
                role="tab"
                aria-selected={lineTab === "first"}
                onClick={() => setLineTab("first")}
                className={`
          h-8 rounded-md text-sm font-medium transition-colors w-full cursor-pointer
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]
          ${
            lineTab === "first"
              ? "text-white"
              : "text-white/70 hover:text-white"
          }
        `}
              >
                1 линия
              </button>
              <button
                role="tab"
                aria-selected={lineTab === "second"}
                onClick={() => setLineTab("second")}
                className={`
          h-8 rounded-md text-sm font-medium transition-colors w-full cursor-pointer
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]
          ${
            lineTab === "second"
              ? "text-white"
              : "text-white/70 hover:text-white"
          }
        `}
              >
                2 линия
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={dropAuthor}
          onClick={() => onToggleDropAuthor(!dropAuthor)}
          className={clsx(
            "w-full px-4 py-3 flex items-center gap-3",
            "border-b border-[#1e2c3a] text-left",
            "hover:bg-[#1f2e3a] transition-colors cursor-pointer"
          )}
        >
          {dropAuthor ? (
            <User className="w-5 h-5 opacity-90" />
          ) : (
            <UserX className="w-5 h-5 opacity-90" />
          )}
          <span className="text-[15px]">
            {dropAuthor ? "Показать имя отправителя" : "Скрыть имя отправителя"}
          </span>
        </button>
        <div
          ref={listRef}
          className="max-h-[65vh] overflow-y-auto tg-scroll"
          onScroll={onScroll}
        >
          {ordered.length === 0 && (
            <div className="text-center text-sm text-white/50 py-6">
              Нет чатов в этой линии
            </div>
          )}

          {ordered.map((c) => {
            const title = nameOf(c);
            return (
              <button
                key={String(c.id)}
                onClick={() => onPick(c)}
                className="w-full text-left px-3 py-2 hover:bg-[#1f2e3a] cursor-pointer flex items-center gap-3"
              >
                <ImagePreload src={c?.avatar || defaultAvatar} width={30} />

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{title}</div>
                </div>
              </button>
            );
          })}

          <div ref={bottomRef} style={{ height: 1 }} />

          {hasMoreNow && (
            <div className="py-3 flex items-center justify-center">
              <button
                onClick={() => loadMoreChats(lineTab)}
                className="text-sm px-3 py-1.5 rounded bg-[#122132] hover:bg-[#183148] border border-[#1e2c3a] disabled:opacity-60"
                disabled={isLoadingNow}
              >
                {isLoadingNow ? "Загрузка…" : "Показать ещё"}
              </button>
            </div>
          )}
        </div>

        <div className="w-full flex items-center justify-end py-2 px-4 border-t border-[#1e2c3a]">
          <button
            onClick={onClose}
            className="text-[#6ab2f2] font-[500] rounded cursor-pointer hover:bg-[#6ab3f210] py-1.5 px-4"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
