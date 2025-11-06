import { useEffect, useMemo, useRef, useState } from "react";
import ImagePreload from "@/components/ImagePreload";
import defaultAvatar from "@public/images/df_avatar.jpg";
import { formatMessageTime } from "@/utils";

type Props = {
  results: any[];
  isSearching: boolean;
  hasMore: boolean;
  onReachEnd?: () => void;
  onPick: (hit: any) => void;
  chats: any[];
};

const formatUnread = (n: number) =>
  n > 999 ? "999+" : n > 99 ? "99+" : String(n);

export default function SearchResultsList({
  results,
  isSearching,
  hasMore,
  onReachEnd,
  onPick,
  chats,
}: Props) {
  const [activeHitKey, setActiveHitKey] = useState<string | null>(null);

  const chatIdx = useMemo(
    () => new Map<number, any>(chats.map((c) => [Number(c.id), c])),
    [chats]
  );

  const pickTitle = (hit: any, chat?: any) => {
    const name =
      [hit?.first_name, hit?.last_name].filter(Boolean).join(" ").trim() ||
      hit?.username ||
      hit?.chat?.title ||
      chat?.title;
    return name || `ID ${hit?.chat_id}`;
  };
  const pickAvatar = (hit: any, chat?: any) =>
    hit?.avatar || chat?.avatar || defaultAvatar;

  const rows = useMemo(
    () =>
      results.map((hit) => {
        const chat = chatIdx.get(Number(hit.chat_id));
        const view = {
          id: Number(hit.chat_id),
          title: pickTitle(hit, chat),
          avatar: pickAvatar(hit, chat),
          unread_count: Number(chat?.unread_count) || 0,
          is_pinned: Boolean(chat?.is_pinned),
        };
        return { hit, chat: view };
      }),
    [results, chatIdx]
  );

  // если результаты полностью поменялись — сбросим выделение
  useEffect(() => {
    setActiveHitKey(null);
  }, [results]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || !onReachEnd) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && onReachEnd(),
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onReachEnd, rows.length]);

  if (!rows.length && !isSearching) {
    return <div className="p-4 text-center text-gray-400">Нет результатов</div>;
  }

  return (
    <div className="flex flex-col">
      {rows.map(({ hit, chat }) => {
        const title = chat.title || "Без имени";
        const previewText =
          String(hit.message ?? hit.text ?? "").trim() || "[медиа]";
        const unread = chat.unread_count;
        const isPinned = chat.is_pinned;

        const key = `${chat.id}-${hit.id}`;
        const isActive = activeHitKey === key;

        return (
          <button
            key={key}
            onClick={() => {
              setActiveHitKey(key);
              onPick(hit);
            }}
            className={
              "px-[15px] py-[10px] text-left cursor-pointer flex items-center gap-[12px] " +
              (isActive ? "bg-[#1f2c3a]" : "hover:bg-[#1f2c3a]")
            }
            title="Открыть найденное сообщение"
          >
            <ImagePreload
              width={53}
              height={53}
              src={chat.avatar}
              className="rounded-full w-[53px] h-[53px]"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-white truncate text-[17px]">
                  {title}
                </div>
                {hit.date && (
                  <div
                    className="shrink-0 text-[13px] text-gray-400 leading-none"
                    style={{ fontFeatureSettings: '"tnum" 1' }}
                    title={formatMessageTime(hit.date)}
                  >
                    {formatMessageTime(hit.date)}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div
                  className="min-w-0 text-[15px] overflow-hidden whitespace-nowrap text-gray-400"
                  title={previewText}
                >
                  {previewText}
                </div>

                {unread > 0 ? (
                  <div
                    className="shrink-0 min-w-[20px] h-[20px] px-[6px] rounded-full bg-[#2b5278] text-white text-[12px] font-medium leading-[20px] text-center select-none"
                    title={`${unread} непрочитанных`}
                    aria-label={`${unread} непрочитанных`}
                  >
                    {formatUnread(unread)}
                  </div>
                ) : isPinned ? null : null}
              </div>
            </div>
          </button>
        );
      })}

      {isSearching && (
        <div className="flex flex-col gap-[18px] p-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-[18px] animate-pulse">
              <div className="w-[53px] h-[53px] rounded-full bg-[#1f2c3a]" />
              <div className="flex flex-col gap-[9px] flex-1">
                <div className="w-1/2 h-[18px] bg-[#1f2c3a] rounded" />
                <div className="w-3/4 h-[13px] bg-[#2a3a4a] rounded" />
              </div>
            </div>
          ))}
        </div>
      )}
      {hasMore && <div ref={sentinelRef} />}
    </div>
  );
}
