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
    <div className="w-full px-3 py-1 border-b border-[#101921] bg-[#17212b] flex items-center gap-2">
      <Reply className="w-4 h-4 text-blue-400" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-blue-300">Ответ на сообщение</div>
        <div className="text-xs text-gray-300 truncate max-w-full">
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
        className="p-1 rounded hover:bg-[#1f2c3a]"
        aria-label="Сбросить ответ"
      >
        <X className="w-4 h-4 text-gray-300" />
      </button>
    </div>
  );
}
