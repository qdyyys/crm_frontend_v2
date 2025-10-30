import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatEntity, MessageEntity, WsStatus, AnyMsg } from "../types";
import { wsPath } from "@/lib/backend";

/* ===================== helpers ===================== */

const extractChatId = (m: AnyMsg): number | null => {
  const pick = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 ? n : null;
  };

  const direct =
    pick((m as any).chat_id) ??
    pick((m as any).dialog_id) ??
    pick((m as any)?.chat?.id) ??
    pick((m as any)?.peer?.id) ??
    pick((m as any)?.to_chat?.id) ??
    pick((m as any)?.to_peer?.id) ??
    pick((m as any)?.to_user?.id);
  pick((m as any)?.from_user?.id);
  if (direct) return direct;

  const viaPeer = resolvePeerChatId(
    (m as any).peer ||
      (m as any).chat ||
      (m as any).to_peer ||
      (m as any).to_user ||
      (m as any).from_peer
  );
  if (viaPeer) return viaPeer;

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

function mergeNewerUnique(current: any[], newer: any[]) {
  const seen = new Set(current.map((m) => Number(m.id)));
  const onlyNew = newer.filter((m) => !seen.has(Number(m.id)));
  const merged = [...current, ...onlyNew].sort(cmpMsg);

  return merged;
}

const toId = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/* ===================== hook ===================== */
export function useTelegramSocket(
  telegramAccountId: number | null,
  token: string | null,
  enabled: boolean = true,
  reloadKey: number = 0
) {
  const wsRef = useRef<WebSocket | null>(null);

  const MLOG = {
    on: false,
    log(...a: any[]) {
      if (this.on) console.log("[FETCH]", ...a);
    },
    group(label: string) {
      if (this.on) console.groupCollapsed(`[FETCH] ${label}`);
    },
    end() {
      if (this.on) console.groupEnd();
    },
  };
  const inFlightRef = useRef<{
    chatId: number | null;
    base?: { token: string; limit: number } | null;
    older?: { token: string; offset: number; limit: number } | null;
    newer?: { token: string; offset: number; limit: number } | null;
  }>({ chatId: null, base: null, older: null, newer: null });

  const makeToken = () => Math.random().toString(36).slice(2, 10);

  const HEARTBEAT_INTERVAL_MS = 25_000;
  const HEARTBEAT_AWAIT_MS = 10_000;

  const hbIntervalRef = useRef<number | null>(null);
  const hbTimeoutRef = useRef<number | null>(null);
  const lastTrafficAtRef = useRef<number>(Date.now());

  const logWs = (...a: any[]) => console.log("[WS]", ...a);

  function clearHeartbeat() {
    if (hbIntervalRef.current) {
      clearInterval(hbIntervalRef.current);
      hbIntervalRef.current = null;
    }
    if (hbTimeoutRef.current) {
      clearTimeout(hbTimeoutRef.current);
      hbTimeoutRef.current = null;
    }
  }

  function startHeartbeat() {
    clearHeartbeat();
    hbIntervalRef.current = window.setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {}
      if (hbTimeoutRef.current) clearTimeout(hbTimeoutRef.current);
      hbTimeoutRef.current = window.setTimeout(() => {
        logWs("heartbeat timeout → closing");
        try {
          wsRef.current?.close(4000, "heartbeat-timeout");
        } catch {}
      }, HEARTBEAT_AWAIT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  }

  const [inChatSearchResults, setInChatSearchResults] = useState<any[]>([]);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [inChatHasMore, setInChatHasMore] = useState(false);
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const inChatOffsetRef = useRef<number | null>(null);
  const inChatExpectAppendRef = useRef(false);
  const inChatLatestQueryRef = useRef<string>("");
  const inChatSearchSeqRef = useRef(0);

  const clearSearchInChat = () => {
    setInChatSearchResults([]);
    setInChatSearchQuery("");
    setInChatHasMore(false);
    setIsSearchingInChat(false);
    inChatOffsetRef.current = null;
  };

  const doSearchInChat = (chatId: number, query: string, limit = 50) => {
    const q = (query || "").trim();
    if (!Number.isFinite(chatId) || !q) {
      clearSearchInChat();
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    inChatSearchSeqRef.current += 1;
    const seq = inChatSearchSeqRef.current;
    inChatLatestQueryRef.current = q;
    inChatExpectAppendRef.current = false;

    setIsSearchingInChat(true);
    setInChatSearchQuery(q);
    setInChatSearchResults([]);
    setInChatHasMore(false);
    inChatOffsetRef.current = null;

    wsRef.current.send(
      JSON.stringify({
        type: "search_messages_in_chat",
        data: { chat_id: Number(chatId), query: q, limit, __seq: seq },
      })
    );
  };

  const loadMoreSearchInChat = (chatId: number, limit = 50) => {
    if (!Number.isFinite(chatId)) return;
    if (!inChatHasMore) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    inChatExpectAppendRef.current = true;

    wsRef.current.send(
      JSON.stringify({
        type: "search_messages_in_chat",
        data: {
          chat_id: Number(chatId),
          query: inChatLatestQueryRef.current,
          limit,
          offset_id: inChatOffsetRef.current ?? undefined,
        },
      })
    );
  };

  const dedupById = (arr: any[]) => {
    const seen = new Set<number>();
    const out: any[] = [];
    for (const m of arr) {
      const id = Number(m?.id);
      if (!Number.isFinite(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(m);
    }
    return out;
  };

  const toMs = (d: any) => {
    if (typeof d === "number") return d > 2_000_000_000 ? d : d * 1000;
    const t = Date.parse(d);
    return Number.isFinite(t) ? t : Date.now();
  };

  const [chats, setChats] = useState<ChatEntity[]>([]);
  const chatsRef = useRef<ChatEntity[]>([]);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const [messages, setMessages] = useState<MessageEntity[]>([]);
  //DELETE
  const messagesRef = useRef<MessageEntity[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  //DELETE

  const [selectedChat, _setSelectedChat] = useState<any | null>(null);
  const selectedChatRef = useRef<any | null>(null);

  const [accountRole, setAccountRole] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<WsStatus>("disconnected");
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const [isLoadingNewer, setIsLoadingNewer] = useState(false);
  const loadingNewerRef = useRef(false);

  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [hasMoreNewer, setHasMoreNewer] = useState(true);

  const hasMoreOlderRef = useRef(true);
  const hasMoreNewerRef = useRef(true);
  useEffect(() => {
    hasMoreOlderRef.current = hasMoreOlder;
  }, [hasMoreOlder]);
  useEffect(() => {
    hasMoreNewerRef.current = hasMoreNewer;
  }, [hasMoreNewer]);

  const lastLimitRef = useRef(50);

  const [hasMoreChatsFirst, setHasMoreChatsFirst] = useState(true);
  const [hasMoreChatsSecond, setHasMoreChatsSecond] = useState(true);

  const [isLoadingMoreFirst, setIsLoadingMoreFirst] = useState(false);
  const [isLoadingMoreSecond, setIsLoadingMoreSecond] = useState(false);

  const chatsCursorFirstRef = useRef<{
    next_offset_date?: number;
    next_offset_id?: number;
    last_chat?: number;
    total_count?: number;
    is_last_page?: boolean;
  } | null>(null);

  const chatsCursorSecondRef = useRef<{
    next_offset_date?: number;
    next_offset_id?: number;
    last_chat?: number;
    total_count?: number;
    is_last_page?: boolean;
  } | null>(null);

  const expectingAppendFirstRef = useRef(false);
  const expectingAppendSecondRef = useRef(false);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const searchOffsetRef = useRef<number | null>(null);
  const expectingSearchAppendRef = useRef(false);

  const clearSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchHasMore(false);
    searchOffsetRef.current = null;
    expectingSearchAppendRef.current = false;
  };

  const doSearch = (query: string, limit = 50) => {
    const q = (query || "").trim();
    setSearchQuery(q);
    if (!q) {
      clearSearch();
      return;
    }
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setIsSearching(true);
    setSearchResults([]);
    setSearchHasMore(false);
    searchOffsetRef.current = null;
    expectingSearchAppendRef.current = false;

    wsRef.current.send(
      JSON.stringify({ type: "search", data: { query: q, limit } })
    );
  };

  const loadMoreSearch = (limit = 50) => {
    if (!isSearching || !searchQuery || !searchHasMore) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const offset_id = searchOffsetRef.current;
    if (!offset_id) return;

    expectingSearchAppendRef.current = true;
    wsRef.current.send(
      JSON.stringify({
        type: "search",
        data: { query: searchQuery, offset_id, limit },
      })
    );
  };

  const openSearchHit = (chat_id: number, message_id: number) => {
    _setSelectedChat({ id: chat_id } as any);
    selectedChatRef.current = { id: chat_id } as any;
    setMessages([]);
    setIsLoadingMessages(true);

    wsRef.current?.send?.(
      JSON.stringify({
        type: "get_messages_around",
        data: { chat_id, message_id },
      })
    );

    clearSearch();
  };

  const setMessagesCached = (
    updater: MessageEntity[] | ((prev: MessageEntity[]) => MessageEntity[]),
    extra?: { hasMoreOlder?: boolean }
  ) => {
    setMessages((prev) =>
      typeof updater === "function" ? (updater as any)(prev) : updater
    );
    if (typeof extra?.hasMoreOlder === "boolean") {
      setHasMoreOlder(extra.hasMoreOlder);
    }
  };

  /* ===================== wire ===================== */

  const sendMessage = (msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  const getMessages = (chatId: number | null | undefined, limit = 50) => {
    if (!Number.isFinite(chatId as number)) return;
    lastLimitRef.current = limit;

    const token = makeToken();
    inFlightRef.current.chatId = Number(chatId);
    inFlightRef.current.base = { token, limit };
    inFlightRef.current.older = null;
    inFlightRef.current.newer = null;

    MLOG.group("get_messages:base → send");
    MLOG.log({ chatId, limit, token });
    MLOG.end();

    sendMessage({
      type: "get_messages",
      data: { chat_id: chatId, limit, __token: token, __dir: "base" },
    });
  };

  const loadOlder = (chatId: number, limit = 50) => {
    if (!Number.isFinite(chatId)) return;
    if (loadingOlderRef.current || !messages.length) return;

    const oldestId = Number(messages[0]?.id);
    if (!oldestId) return;

    const token = makeToken();
    inFlightRef.current.older = { token, offset: oldestId, limit };
    setIsLoadingOlder(true);
    loadingOlderRef.current = true;
    lastLimitRef.current = limit;

    MLOG.group("get_messages:older → send");
    MLOG.log({ chatId, offset_id: oldestId, limit, token });
    MLOG.end();

    sendMessage({
      type: "get_messages",
      data: {
        chat_id: chatId,
        offset_id: oldestId,
        limit,
        height: "up",
        __token: token,
        __dir: "older",
      },
    });
  };

  const loadNewer = (chatId: number, limit = 50) => {
    if (!Number.isFinite(chatId)) return;
    if (loadingNewerRef.current || !messages.length) return;

    const newestId = Number(messages[messages.length - 1]?.id);
    if (!newestId) return;

    const token = makeToken();
    inFlightRef.current.newer = { token, offset: newestId, limit };
    setIsLoadingNewer(true);
    loadingNewerRef.current = true;
    lastLimitRef.current = limit;

    MLOG.group("get_messages:newer → send");
    MLOG.log({ chatId, offset_id: newestId, limit, token });
    MLOG.end();

    sendMessage({
      type: "get_messages",
      data: {
        chat_id: chatId,
        offset_id: newestId,
        limit,
        height: "down",
        __token: token,
        __dir: "newer",
      },
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

  const resolveMessageChatId = (msg: any): number | null => {
    const direct =
      extractChatId(msg) ??
      resolvePeerChatId(
        msg?.peer || msg?.chat || msg?.to_peer || msg?.to_user || msg?.from_peer
      );
    if (toId(direct)) return Number(direct);

    const chatsNow = chatsRef.current || [];
    const idSet = new Set<number>(
      chatsNow.map((c: any) => Number(c.id)).filter(Number.isFinite)
    );

    const toUser = toId(msg?.to_user?.id);
    if (toUser != null && idSet.has(toUser)) return toUser;

    const fromUser = toId(msg?.from_user?.id);
    if (fromUser != null && idSet.has(fromUser)) return fromUser;

    const chatObjId = toId(msg?.chat?.id);
    if (chatObjId != null && idSet.has(chatObjId)) return chatObjId;

    return null;
  };

  const normalizeLine = (v: any): "first_line" | "second_line" | undefined => {
    const s = String(v ?? "").toLowerCase();
    if (s === "first" || s === "first_line" || s === "1" || s === "line1")
      return "first_line";
    if (s === "second" || s === "second_line" || s === "2" || s === "line2")
      return "second_line";
    return undefined;
  };

  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
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

    setHasMoreChatsFirst(true);
    setHasMoreChatsSecond(true);
    setIsLoadingMoreFirst(false);
    setIsLoadingMoreSecond(false);
    chatsCursorFirstRef.current = null;
    chatsCursorSecondRef.current = null;
    expectingAppendFirstRef.current = false;
    expectingAppendSecondRef.current = false;

    const ws = new WebSocket(
      wsPath(
        `/panel/telegram/websocket/${telegramAccountId}`,
        `token=${encodeURIComponent(token)}`
      )
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      lastTrafficAtRef.current = Date.now();
      startHeartbeat();
      ws.send(JSON.stringify({ type: "get_chats" }));
      ws.send(JSON.stringify({ type: "get_account_info" }));
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {}
    };

    ws.onmessage = (event) => {
      lastTrafficAtRef.current = Date.now();

      try {
        const maybe = JSON.parse(event.data);
        if (maybe?.type === "pong") {
          if (hbTimeoutRef.current) {
            clearTimeout(hbTimeoutRef.current);
            hbTimeoutRef.current = null;
          }
          logWs("pong");
          return;
        }
      } catch {}
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
        case "status_set": {
          const p = data?.data || {};
          const cid = toId(p.chat_id);
          if (!Number.isFinite(cid as number)) {
            toast.error("Не удалось определить chat_id для обновления статуса");
            break;
          }

          const title = String(p.status ?? "").trim();

          const rawColor =
            typeof p.color === "string" ? String(p.color).trim() : undefined;

          const color =
            rawColor &&
            (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(rawColor) ||
              /^[0-9a-f]{6}$/i.test(rawColor) ||
              /^(rgb|rgba|hsl|hsla)\(/i.test(rawColor) ||
              /^[a-z]+$/i.test(rawColor))
              ? rawColor.length === 6 && /^[0-9a-f]{6}$/i.test(rawColor)
                ? `#${rawColor}`
                : rawColor
              : undefined;

          const lineNorm = normalizeLine(p.line);
          const login = p.login;

          setChats((prev) =>
            prev.map((c: any) =>
              Number(c.id) === Number(cid)
                ? {
                    ...c,
                    status: { title, color },
                    ...(lineNorm ? { line: lineNorm } : {}),
                    ...(login ? { login } : {}),
                  }
                : c
            )
          );

          if (Number(selectedChatRef.current?.id) === Number(cid)) {
            const nextSel = {
              ...selectedChatRef.current,
              status: { title, color },
              ...(lineNorm ? { line: lineNorm } : {}),
              ...(login ? { login } : {}),
            };
            _setSelectedChat(nextSel);
            selectedChatRef.current = nextSel;
          }

          toast.success(data?.message || "Статус обновлён");
          break;
        }

        case "search_messages_in_chat": {
          const payload = data?.data || {};
          const ok =
            String(payload?.status || "success").toLowerCase() === "success";

          const payloadQuery = String(payload?.query ?? "").trim();
          if (payloadQuery && payloadQuery !== inChatLatestQueryRef.current) {
            break;
          }

          const raw: any[] = Array.isArray(payload?.results)
            ? payload.results
            : [];
          const normalized = raw.map((m: any) => ({
            ...m,
            chat_id:
              Number(m?.chat_id) ??
              Number(extractChatId(m)) ??
              Number(resolvePeerChatId(m?.peer || m?.chat)) ??
              Number(selectedChatRef.current?.id) ??
              undefined,
            text: m?.text ?? m?.message ?? "",
            date: toMs(m?.date),
          }));

          if (inChatExpectAppendRef.current) {
            setInChatSearchResults((prev) =>
              dedupById([...prev, ...normalized])
            );
          } else {
            setInChatSearchResults(dedupById(normalized));
          }

          const nextOffset = Number(payload?.next_offset_id);
          inChatOffsetRef.current = Number.isFinite(nextOffset)
            ? nextOffset
            : null;

          const isLast = payload?.is_last_page === true;
          setInChatHasMore(!isLast && normalized.length > 0);

          setIsSearchingInChat(false);
          inChatExpectAppendRef.current = false;

          if (!ok) toast.error(payload?.message || "Ошибка поиска по чату");
          break;
        }

        case "chats": {
          const d = data.data || {};

          const hasTwoBlocks = d.chats_first || d.chats_second;

          if (hasTwoBlocks) {
            const f = d.chats_first || {};
            const s = d.chats_second || {};

            const rawFirst = Array.isArray(f.chats) ? f.chats : [];
            const rawSecond = Array.isArray(s.chats) ? s.chats : [];

            const normalizedFirst = rawFirst.map((c: any) => ({
              ...c,
              note: (c.note ?? c.notes ?? "") as string,
              line: c.line ?? "first_line",
            }));
            const normalizedSecond = rawSecond.map((c: any) => ({
              ...c,
              note: (c.note ?? c.notes ?? "") as string,
              line: c.line ?? "second_line",
            }));

            chatsCursorFirstRef.current = {
              next_offset_date: f.next_offset_date,
              next_offset_id: f.next_offset_id,
              last_chat: f.last_chat,
              total_count: f.total_count,
              is_last_page: f.is_last_page,
            };
            chatsCursorSecondRef.current = {
              next_offset_date: s.next_offset_date,
              next_offset_id: s.next_offset_id,
              last_chat: s.last_chat,
              total_count: s.total_count,
              is_last_page: s.is_last_page,
            };

            const hasMoreFirst =
              Boolean(f.next_offset_id || f.next_offset_date) ||
              (typeof f.is_last_page === "boolean"
                ? !f.is_last_page
                : normalizedFirst.length > 0);

            const hasMoreSecond =
              Boolean(s.next_offset_id || s.next_offset_date) ||
              (typeof s.is_last_page === "boolean"
                ? !s.is_last_page
                : normalizedSecond.length > 0);

            const appendFirst = expectingAppendFirstRef.current;
            const appendSecond = expectingAppendSecondRef.current;

            setHasMoreChatsFirst(hasMoreFirst);
            setHasMoreChatsSecond(hasMoreSecond);

            if (appendFirst) {
              setChats((prev) => {
                const map = new Map<number, any>();
                for (const c of prev) map.set(Number(c.id), c);
                for (const c of normalizedFirst)
                  map.set(Number(c.id), { ...map.get(Number(c.id)), ...c });
                return Array.from(map.values());
              });
              setIsLoadingMoreFirst(false);
              expectingAppendFirstRef.current = false;
            }
            if (appendSecond) {
              setChats((prev) => {
                const map = new Map<number, any>();
                for (const c of prev) map.set(Number(c.id), c);
                for (const c of normalizedSecond)
                  map.set(Number(c.id), { ...map.get(Number(c.id)), ...c });
                return Array.from(map.values());
              });
              setIsLoadingMoreSecond(false);
              expectingAppendSecondRef.current = false;
            }

            if (!appendFirst && !appendSecond) {
              const map = new Map<number, any>();
              for (const c of normalizedFirst) map.set(Number(c.id), c);
              for (const c of normalizedSecond)
                map.set(Number(c.id), { ...map.get(Number(c.id)), ...c });
              setChats(Array.from(map.values()));
              setIsLoadingChats(false);
            }

            break;
          }

          const raw = Array.isArray(d.chats) ? d.chats : [];
          const normalized = raw.map((c: any) => ({
            ...c,
            note: (c.note ?? c.notes ?? "") as string,
          }));

          chatsCursorFirstRef.current = {
            next_offset_date: d.next_offset_date,
            next_offset_id: d.next_offset_id,
            last_chat: d.last_chat,
            total_count: d.total_count,
            is_last_page: d.is_last_page,
          };

          const hasMore =
            Boolean(d.next_offset_id || d.next_offset_date) &&
            normalized.length > 0;

          setHasMoreChatsFirst(hasMore);

          if (expectingAppendFirstRef.current) {
            setChats((prev) => {
              const map = new Map<number, any>();
              for (const c of prev) map.set(Number(c.id), c);
              for (const c of normalized)
                map.set(Number(c.id), { ...map.get(Number(c.id)), ...c });
              return Array.from(map.values());
            });
            setIsLoadingMoreFirst(false);
            expectingAppendFirstRef.current = false;
          } else {
            setChats(normalized);
            setIsLoadingChats(false);
          }
          break;
        }

        case "get_chats_next":
        case "get_chats_second_next": {
          break;
        }

        case "search":
        case "search_chat":
        case "search_result":
        case "search_results": {
          const payload = data.data || {};
          const raw: any[] = Array.isArray(payload.messages)
            ? payload.messages
            : Array.isArray(payload.results)
            ? payload.results
            : Array.isArray(payload)
            ? payload
            : [];

          const normalized = raw
            .map((m) => ({
              ...m,
              chat_id:
                Number(m.chat_id) ||
                Number(extractChatId(m)) ||
                Number(resolvePeerChatId(m.peer || m.chat)) ||
                undefined,
            }))
            .filter((m) => Number.isFinite(m.chat_id));

          setSearchResults((prev) =>
            expectingSearchAppendRef.current
              ? [...prev, ...normalized]
              : normalized
          );

          const last = normalized[normalized.length - 1];
          const lastId = Number(last?.id);
          const nextOffset = Number(payload.next_offset_id);
          searchOffsetRef.current = Number.isFinite(nextOffset)
            ? nextOffset
            : Number.isFinite(lastId)
            ? lastId
            : null;

          const limit =
            Number(payload.limit) ||
            Number(data?.request?.data?.limit) ||
            lastLimitRef.current ||
            50;
          const hasMore =
            typeof payload.is_last_page === "boolean"
              ? !payload.is_last_page
              : Boolean(payload.next_offset_id) || normalized.length >= limit;

          setSearchHasMore(hasMore);
          setIsSearching(false);
          expectingSearchAppendRef.current = false;
          break;
        }

        case "edit_message": {
          const p = data?.data || {};
          const mid = Number(p.id ?? p.message_id);
          if (!Number.isFinite(mid)) break;

          const chatId =
            Number(p.chat_id) ??
            extractChatId(p) ??
            resolvePeerChatId(
              p?.peer || p?.chat || p?.to_peer || p?.to_user || p?.from_user
            );

          const nextText = typeof p.text === "string" ? p.text : undefined;
          const nextMedia = Array.isArray(p.media) ? p.media : undefined;
          const editedAt = p.edited || p.edit_date || new Date().toISOString();

          setMessagesCached((prev: any[]) => {
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
          type Msg = { id: number | string; date: string } & Record<
            string,
            unknown
          >;

          const payload = data.data || {};
          const chatId = Number(payload.chat_id);
          const listRaw: Msg[] = Array.isArray(payload.messages)
            ? (payload.messages as Msg[])
            : [];
          const normalized: Msg[] = listRaw
            .slice()
            .sort(cmpMsg as (a: Msg, b: Msg) => number);

          const openedId = Number(selectedChatRef.current?.id);

          const prevState: Msg[] =
            (messagesRef.current as unknown as Msg[]) || [];
          const prevMinId = Number(prevState[0]?.id);
          const prevMaxId = Number(prevState[prevState.length - 1]?.id);

          const incMinId = Number(normalized[0]?.id);
          const incMaxId = Number(normalized[normalized.length - 1]?.id);

          let dir: "base" | "older" | "newer" | undefined =
            (payload.__dir as "base" | "older" | "newer" | undefined) ||
            undefined;

          const tokenEcho: string | undefined = payload.__token;
          const infl = inFlightRef.current;

          if (!dir && tokenEcho && infl.older?.token === tokenEcho)
            dir = "older";
          if (!dir && tokenEcho && infl.newer?.token === tokenEcho)
            dir = "newer";
          if (!dir && tokenEcho && infl.base?.token === tokenEcho) dir = "base";

          if (!dir && normalized.length && prevState.length) {
            if (
              Number.isFinite(prevMinId) &&
              Number.isFinite(incMaxId) &&
              incMaxId < prevMinId
            ) {
              dir = "older";
            } else if (
              Number.isFinite(prevMaxId) &&
              Number.isFinite(incMinId) &&
              incMinId > prevMaxId
            ) {
              dir = "newer";
            } else {
              dir = "base";
            }
          }

          dir = dir || "base";

          MLOG.group("messages ← recv");
          MLOG.log({
            chatId,
            openedId,
            count: normalized.length,
            flags: {
              is_first_page: payload.is_first_page,
              is_last_page: payload.is_last_page,
            },
            reqEcho: { __token: payload.__token, __dir: payload.__dir },
            resolvedDir: dir,
          });
          MLOG.end();

          if (!Number.isFinite(openedId) || openedId !== chatId) {
            setChats((prev) => {
              if (!normalized.length) return prev;
              const last = normalized[normalized.length - 1];
              return prev.map((c: any) =>
                Number(c.id) === chatId ? { ...c, last_message: last } : c
              );
            });
            break;
          }

          if (
            dir === "older" &&
            infl.older?.token &&
            tokenEcho &&
            infl.older.token !== tokenEcho
          ) {
            MLOG.log("skip outdated older batch by token");
            break;
          }
          if (
            dir === "newer" &&
            infl.newer?.token &&
            tokenEcho &&
            infl.newer.token !== tokenEcho
          ) {
            MLOG.log("skip outdated newer batch by token");
            break;
          }
          if (
            dir === "base" &&
            infl.base?.token &&
            tokenEcho &&
            infl.base.token !== tokenEcho
          ) {
            MLOG.log("skip outdated base batch by token");
            break;
          }

          const limit =
            (dir === "older"
              ? infl.older?.limit
              : dir === "newer"
              ? infl.newer?.limit
              : infl.base?.limit) ??
            (lastLimitRef.current || 50);

          let batch: Msg[] = normalized;
          if (prevState.length && normalized.length) {
            if (dir === "older" && Number.isFinite(prevMinId)) {
              batch = normalized.filter((m: Msg) => Number(m.id) < prevMinId);
            } else if (dir === "newer" && Number.isFinite(prevMaxId)) {
              batch = normalized.filter((m: Msg) => Number(m.id) > prevMaxId);
            }
          }

          if (dir === "older") {
            setMessagesCached((prev) =>
              mergeOlderUnique(batch as any[], prev as any[])
            );
            loadingOlderRef.current = false;
            setIsLoadingOlder(false);

            const hasMoreO =
              typeof payload?.is_last_page === "boolean"
                ? !payload.is_last_page
                : (batch?.length || 0) >= limit;

            setHasMoreOlder(hasMoreO);

            MLOG.log("APPLIED older", {
              received: batch.length,
              limit,
              hasMoreOlder: hasMoreO,
            });
          } else if (dir === "newer") {
            setMessagesCached((prev) =>
              mergeNewerUnique(prev as any[], batch as any[])
            );
            loadingNewerRef.current = false;
            setIsLoadingNewer(false);

            const hasMoreN =
              typeof payload?.is_first_page === "boolean"
                ? !payload.is_first_page
                : (batch?.length || 0) >= limit;

            setHasMoreNewer(hasMoreN);

            MLOG.log("APPLIED newer", {
              received: batch.length,
              limit,
              hasMoreNewer: hasMoreN,
            });
          } else {
            setMessagesCached((_) => (normalized.length ? normalized : []));
            setIsLoadingMessages(false);

            const hasMoreO =
              typeof payload?.is_last_page === "boolean"
                ? !payload.is_last_page
                : Boolean(payload?.next_offset_id) ||
                  normalized.length >= limit;

            const hasMoreN =
              typeof payload?.is_first_page === "boolean"
                ? !payload.is_first_page
                : normalized.length >= limit;

            setHasMoreOlder(hasMoreO);
            setHasMoreNewer(hasMoreN);

            inFlightRef.current.base = null;
            inFlightRef.current.older = null;
            inFlightRef.current.newer = null;

            MLOG.log("APPLIED base", {
              received: normalized.length,
              limit,
              hasMoreOlder: hasMoreO,
              hasMoreNewer: hasMoreN,
            });
          }

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

          const openedId = Number(selectedChatRef.current?.id);
          const cid = Number.isFinite(Number(maybeId))
            ? Number(maybeId)
            : Number.isFinite(openedId)
            ? openedId
            : NaN;

          if (!Number.isFinite(cid)) {
            sendMessage({ type: "get_chats" });
            break;
          }

          const lineNorm = normalizeLine?.(newMsg?.line);
          const enriched = {
            ...newMsg,
            chat_id: cid,
            peer: newMsg.peer ?? { id: cid },
            ...(lineNorm ? { line: lineNorm } : {}),
          };

          if (openedId === cid) {
            setMessages((prev) => insertSortedUnique(prev, enriched));
          }

          setChats((prevChats) => {
            const found = prevChats.find((c: any) => Number(c.id) === cid);
            if (found) {
              const updated = {
                ...found,
                ...(lineNorm && found.line !== lineNorm
                  ? { line: lineNorm }
                  : null),
                last_message: {
                  id: enriched.id,
                  date: enriched.date,
                  text: enriched.text,
                  from_user: enriched.from_user,
                },
                unread_count:
                  openedId === cid || enriched.is_outgoing
                    ? found.unread_count
                    : (Number(found.unread_count) || 0) + 1,
              };
              return [
                updated,
                ...prevChats.filter((c: any) => Number(c.id) !== cid),
              ];
            }

            if (enriched.is_new_dialog) {
              const u = enriched.from_user ?? {};
              const title =
                enriched.chat?.title ||
                [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
                u.username ||
                `ID ${cid}`;

              const created = {
                id: cid,
                type: enriched.chat?.type || "private",
                title,
                avatar: enriched.chat?.avatar || u.avatar || null,
                is_bot: Boolean(u.is_bot),
                is_pinned: false,
                is_premium: Boolean(u.is_premium),
                ttl_period: 0,
                username: u.username || "",
                unread_count: enriched.is_outgoing ? 0 : 1,
                last_message: {
                  id: enriched.id,
                  date: enriched.date,
                  text: enriched.text,
                  from_user: enriched.from_user,
                },
                line: lineNorm ?? "first_line",
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
            setMessagesCached((prev) =>
              prev.map((m) => {
                const mid = Number(m.id);
                return (m as any).is_outgoing &&
                  Number.isFinite(mid) &&
                  mid <= maxId &&
                  !(m as any).is_read
                  ? { ...m, is_read: true }
                  : m;
              })
            );
          }

          setChats((prev) =>
            prev.map((c) => {
              const cid = Number(c.id);
              if (!Number.isFinite(cid) || cid !== peerIdNum) return c;
              const lm = (c as any).last_message;
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
            setMessagesCached((prev) => {
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
              const cid = Number((c as any)?.id);
              const lmId = Number((c as any)?.last_message?.id);
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
            setMessagesCached((prev) =>
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

          const cid = resolveMessageChatId(svc);

          if (Number.isFinite(Number(cid))) {
            if (Number(selectedChatRef.current?.id) === Number(cid)) {
              setMessagesCached((prev) => insertSortedUnique(prev, svc));
            } else {
              sendMessage({
                type: "get_messages",
                data: { chat_id: Number(cid), limit: 1 },
              });
            }
          } else {
            sendMessage({ type: "get_chats" });
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
            setMessagesCached((prev: any[]) =>
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
            setMessagesCached((prev: any[]) =>
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
            setMessagesCached((prev: any[]) =>
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
            setChats((prev) =>
              prev.map((c: any) =>
                Number(c.id) === cid ? { ...c, line: "second" } : c
              )
            );

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
          const p = data.data || {};
          const translated = String(
            data.message ??
              p.message ??
              p.translated_text ??
              p.text ??
              p.result?.text ??
              p.translation ??
              ""
          ).trim();

          const mid =
            Number(p.message_id) ?? Number(p.id) ?? Number(p?.message?.id);

          if (!Number.isFinite(mid) || !translated) break;

          setMessagesCached((prev) => {
            const hasMsg = prev.some((m: any) => Number(m.id) === mid);
            if (!hasMsg) return prev;

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
            setMessagesCached((prev) =>
              prev.map((m: any) =>
                Number(m.id) === mid ? { ...m, translating: false } : m
              )
            );
          }
          toast.error(msg);
          break;
        }

        case "pinned_dialogs_reordered": {
          const arr: Array<{ chat_id: number | string; pos: number }> =
            Array.isArray(data?.data?.chats) ? data.data.chats : [];

          const posMap = new Map<number, number>();
          for (const it of arr) {
            const id = Number(it.chat_id);
            const pos = Number(it.pos);
            if (Number.isFinite(id) && Number.isFinite(pos))
              posMap.set(id, pos);
          }

          if (posMap.size) {
            setChats((prev) =>
              prev.map((c: any) => {
                const pos = posMap.get(Number(c.id));
                if (pos != null) {
                  return { ...c, is_pinned: true, pinned_pos: pos };
                }
                return c;
              })
            );
          }
          break;
        }

        default:
          break;
      }
    };

    ws.onclose = (ev) => {
      setConnectionStatus("disconnected");
      clearHeartbeat();
      logWs("close", {
        code: ev.code,
        reason: ev.reason,
        wasClean: ev.wasClean,
        lastTrafficAgoMs: Date.now() - lastTrafficAtRef.current,
      });
    };

    return () => {
      clearHeartbeat();
      try {
        ws.close(1000, "effect-cleanup");
      } catch {}
    };
  }, [telegramAccountId, token, enabled, reloadKey]);

  type LineKind = "first" | "second";

  const loadMoreChats = (line: LineKind = "first") => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (line === "first") {
      const c = chatsCursorFirstRef.current;
      if (isLoadingMoreFirst || !hasMoreChatsFirst || !c) return;

      expectingAppendFirstRef.current = true;
      setIsLoadingMoreFirst(true);

      ws.send(
        JSON.stringify({
          type: "get_chats_next",
          data: {
            next_offset_date: c.next_offset_date,
            next_offset_id: c.next_offset_id,
            last_chat: c.last_chat,
          },
        })
      );
    } else {
      const c = chatsCursorSecondRef.current;
      if (isLoadingMoreSecond || !hasMoreChatsSecond || !c) return;

      expectingAppendSecondRef.current = true;
      setIsLoadingMoreSecond(true);

      ws.send(
        JSON.stringify({
          type: "get_chats_second_next",
          data: {
            next_offset_date: c?.next_offset_date,
            next_offset_id: c?.next_offset_id,
            last_chat: c?.last_chat,
          },
        })
      );
    }
  };

  const selectChat = (chat: any | null) => {
    _setSelectedChat(chat);
    selectedChatRef.current = chat;

    setIsLoadingOlder(false);
    loadingOlderRef.current = false;

    if (!chat) {
      setMessages([]);
      setHasMoreOlder(true);
      setIsLoadingMessages(false);
      return;
    }

    const id = getChatIdFromChat(chat);
    if (!id) {
      setMessages([]);
      setHasMoreOlder(true);
      setIsLoadingMessages(false);
      return;
    }

    setMessages([]);
    setHasMoreOlder(true);
    setIsLoadingMessages(true);

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

    loadMoreChats,
    hasMoreChatsFirst,
    hasMoreChatsSecond,
    isLoadingMoreFirst,
    isLoadingMoreSecond,

    isSearching,
    searchQuery,
    searchResults,
    searchHasMore,
    doSearch,
    loadMoreSearch,
    openSearchHit,
    clearSearch,

    loadNewer,
    isLoadingNewer,
    hasMoreNewer,

    doSearchInChat,
    loadMoreSearchInChat,
    inChatSearchResults,
    inChatHasMore,
    isSearchingInChat,
    inChatSearchQuery,
    setInChatSearchQuery,
    setInChatSearchResults,
    clearSearchInChat,
  };
}
