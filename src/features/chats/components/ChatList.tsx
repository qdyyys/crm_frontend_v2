import React, { useEffect, useMemo, useRef, useState } from "react";
import ChatListItem from "./ChatListItem";

type CtxArg = React.MouseEvent | { clientX: number; clientY: number };

type Props = {
  chats: any[];
  isLoading: boolean;
  selectedChatId?: number | null;
  onSelect: (chat: any) => void;
  onChatContextMenu?: (eOrPos: CtxArg, chat: any) => void;
  /** вызывается только для закреплённых при DnD */
  onReorderPinned?: (chatId: number, newPos1: number) => void;

  /** догрузка следующей порции при достижении конца списка */
  onReachEnd?: () => void;
  /** есть ли ещё что грузить (устанавливается из сервера через курсор) */
  hasMore?: boolean;
  /** идёт ли сейчас загрузка следующей порции */
  loadingMore?: boolean;
};

export default function ChatList({
  chats,
  isLoading,
  selectedChatId,
  onSelect,
  onChatContextMenu,
  onReorderPinned,
  onReachEnd,
  hasMore = false,
  loadingMore = false,
}: Props) {
  if (isLoading) {
    return (
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
    );
  }

  if (!chats.length) {
    return <div className="p-4 text-center text-gray-400">Чатов пока нет</div>;
  }

  const ts = (c: any) => Date.parse(c?.last_message?.date ?? 0) || 0;

  const { pinned, others } = useMemo(() => {
    const pinned = chats
      .filter((c) => c.is_pinned)
      .slice()
      .sort(
        (a, b) =>
          (a.pinned_pos ?? Number.POSITIVE_INFINITY) -
          (b.pinned_pos ?? Number.POSITIVE_INFINITY)
      );

    const others = chats
      .filter((c) => !c.is_pinned)
      .slice()
      .sort((a: any, b: any) => {
        const au = Number(a.unread_count) > 0 ? 1 : 0;
        const bu = Number(b.unread_count) > 0 ? 1 : 0;
        if (au !== bu) return bu - au;
        return ts(b) - ts(a);
      });

    return { pinned, others };
  }, [chats]);

  const [dragId, setDragId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, chatId: number) => {
    setDragId(chatId);
    e.dataTransfer.setData("text/plain", String(chatId));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOverPinnedItem = (e: React.DragEvent) => {
    if (dragId) e.preventDefault();
  };
  const handleDropOnPinnedItem = (e: React.DragEvent, targetChatId: number) => {
    e.preventDefault();
    const srcId = dragId ?? Number(e.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(srcId)) return;

    const orderedPinned = pinned;
    const srcIdx = orderedPinned.findIndex(
      (c) => Number(c.id) === Number(srcId)
    );
    const dstIdx = orderedPinned.findIndex(
      (c) => Number(c.id) === Number(targetChatId)
    );
    if (srcIdx < 0 || dstIdx < 0 || srcIdx === dstIdx) {
      setDragId(null);
      return;
    }

    const newPos1 = dstIdx + 1;
    onReorderPinned?.(srcId, newPos1);
    setDragId(null);
  };
  const handleDragEnd = () => setDragId(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || !onReachEnd) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (e.isIntersecting && !loadingMore) {
          onReachEnd();
        }
      },
      {
        root: null,
        rootMargin: "200px 0px",
        threshold: 0,
      }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, onReachEnd, loadingMore, chats.length]);

  // -------- render --------
  return (
    <div className="flex flex-col">
      {!!pinned.length && (
        <ul>
          {pinned.map((chat) => {
            const id = Number(chat.id);
            const selected = selectedChatId === chat.id;
            return (
              <li
                key={chat.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, id)}
                onDragOver={handleDragOverPinnedItem}
                onDrop={(e) => handleDropOnPinnedItem(e, id)}
                onDragEnd={handleDragEnd}
                className="cursor-grab active:cursor-grabbing"
              >
                <ChatListItem
                  chat={chat}
                  selected={selected}
                  onClick={() => onSelect(chat)}
                  onContextMenu={(e) => onChatContextMenu?.(e, chat)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <ul>
        {others.map((chat) => (
          <li key={chat.id}>
            <ChatListItem
              chat={chat}
              selected={selectedChatId === chat.id}
              onClick={() => onSelect(chat)}
              onContextMenu={(e) => onChatContextMenu?.(e, chat)}
            />
          </li>
        ))}
      </ul>

      {hasMore && <div ref={sentinelRef} />}
    </div>
  );
}
