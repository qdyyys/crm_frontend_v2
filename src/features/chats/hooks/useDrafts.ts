import { useEffect, useRef } from "react";

type SendMessageFn = (payload: any) => void;

export function useDrafts(sendMessage: SendMessageFn) {
  const serverNoteMapRef = useRef<Map<string, string>>(new Map());
  const queuedNoteMapRef = useRef<Map<string, string>>(new Map());
  const timersRef = useRef<Map<string, number>>(new Map());

  const getServerNote = (chatId?: number | string) =>
    typeof chatId !== "undefined"
      ? serverNoteMapRef.current.get(String(chatId)) ?? ""
      : "";
  const setServerNote = (chatId: number | string, note: string) => {
    const id = String(chatId);
    const v = (note ?? "").trim();
    serverNoteMapRef.current.set(id, v);
    queuedNoteMapRef.current.set(id, v);
  };

  const debouncedSendNote = (chatId: number | string, text: string) => {
    const id = String(chatId);
    const trimmed = (text ?? "").trim();

    const prevQueued = queuedNoteMapRef.current.get(id) ?? "";
    if (trimmed === prevQueued) return;

    const prevTimer = timersRef.current.get(id);
    if (prevTimer) {
      window.clearTimeout(prevTimer);
      timersRef.current.delete(id);
    }

    queuedNoteMapRef.current.set(id, trimmed);

    const t = window.setTimeout(() => {
      sendMessage({
        type: "set_note",
        data: { chat_id: id, note: trimmed },
      });
    }, 400) as unknown as number;

    timersRef.current.set(id, t);
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  return { getServerNote, setServerNote, debouncedSendNote };
}
