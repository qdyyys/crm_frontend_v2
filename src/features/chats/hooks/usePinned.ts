import { useMemo, useRef, useState, useEffect } from "react";

export function usePinned(messages: any[], selectedChat: any) {
  const msgRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [pinnedIndex, setPinnedIndex] = useState(0);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m?.is_pinned),
    [messages]
  );

  const scrollToMessageById = (id: number) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("msg-highlight");
    setTimeout(() => el.classList.remove("msg-highlight"), 1000);
  };

  useEffect(() => setPinnedIndex(0), [selectedChat, pinnedMessages.length]);

  return {
    msgRefs,
    pinnedMessages,
    pinnedIndex,
    setPinnedIndex,
    scrollToMessageById,
  };
}
