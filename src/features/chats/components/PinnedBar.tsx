import clsx from "clsx";

export default function PinnedBar({
  pinnedMessages,
  pinnedIndex,
  setPinnedIndex,
  onClickShow,
}: {
  pinnedMessages: any[];
  pinnedIndex: number;
  setPinnedIndex: (f: (i: number) => number) => void;
  onClickShow: (id: number) => void;
}) {
  if (pinnedMessages.length === 0) return null;

  const current = pinnedMessages[pinnedIndex];

  return (
    <button
      className="w-full text-left bg-[#1b2734] border-b border-[#101921] cursor-pointer transition relative"
      onClick={() => {
        if (!current) return;
        onClickShow(current.id);
        setPinnedIndex((prev: number) => (prev + 1) % pinnedMessages.length);
      }}
      title="Показать закреплённое сообщение и перейти к следующему"
    >
      <div className="absolute inset-y-2 left-0 flex flex-col items-center justify-center gap-1 pl-2">
        {pinnedMessages.map((_, i) => (
          <span
            key={i}
            className={clsx(
              "w-[2px] rounded-full transition-all duration-300",
              i === pinnedIndex
                ? "h-4 bg-[#4ea4f5] pin-active"
                : "h-4 bg-[#2a3a4a] opacity-60"
            )}
          />
        ))}
      </div>

      <div className="pl-6 pr-4 py-2 flex items-start gap-2">
        <div className="min-w-0">
          <div className="text-blue-400 text-sm font-semibold">
            Закреплённое сообщение #{pinnedIndex + 1}
          </div>
          <div className="text-sm text-gray-300 truncate">
            {current?.text
              ? current.text
              : Array.isArray(current?.media) && current.media.length
              ? "📎 Медиа"
              : current?.media?.url
              ? "📎 Медиа"
              : "Сообщение"}
          </div>
        </div>
      </div>
    </button>
  );
}
