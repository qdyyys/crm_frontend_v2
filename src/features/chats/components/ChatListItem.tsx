// ChatListItem.tsx
import React from "react";
import ImagePreload from "@/components/ImagePreload";
import defaultAvatar from "@public/images/df_avatar.jpg";
import { formatMessageTime } from "@/utils";

const formatUnread = (n: number) =>
  n > 999 ? "999+" : n > 99 ? "99+" : String(n);

export default function ChatListItem({
  chat,
  selected,
  onClick,
  onContextMenu,
}: {
  chat: any;
  selected: boolean;
  onClick: () => void;
  onContextMenu?: (
    eOrPos: React.MouseEvent | { clientX: number; clientY: number },
    chat: any
  ) => void;
}) {
  const hasDraft = typeof chat.note === "string" && chat.note.length > 0;
  const previewText = hasDraft
    ? `Черновик: ${chat.note}`
    : chat.last_message?.text;
  const unread = Number(chat.unread_count) || 0;

  const lpTimer = React.useRef<number | null>(null);
  const startLongPress = (e: React.TouchEvent) => {
    if (!onContextMenu) return;
    if (lpTimer.current) window.clearTimeout(lpTimer.current);
    const t = e.touches[0];
    lpTimer.current = window.setTimeout(() => {
      onContextMenu({ clientX: t.clientX, clientY: t.clientY }, chat);
    }, 500);
  };
  const cancelLongPress = () => {
    if (lpTimer.current) {
      window.clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        onContextMenu(e, chat);
      }}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onTouchMove={cancelLongPress}
      className={`px-[15px] py-[10px] cursor-pointer hover:bg-[#1f2c3a] flex items-center gap-[12px] ${
        selected ? "bg-[#1f2c3a]" : ""
      }`}
      role="button"
      aria-label={`Чат ${chat.title || "Без имени"}`}
    >
      <ImagePreload
        width={53}
        height={53}
        src={chat.avatar || defaultAvatar}
        className="rounded-full w-[53px] h-[53px]"
      />

      {/* Контентная колонка: верхняя строка — имя + время; нижняя — превью + бейдж */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-white truncate text-[17px]">
            {chat.title || "Без имени"}
          </div>
          {chat.last_message?.date && (
            <div
              className="shrink-0 text-[13px] text-gray-400 leading-none"
              style={{ fontFeatureSettings: '"tnum" 1' }}
              title={formatMessageTime(chat.last_message.date)}
            >
              {formatMessageTime(chat.last_message.date)}
            </div>
          )}
        </div>

        {hasDraft ? (
          <div className="flex items-center justify-between gap-2">
            <div
              className="min-w-0 text-[15px] overflow-hidden whitespace-nowrap"
              title={`Черновик: ${chat.note}`}
            >
              <span className="text-gray-400">Черновик: </span>
              <span className="text-red-400">{chat.note}</span>
            </div>
            {unread > 0 && (
              <div
                className="shrink-0 min-w-[20px] h-[20px] px-[6px] rounded-full bg-[#2b5278] text-white text-[12px] font-medium leading-[20px] text-center select-none"
                title={`${unread} непрочитанных`}
                aria-label={`${unread} непрочитанных`}
              >
                {formatUnread(unread)}
              </div>
            )}
          </div>
        ) : (
          previewText && (
            <div className="flex items-center justify-between gap-2">
              <div
                className="min-w-0 text-[15px] overflow-hidden whitespace-nowrap text-gray-400"
                title={previewText}
              >
                {previewText}
              </div>
              {unread > 0 && (
                <div
                  className="shrink-0 min-w-[20px] h-[20px] px-[6px] rounded-full bg-blue-400 text-white text-[12px] font-medium leading-[20px] text-center select-none"
                  title={`${unread} непрочитанных`}
                  aria-label={`${unread} непрочитанных`}
                >
                  {formatUnread(unread)}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
