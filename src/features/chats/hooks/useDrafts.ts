// useDrafts.ts
import { useRef, useCallback } from "react";
import debounce from "lodash.debounce";

export function useDrafts(sendMessage: (payload: any) => void) {
  const lastSent = useRef<string>("");

  const debouncedSendNote = useCallback(
    debounce((chatId: string, note: string) => {
      const norm = String(note ?? "");

      // избегаем дублирования, но не блокируем переход от текста → ""
      if (lastSent.current === norm) return;

      sendMessage({
        type: "set_note",
        data: { chat_id: chatId, note: norm },
      });

      lastSent.current = norm;
    }, 400),
    [sendMessage]
  );

  // здесь chatId на самом деле не нужен → убираем
  const setServerNote = (note: string) => {
    lastSent.current = note ?? "";
  };

  const getServerNote = () => lastSent.current;

  return { getServerNote, setServerNote, debouncedSendNote };
}
