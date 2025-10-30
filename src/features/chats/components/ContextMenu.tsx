import { Copy, Forward, Pin, PinOff, Reply } from "lucide-react";

export default function ContextMenu({
  ctxMenu,
  ctxMenuRef,
  onReply,
  onForward,
  onPin,
  onUnpin,
  onCopy,
}: {
  ctxMenu: { x: number; y: number; msg: any } | null;
  ctxMenuRef: React.RefObject<HTMLDivElement | null>;
  onReply: (m: any) => void;
  onForward: (m: any) => void;
  onPin: (m: any) => void;
  onUnpin: (m: any) => void;
  onCopy: (m: any) => void;
}) {
  if (!ctxMenu) return null;
  return (
    <div className="fixed inset-0 z-[200]">
      <div
        ref={ctxMenuRef}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed min-w-[220px] py-1 rounded-lg shadow-xl border border-[#0f1a22] bg-[#17212b] text-sm text-white z-[201]"
        style={{
          left: Math.min(ctxMenu.x, window.innerWidth - 240),
          top: Math.min(ctxMenu.y, window.innerHeight - 200),
        }}
      >
        <button
          className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
          onClick={() => onReply(ctxMenu.msg)}
        >
          <Reply size={15} />
          Ответить
        </button>

        <button
          className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
          onClick={() => onForward(ctxMenu.msg)}
        >
          <Forward size={15} /> Переслать
        </button>

        {!ctxMenu.msg?.is_pinned && (
          <button
            className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
            onClick={() => onPin(ctxMenu.msg)}
          >
            <Pin size={15} /> Закрепить
          </button>
        )}

        {ctxMenu.msg?.is_pinned && (
          <button
            className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
            onClick={() => onUnpin(ctxMenu.msg)}
          >
            <PinOff size={15} />
            Открепить
          </button>
        )}

        {ctxMenu.msg?.text && (
          <button
            className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
            onClick={() => ctxMenu.msg?.text && onCopy(ctxMenu.msg)}
          >
            <Copy size={15} />
            Копировать текст
          </button>
        )}
      </div>
    </div>
  );
}
