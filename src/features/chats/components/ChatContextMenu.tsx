import { Bolt, FilePen, Pin, PinOff } from "lucide-react";
import React, { useLayoutEffect, useRef, useState } from "react";

export default function ChatContextMenu({
  ctxMenu,
  ctxMenuRef,
  onSetSignature,
  onSetStatus,

  onTogglePin,
}: {
  ctxMenu: { x: number; y: number; msg: any } | null;
  ctxMenuRef: React.RefObject<HTMLDivElement | null>;
  onSetSignature: (chat: any) => void;
  onSetStatus: (chat: any, anchor?: { x: number; y: number }) => void;
  onMoveToSecondLine: (chat: any) => void;
  showMoveToSecondLine: boolean;

  onTogglePin: (chat: any, pin: boolean) => void;
  canEditMeta?: boolean;
}) {
  if (!ctxMenu) return null;
  const chat = ctxMenu.msg;
  const isPinned = Boolean(chat?.is_pinned);

  const localRef = useRef<HTMLDivElement | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    (localRef as any).current = el;
    if (ctxMenuRef) (ctxMenuRef as any).current = el;
  };

  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const el = localRef.current;
    const mw = el?.offsetWidth ?? 240;
    const mh = el?.offsetHeight ?? 160;
    const pad = 8;

    const left = Math.min(Math.max(0, ctxMenu.x), window.innerWidth - mw - pad);
    const top = Math.min(Math.max(0, ctxMenu.y), window.innerHeight - mh - pad);
    setPos({ left, top });
  }, [ctxMenu.x, ctxMenu.y]);

  return (
    <div
      className="fixed inset-0 z-[200]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={setRef}
        className="
          fixed
          w-max min-w-[220px] max-w-[min(320px,calc(100vw-16px))]
          py-1 rounded-lg shadow-xl border border-[#0f1a22] bg-[#17212b]
          text-sm text-white z-[201]
        "
        style={{ left: pos.left, top: pos.top }}
      >
        <button
          className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
          onClick={() => onSetSignature(chat)}
        >
          <FilePen size={15} />
          Установить подпись
        </button>

        <button
          className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
          onClick={() => onTogglePin(chat, !isPinned)}
        >
          {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
          {isPinned ? "Открепить" : "Закрепить"}
        </button>

        <button
          className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
          onClick={(e) => {
            onSetStatus(chat, { x: e.clientX, y: e.clientY });
          }}
        >
          <Bolt size={15} />
          Установить статус
        </button>
      </div>
    </div>
  );
}
