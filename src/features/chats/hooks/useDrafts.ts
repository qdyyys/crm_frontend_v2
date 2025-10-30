import { useEffect, useRef } from "react";

type SendMessageFn = (payload: any) => void;

export function useDrafts(sendMessage: SendMessageFn) {
  const serverNoteMapRef = useRef<Map<string, string>>(new Map());
  const queuedNoteMapRef = useRef<Map<string, string>>(new Map());
  const timersRef = useRef<Map<string, number>>(new Map());
  const serverSetAtRef = useRef<Map<string, number>>(new Map());

  const getServerNote = (chatId?: number | string) =>
    typeof chatId !== "undefined"
      ? serverNoteMapRef.current.get(String(chatId)) ?? ""
      : "";

  const setServerNote = (chatId: number | string, note: string) => {
    const id = String(chatId);
    const v = (note ?? "").trim();

    serverNoteMapRef.current.set(id, v);
    queuedNoteMapRef.current.set(id, v);

    serverSetAtRef.current.set(id, Date.now());
    const tPrev = timersRef.current.get(id);
    if (tPrev) {
      window.clearTimeout(tPrev);
      timersRef.current.delete(id);
    }
  };

  const debouncedSendNote = (chatId: number | string, text: string) => {
    const id = String(chatId);
    const trimmed = (text ?? "").trim();

    const prevQueued = queuedNoteMapRef.current.get(id) ?? "";
    const prevServer = serverNoteMapRef.current.get(id) ?? "";

    if (trimmed === prevQueued || trimmed === prevServer) return;

    const lastSetAt = serverSetAtRef.current.get(id) ?? 0;
    if (Date.now() - lastSetAt < 250) return;

    const prevTimer = timersRef.current.get(id);
    if (prevTimer) {
      window.clearTimeout(prevTimer);
      timersRef.current.delete(id);
    }

    queuedNoteMapRef.current.set(id, trimmed);

    const t = window.setTimeout(() => {
      const latest = (queuedNoteMapRef.current.get(id) ?? "").trim();
      const server = (serverNoteMapRef.current.get(id) ?? "").trim();

      if (latest === server) {
        timersRef.current.delete(id);
        return;
      }

      sendMessage({
        type: "set_note",
        data: { chat_id: id, note: latest },
      });
      console.log("отправили note");
      timersRef.current.delete(id);
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
