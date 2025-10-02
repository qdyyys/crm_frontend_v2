import { useMemo } from "react";
import ChatListItem from "./ChatListItem";

type CtxArg = React.MouseEvent | { clientX: number; clientY: number };

export default function ChatList({
  chats,
  isLoading,
  selectedChatId,
  onSelect,
  onChatContextMenu,
}: {
  chats: any[];
  isLoading: boolean;
  selectedChatId?: number | null;
  onSelect: (chat: any) => void;
  onChatContextMenu?: (eOrPos: CtxArg, chat: any) => void;
}) {
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

  const sorted = useMemo(() => {
    const ts = (c: any) => Date.parse(c?.last_message?.date ?? 0) || 0;
    return chats.slice().sort((a: any, b: any) => {
      const au = Number(a.unread_count) > 0 ? 1 : 0;
      const bu = Number(b.unread_count) > 0 ? 1 : 0;
      if (au !== bu) return bu - au; // с непрочитанными — выше
      return ts(b) - ts(a); // свежие — выше
    });
  }, [chats]);

  return (
    <>
      {sorted.map((chat) => (
        <ChatListItem
          key={chat.id}
          chat={chat}
          selected={selectedChatId === chat.id}
          onClick={() => onSelect(chat)}
          onContextMenu={(e) => onChatContextMenu?.(e, chat)}
        />
      ))}
    </>
  );
}
