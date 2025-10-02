import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatEntity, MessageEntity, WsStatus, AnyMsg } from "../types";
import { wsPath } from "@/lib/backend";

const extractChatId = (m: AnyMsg): number | null => {
  const pick = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 ? n : null;
  };

  const direct =
    pick(m.chat_id) ??
    pick(m.dialog_id) ??
    pick(m?.chat?.id) ??
    pick(m?.peer?.id) ??
    pick(m?.to_chat?.id) ??
    pick(m?.to_user?.id) ??
    pick(m?.to_peer?.id);
  if (direct) return direct;

  const viaPeer = resolvePeerChatId(
    m.peer || m.chat || m.to_peer || m.to_user || m.to_chat || m.from_user
  );
  if (viaPeer) return viaPeer;

  if (m?.from_user?.id != null) return pick(m.from_user.id);

  return null;
};

const resolvePeerChatId = (peer: any): number | null => {
  if (!peer) return null;

  if (typeof peer === "number" && Number.isFinite(peer)) return peer;
  if (typeof peer === "string" && /^\d+$/.test(peer)) return Number(peer);

  if (typeof peer === "object") {
    const candidates = [
      peer?.chat_id,
      peer?.channel_id,
      peer?.user_id,
      peer?.peer_id,
      peer?.id,
      peer?.ChatID,
      peer?.ChannelID,
      peer?.UserID,
      peer?.PeerID,
      peer?.ID,
      peer?.chatId,
      peer?.channelId,
      peer?.userId,
      peer?.peerId,
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n) && n !== 0) return n;
    }

    for (const [k, v] of Object.entries(peer)) {
      const key = k.toLowerCase();
      if (/(user|chat|peer|channel).*id/.test(key) || key === "id") {
        const n = Number(v);
        if (Number.isFinite(n) && n !== 0) return n;
      }
    }
  }

  return null;
};

function cmpMsg(a: any, b: any) {
  const ta = Date.parse(a.date);
  const tb = Date.parse(b.date);
  if (ta !== tb) return ta - tb;
  const ia = Number(a.id) || 0;
  const ib = Number(b.id) || 0;
  return ia - ib;
}

function insertSortedUnique(arr: any[], msg: any) {
  const id = Number(msg.id);
  if (arr.some((m) => Number(m.id) === id)) return arr;
  return [...arr, msg].sort(cmpMsg);
}

function mergeOlderUnique(older: any[], current: any[]) {
  const seen = new Set(current.map((m) => Number(m.id)));
  const onlyNew = older.filter((m) => !seen.has(Number(m.id)));
  return [...onlyNew, ...current].sort(cmpMsg);
}

export function useTelegramSocket(
  telegramAccountId: number | null,
  token: string | null,
  enabled: boolean = true,
  reloadKey: number = 0
) {
  const wsRef = useRef<WebSocket | null>(null);

  const [chats, setChats] = useState<ChatEntity[]>([]);
  const [messages, setMessages] = useState<MessageEntity[]>([]);
  const [selectedChat, _setSelectedChat] = useState<any | null>(null);
  const selectedChatRef = useRef<any | null>(null);

  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<WsStatus>("disconnected");
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const loadingOlderRef = useRef(false);
  const lastLimitRef = useRef(50);

  const sendMessage = (msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const getMessages = (chatId: number | null | undefined, limit = 50) => {
    if (!Number.isFinite(chatId as number)) return;
    lastLimitRef.current = limit;
    sendMessage({ type: "get_messages", data: { chat_id: chatId, limit } });
  };

  const loadOlder = (chatId: number, limit = 50) => {
    if (!Number.isFinite(chatId)) return;
    if (loadingOlderRef.current || !messages.length) return;
    const oldestId = Number(messages[0]?.id);
    if (!oldestId) return;

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    lastLimitRef.current = limit;

    sendMessage({
      type: "get_messages",
      data: { chat_id: chatId, offset_id: oldestId, limit },
    });
  };

  const getChatIdFromChat = (chat: any): number | null => {
    if (!chat) return null;
    const id =
      (typeof chat.id === "number" && chat.id) ||
      (typeof chat.chat_id === "number" && chat.chat_id) ||
      (typeof chat._id === "number" && chat._id) ||
      Number(chat.id);
    return Number.isFinite(id) ? Number(id) : null;
  };

  const [userChannels, setUserChannels] = useState<any[]>([]);
  const [isLoadingUserChannels, setIsLoadingUserChannels] = useState(false);
  const [userChannelsError, setUserChannelsError] = useState<string | null>(
    null
  );

  const requestUserChannels = (userId: number) => {
    if (!Number.isFinite(userId)) return;
    setUserChannelsError(null);
    setIsLoadingUserChannels(true);
    sendMessage({
      type: "get_user_channels",
      data: { user_id: Number(userId) },
    });
  };

  const processDeposit = (payload: {
    user_id: number;
    amount: number;
    bot_id: string;
    channel_id: string;
  }) => {
    sendMessage({ type: "process_deposit", data: payload });
  };

  const translateMessage = (message_id: number | string, text: string) => {
    const mid = Number(message_id);
    if (!Number.isFinite(mid) || !text?.trim()) return;
    sendMessage({
      type: "translate_message",
      data: { text: String(text), message_id: mid },
    });
  };

  useEffect(() => {
    // если выключено — гарантированно закрыть предыдущее соединение и ничего не делать
    if (!enabled) {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore close error */
        }
        wsRef.current = null;
      }
      return;
    }

    if (!telegramAccountId || !token) return;

    setChats([]);
    _setSelectedChat(null);
    selectedChatRef.current = null;
    setMessages([]);
    setAccountRole(null);
    setIsLoadingChats(true);
    setIsLoadingMessages(false);
    setConnectionStatus("disconnected");
    setHasMoreOlder(true);
    setIsLoadingOlder(false);
    loadingOlderRef.current = false;

    const ws = new WebSocket(
      wsPath(
        `/panel/telegram/websocket/${telegramAccountId}`,
        `token=${encodeURIComponent(token)}`
      )
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      ws.send(JSON.stringify({ type: "get_chats" }));
      ws.send(JSON.stringify({ type: "get_account_info" }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "error" || data.type === "connection_error") {
        const msg = String(data.message || "").trim();
        if (msg === "User not found") {
          setIsLoadingUserChannels(false);
          setUserChannels([]);
          setUserChannelsError(msg);
          toast.error(msg);
          return;
        }

        if (msg.includes("FLOOD_WAIT")) {
          const waitMatch = msg.match(/\((\d+)\)/);
          const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 5;
          toast.warning(`Слишком быстро! Подождите ${waitSeconds} сек.`);
          localStorage.setItem(
            "flood_block_until",
            String(Date.now() + waitSeconds * 1000)
          );
        } else {
          toast.error(msg || "Ошибка соединения с Telegram");
        }
        if (loadingOlderRef.current) {
          loadingOlderRef.current = false;
          setIsLoadingOlder(false);
        }
        return;
      }

      switch (data.type) {
        case "chats": {
          console.log(data.data, "ЧАТЫ");
          const raw = data.data?.chats || [];
          const normalized = raw.map((c: any) => ({
            ...c,
            note: (c.note ?? c.notes ?? "") as string,
          }));
          setChats(normalized);
          setIsLoadingChats(false);
          break;
        }

        case "edit_message": {
          console.log("сообщение изменено", data.data);
          const p = data?.data || {};
          const mid = Number(p.id ?? p.message_id);
          if (!Number.isFinite(mid)) break;

          const chatId =
            Number(p.chat_id) ??
            extractChatId(p) ??
            resolvePeerChatId(
              p.peer || p.chat || p.to_peer || p.to_user || p.from_user
            );

          const nextText = typeof p.text === "string" ? p.text : undefined;
          const nextMedia = Array.isArray(p.media) ? p.media : undefined;
          const editedAt = p.edited || p.edit_date || new Date().toISOString();

          // 1) Обновляем сообщение в открытом чате И СБРАСЫВАЕМ кэш перевода
          setMessages((prev: any[]) => {
            let touched = false;
            const next = prev.map((m: any) => {
              if (Number(m.id) !== mid) return m;
              touched = true;
              const updated: any = {
                ...m,
                ...(nextText !== undefined ? { text: nextText } : null),
                ...(nextMedia !== undefined ? { media: nextMedia } : null),
                edited: editedAt,
                is_edited: true,
              };

              // если пришёл новый текст — инвалидируем перевод
              if (nextText !== undefined) {
                updated.original_text = undefined;
                updated.translated_text = undefined;
                updated.showing_original = false;
                updated.translating = false;
              }

              return updated;
            });
            return touched ? next : prev;
          });

          // 2) Обновляем превью в списке чатов (левая панель) + тоже сбрасываем перевод
          setChats((prev: any[]) => {
            const updated = prev.map((c: any) => {
              const isTargetChat = Number.isFinite(chatId)
                ? Number(c.id) === Number(chatId)
                : false;

              const isSameLastMessage = Number(c?.last_message?.id) === mid;
              if (
                !(
                  isTargetChat ||
                  (!Number.isFinite(chatId as number) && isSameLastMessage)
                )
              ) {
                return c;
              }
              if (!isSameLastMessage) return c;

              const lm = c.last_message || {};
              const nextLast: any = {
                ...lm,
                ...(nextText !== undefined ? { text: nextText } : null),
                ...(nextMedia !== undefined ? { media: nextMedia } : null),
                edited: editedAt,
                is_edited: true,
              };

              if (nextText !== undefined) {
                nextLast.original_text = undefined;
                nextLast.translated_text = undefined;
                nextLast.showing_original = false;
                nextLast.translating = false;
              }

              return { ...c, last_message: nextLast };
            });
            return updated;
          });

          // ... остальное без изменений
          break;
        }

        case "account_info":
          setAccountRole(
            data?.data?.role !== null && data?.data?.role !== undefined
              ? String(data.data.role)
              : null
          );
          break;

        case "messages": {
          const payload = data.data || {};
          console.log("Получены сообщения чата:", payload);
          const chatId = Number(payload.chat_id);
          const list = Array.isArray(payload.messages) ? payload.messages : [];
          const normalized = list.slice().sort(cmpMsg);

          const openedId = Number(selectedChatRef.current?.id);

          if (Number.isFinite(openedId) && openedId === chatId) {
            if (loadingOlderRef.current) {
              setMessages((prev) => mergeOlderUnique(normalized, prev));
              setHasMoreOlder(list.length >= (lastLimitRef.current || 50));
              loadingOlderRef.current = false;
              setIsLoadingOlder(false);
            } else {
              setMessages((prev) => {
                if (normalized.length === 0) return prev;
                if (normalized.length === 1 && prev.length > 1) {
                  return insertSortedUnique(prev, normalized[0]);
                }
                return normalized;
              });
              setIsLoadingMessages(false);
              setHasMoreOlder(list.length >= (lastLimitRef.current || 50));
            }

            break;
          }

          setChats((prev) => {
            const next = prev.flatMap((c: any) => {
              if (Number(c.id) !== chatId) return [c];
              if (normalized.length === 0) return [];
              const last = normalized[normalized.length - 1];
              return [{ ...c, last_message: last }];
            });
            return next;
          });

          break;
        }

        case "new_message": {
          const newMsg = data.data;

          const maybeId =
            extractChatId(newMsg) ??
            resolvePeerChatId(
              newMsg.peer ||
                newMsg.chat ||
                newMsg.to_peer ||
                newMsg.to_user ||
                newMsg.from_user
            );

          if (!Number.isFinite(Number(maybeId))) {
            sendMessage({ type: "get_chats" });
            break;
          }

          const cid = Number(maybeId);

          if (Number(selectedChatRef.current?.id) === cid) {
            setMessages((prev) => insertSortedUnique(prev, newMsg));
          }

          setChats((prevChats) => {
            const found = prevChats.find((c: any) => Number(c.id) === cid);
            if (found) {
              const updated = {
                ...found,
                last_message: {
                  id: newMsg.id,
                  date: newMsg.date,
                  text: newMsg.text,
                  from_user: newMsg.from_user,
                },
                unread_count:
                  Number(selectedChatRef.current?.id) === cid ||
                  newMsg.is_outgoing
                    ? found.unread_count
                    : (Number(found.unread_count) || 0) + 1,
              };
              return [
                updated,
                ...prevChats.filter((c: any) => Number(c.id) !== cid),
              ];
            }

            if (newMsg.is_new_dialog) {
              const u = newMsg.from_user ?? {};
              const title =
                newMsg.chat?.title ||
                [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
                u.username ||
                (cid ? `ID ${cid}` : "Без имени");

              const created = {
                id: cid,
                type: newMsg.chat?.type || "private",
                title,
                avatar: newMsg.chat?.avatar || u.avatar || null,
                is_bot: Boolean(u.is_bot),
                is_pinned: false,
                is_premium: Boolean(u.is_premium),
                ttl_period: 0,
                username: u.username || "",
                unread_count: newMsg.is_outgoing ? 0 : 1,
                last_message: {
                  id: newMsg.id,
                  date: newMsg.date,
                  text: newMsg.text,
                  from_user: newMsg.from_user,
                },
              };

              return [created, ...prevChats];
            }

            return prevChats;
          });

          break;
        }

        case "read_history_outbox": {
          const payload = data.data || {};
          const peerId = resolvePeerChatId(payload.peer);
          const maxId = Number(payload.max_id) || 0;

          if (!Number.isFinite(peerId as number) || maxId <= 0) break;

          const peerIdNum = Number(peerId);

          const openedId = Number(selectedChatRef.current?.id);
          if (Number.isFinite(openedId) && openedId === peerIdNum) {
            setMessages((prev) =>
              prev.map((m) => {
                const mid = Number(m.id);
                return m.is_outgoing &&
                  Number.isFinite(mid) &&
                  mid <= maxId &&
                  !m.is_read
                  ? { ...m, is_read: true }
                  : m;
              })
            );
          }

          setChats((prev) =>
            prev.map((c) => {
              const cid = Number(c.id);
              if (!Number.isFinite(cid) || cid !== peerIdNum) return c;
              const lm = c.last_message;
              const lmId = Number(lm?.id);
              if (lm && Number.isFinite(lmId) && lmId <= maxId) {
                return { ...c, last_message: { ...lm, is_read: true } };
              }
              return c;
            })
          );

          break;
        }

        case "messages_read": {
          const payload = data.data || {};
          const chatId = Number(payload.chat_id);
          const ok = payload.success === true;

          if (ok) {
            toast.success("Сообщения прочитаны");
          } else {
            toast.error("Не удалось отметить как прочитанные");
          }

          if (Number.isFinite(chatId)) {
            setChats((prev) =>
              prev.map((c) =>
                Number(c.id) === chatId ? { ...c, unread_count: 0 } : c
              )
            );
          }
          break;
        }

        case "delete_messages": {
          const payload = data?.data || {};

          const raw =
            payload?.delete_messages?.Messages ?? payload?.message_ids ?? [];

          const deletedIds: number[] = (Array.isArray(raw) ? raw : [])
            .map((x: any) => Number(x))
            .filter((n) => Number.isFinite(n));
          if (deletedIds.length === 0) break;

          const deletedSet = new Set(deletedIds);
          const openedId = Number(selectedChatRef.current?.id);

          if (Number.isFinite(openedId)) {
            setMessages((prev) => {
              const left = prev.filter(
                (m: any) => !deletedSet.has(Number(m.id))
              );

              setChats((prevChats) => {
                return prevChats.flatMap((c: any) => {
                  if (Number(c.id) !== openedId) return [c];
                  if (left.length === 0) return [];
                  const newLast = left[left.length - 1];
                  return [{ ...c, last_message: newLast }];
                });
              });

              if (left.length === 0 && selectedChatRef.current) {
                _setSelectedChat(null);
                selectedChatRef.current = null;
                toast.info("Диалог удалён");
              }
              return left;
            });
          }

          setChats((prevChats) => {
            const impacted = new Set<number>();

            for (const c of prevChats) {
              const cid = Number(c?.id);
              const lmId = Number(c?.last_message?.id);
              if (
                Number.isFinite(cid) &&
                cid !== openedId &&
                deletedSet.has(lmId)
              ) {
                impacted.add(cid);
              }
            }

            impacted.forEach((cid) => {
              sendMessage({
                type: "get_messages",
                data: { chat_id: cid, limit: 1 },
              });
            });

            return prevChats.map((c: any) => {
              const cid = Number(c?.id);
              const lmId = Number(c?.last_message?.id);
              if (cid !== openedId && deletedSet.has(lmId)) {
                return { ...c, last_message: null };
              }
              return c;
            });
          });

          break;
        }

        case "read_history_inbox": {
          const p = data.data || {};
          const peerId = resolvePeerChatId(p.peer);
          const still = Number(p.still_unread_count);

          if (Number.isFinite(peerId as number)) {
            setChats((prev) =>
              prev.map((c: any) =>
                Number(c.id) === Number(peerId)
                  ? { ...c, unread_count: Number.isFinite(still) ? still : 0 }
                  : c
              )
            );
          }

          const openedId = Number(selectedChatRef.current?.id);
          if (Number.isFinite(Number(peerId)) && openedId !== Number(peerId)) {
            sendMessage({
              type: "get_messages",
              data: { chat_id: Number(peerId), limit: 1 },
            });
          }
          break;
        }

        case "pinned_messages_update": {
          const payload = data.data || {};
          const chatId = payload.chat_id;
          const ids: number[] = Array.isArray(payload.messages)
            ? payload.messages
            : [];
          const pinned: boolean = !!payload.pinned;

          if (selectedChatRef.current?.id === chatId && ids.length) {
            const idSet = new Set(ids.map((x: any) => Number(x)));
            setMessages((prev) =>
              prev.map((m: any) =>
                idSet.has(Number(m.id)) ? { ...m, is_pinned: pinned } : m
              )
            );
          }
          break;
        }

        case "service_message": {
          const svc = {
            ...(data.data || {}),
            message_type: "service_message" as const,
          };
          const chatId = extractChatId(svc);
          const targetChatId = chatId ?? selectedChatRef.current?.id ?? null;
          if (targetChatId && selectedChatRef.current?.id === targetChatId) {
            setMessages((prev) => insertSortedUnique(prev, svc));
          }
          break;
        }

        case "note_set": {
          const serverNote = (data?.data?.note ?? "").trim();
          const chatId = selectedChatRef.current?.id;

          if (chatId) {
            setChats((prev) =>
              prev.map((c: any) =>
                c.id === chatId
                  ? { ...c, note: serverNote, notes: serverNote }
                  : c
              )
            );
            if (selectedChatRef.current) {
              selectedChatRef.current = {
                ...selectedChatRef.current,
                note: serverNote,
                notes: serverNote,
              };
            }
          }
          break;
        }
        case "transcription":
        case "transcription_ready": {
          const p = data.data || {};
          const chatId =
            Number(p.chat_id) ??
            Number(extractChatId(p)) ??
            Number(resolvePeerChatId(p.peer));
          const mid =
            Number(p.message_id) ?? Number(p.id) ?? Number(p?.message?.id);

          if (
            Number(selectedChatRef.current?.id) === chatId &&
            Number.isFinite(mid)
          ) {
            setMessages((prev) =>
              prev.map((m: any) =>
                Number(m.id) === mid ? { ...m, transcribing: true } : m
              )
            );
          }
          break;
        }

        case "transcription_result": {
          const p = data.data || {};
          const chatId =
            Number(p.chat_id) ??
            Number(extractChatId(p)) ??
            Number(resolvePeerChatId(p.peer));
          const mid =
            Number(p.message_id) ?? Number(p.id) ?? Number(p?.message?.id);
          const text = p?.transcription ?? p?.text ?? p?.result?.text ?? "";

          if (
            Number(selectedChatRef.current?.id) === chatId &&
            Number.isFinite(mid)
          ) {
            setMessages((prev) =>
              prev.map((m: any) =>
                Number(m.id) === mid
                  ? { ...m, transcribing: false, transcription: String(text) }
                  : m
              )
            );
          }
          break;
        }

        case "transcription_error": {
          const p = data.data || {};
          const chatId =
            Number(p.chat_id) ??
            Number(extractChatId(p)) ??
            Number(resolvePeerChatId(p.peer));
          const mid =
            Number(p.message_id) ?? Number(p.id) ?? Number(p?.message?.id);
          const msg = p?.message || "Не удалось получить транскрипцию";

          if (
            Number(selectedChatRef.current?.id) === chatId &&
            Number.isFinite(mid)
          ) {
            setMessages((prev) =>
              prev.map((m: any) =>
                Number(m.id) === mid ? { ...m, transcribing: false } : m
              )
            );
          }
          toast.error(msg);
          break;
        }

        case "user_channels":
        case "get_user_channels_result": {
          const arr = Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.data?.channels)
            ? data.data.channels
            : [];
          setUserChannels(arr);
          setIsLoadingUserChannels(false);
          setUserChannelsError(null);
          break;
        }

        case "process_deposit_result":
        case "deposit_processed": {
          const ok = data?.data?.success !== false;
          const msg =
            (data?.data?.message && String(data.data.message)) ||
            (ok ? "Депозит отправлен" : "Ошибка депозита");
          (ok ? toast.success : toast.error)(msg);
          break;
        }

        case "chat_added_to_second_line": {
          const p = data?.data || {};
          const cid = Number(p.chat_id ?? extractChatId(p));
          const ok =
            (typeof p.status === "string" &&
              p.status.toLowerCase() === "success") ||
            (typeof data.status === "string" &&
              data.status.toLowerCase() === "success");

          if (ok && Number.isFinite(cid)) {
            setChats((prev) => prev.filter((c: any) => Number(c.id) !== cid));

            if (Number(selectedChatRef.current?.id) === cid) {
              _setSelectedChat(null);
              selectedChatRef.current = null;
              setMessages([]);
            }

            toast.success(
              p?.message || data?.message || "Чат переведён на 2 линию"
            );
          } else {
            toast.error(
              p?.message || data?.message || "Не удалось перевести чат"
            );
          }
          break;
        }

        case "translation":
        case "translation_ready":
        case "translation_result":
        case "message_translated": {
          console.log("сообщение переведено", data.data);
          // исходное событие от бэка:
          // { type:"message_translated", message: "<перевод>", data: { message_id: "105" } }

          const p = data.data || {};
          // 1) вытащить перевод из всех возможных мест
          const translated = String(
            data.message ?? // <- ТВОЙ случай
              p.message ?? // иногда кладут внутрь data
              p.translated_text ?? // вариант №3
              p.text ?? // вариант №4
              p.result?.text ?? // вариант №5
              p.translation ?? // вариант №6
              ""
          ).trim();

          // 2) определить message_id
          const mid =
            Number(p.message_id) ?? Number(p.id) ?? Number(p?.message?.id);

          if (!Number.isFinite(mid) || !translated) break;

          // 4) обновляем только если в текущем списке сообщений есть этот id
          // (значит, открыт нужный чат). chatId может быть неизвестен.
          setMessages((prev) => {
            const hasMsg = prev.some((m: any) => Number(m.id) === mid);
            if (!hasMsg) return prev; // не наш открытый чат

            return prev.map((m: any) => {
              if (Number(m.id) !== mid) return m;
              const original = (m as any).original_text ?? m.text ?? "";
              return {
                ...m,
                original_text: original,
                translated_text: translated,
                text: translated,
                showing_original: false,
                translating: false,
              };
            });
          });

          break;
        }

        case "translation_error": {
          const p = data.data || {};
          const chatId =
            Number(p.chat_id) ??
            Number(extractChatId(p)) ??
            Number(resolvePeerChatId(p.peer));
          const mid =
            Number(p.message_id) ?? Number(p.id) ?? Number(p?.message?.id);
          const msg = p?.message || "Не удалось перевести сообщение";

          if (
            Number.isFinite(chatId) &&
            Number(selectedChatRef.current?.id) === Number(chatId) &&
            Number.isFinite(mid)
          ) {
            setMessages((prev) =>
              prev.map((m: any) =>
                Number(m.id) === mid ? { ...m, translating: false } : m
              )
            );
          }
          toast.error(msg);
          break;
        }

        default:
          break;
      }
    };

    ws.onclose = () => setConnectionStatus("disconnected");
    return () => {
      try {
        ws.close();
      } catch {
        /* ignore close error */
      }
    };
  }, [telegramAccountId, token, enabled, reloadKey]);

  const selectChat = (chat: any | null) => {
    _setSelectedChat(chat);
    selectedChatRef.current = chat;

    setMessages([]);
    setHasMoreOlder(true);
    setIsLoadingOlder(false);
    loadingOlderRef.current = false;

    if (!chat) {
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    const id = getChatIdFromChat(chat);
    if (!id) {
      setIsLoadingMessages(false);
      return;
    }
    getMessages(id, 50);
  };

  return {
    wsRef,
    chats,
    messages,
    setMessages,
    accountRole,
    connectionStatus,
    isLoadingChats,
    isLoadingMessages,
    selectedChat,
    setSelectedChat: selectChat,
    selectedChatRef,
    sendMessage,
    getMessages,
    setChats,

    loadOlder,
    isLoadingOlder,
    hasMoreOlder,

    requestUserChannels,
    processDeposit,
    userChannels,
    isLoadingUserChannels,
    userChannelsError,
    translateMessage,
  };
}
