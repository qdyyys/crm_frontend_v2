import React, { useLayoutEffect, useRef, useState } from "react";

export default function ChatContextMenu({
  ctxMenu,
  ctxMenuRef,
  onSetSignature,
  onSetStatus,
}: {
  ctxMenu: { x: number; y: number; msg: any } | null;
  ctxMenuRef: React.RefObject<HTMLDivElement | null>;
  onSetSignature: (chat: any) => void;
  onSetStatus: (chat: any) => void;
  onMoveToSecondLine: (chat: any) => void;
  showMoveToSecondLine: boolean;
}) {
  if (!ctxMenu) return null;
  const chat = ctxMenu.msg;

  // локальный ref, чтобы измерить размеры
  const localRef = useRef<HTMLDivElement | null>(null);
  const setRef = (el: HTMLDivElement | null) => {
    (localRef as any).current = el;
    if (ctxMenuRef) (ctxMenuRef as any).current = el; // проброс наружу, если нужно
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
          py-1 rounded-lg shadow-xl border border-[#0f1a22] bg-[#0e1621]
          text-sm text-white z-[201]
        "
        style={{ left: pos.left, top: pos.top }}
      >
        <button
          className="block w-full text-left px-3 py-2 hover:bg-[#1f2c3a]"
          onClick={() => onSetSignature(chat)}
        >
          Установить подпись
        </button>

        <button
          className="block w-full text-left px-3 py-2 hover:bg-[#1f2c3a]"
          onClick={() => onSetStatus(chat)}
        >
          Установить статус
        </button>
      </div>
    </div>
  );
}
