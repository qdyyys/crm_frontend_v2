import clsx from "clsx";

export default function ContextMenu({
  ctxMenu,
  ctxMenuRef,
  onReply,
  onPin,
  onUnpin,
  onCopy,
}: {
  ctxMenu: { x: number; y: number; msg: any } | null;
  ctxMenuRef: React.RefObject<HTMLDivElement | null>;
  onReply: (m: any) => void;
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
        className="fixed min-w-[220px] py-1 rounded-lg shadow-xl border border-[#0f1a22] bg-[#0e1621] text-sm text-white z-[201]"
        style={{
          left: Math.min(ctxMenu.x, window.innerWidth - 240),
          top: Math.min(ctxMenu.y, window.innerHeight - 200),
        }}
      >
        <button
          className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2"
          onClick={() => onReply(ctxMenu.msg)}
        >
          Ответить
        </button>

        {!ctxMenu.msg?.is_pinned && (
          <button
            className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a]"
            onClick={() => onPin(ctxMenu.msg)}
          >
            Закрепить
          </button>
        )}

        {ctxMenu.msg?.is_pinned && (
          <button
            className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a]"
            onClick={() => onUnpin(ctxMenu.msg)}
          >
            Открепить
          </button>
        )}

        {ctxMenu.msg?.text && (
          <button
            className={clsx(
              "w-full text-left px-3 py-2 hover:bg-[#1f2c3a]",
              !ctxMenu.msg?.text && "opacity-50 cursor-default"
            )}
            onClick={() => ctxMenu.msg?.text && onCopy(ctxMenu.msg)}
          >
            Копировать текст
          </button>
        )}
      </div>
    </div>
  );
}
