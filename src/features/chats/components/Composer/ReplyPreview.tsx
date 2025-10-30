import { Reply, X } from "lucide-react";

export default function ReplyPreview({
  replyTo,
  onClear,
}: {
  replyTo: any | null;
  onClear: () => void;
}) {
  if (!replyTo) return null;
  return (
    <div className="w-full px-3 py-1.5 border-b border-[#101921] bg-[#17212b] flex items-center gap-3 select-none">
      <div className="p-2">
        <Reply size={20} color="#5288c1" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="text-xs text-[#69b2f1] font-[500]">
          В ответ {replyTo.from_user.first_name}
        </div>
        <div className="text-xs text-[#637585] truncate max-w-full">
          {replyTo.text
            ? replyTo.text
            : Array.isArray(replyTo?.media) && replyTo.media.length
            ? "📎 Медиа"
            : replyTo?.media?.url
            ? "📎 Медиа"
            : "Сообщение"}
        </div>
      </div>
      <button
        onClick={onClear}
        className="text-[#737e87] cursor-pointer hover:text-white"
        aria-label="Сбросить ответ"
      >
        <X size={20} />
      </button>
    </div>
  );
}
