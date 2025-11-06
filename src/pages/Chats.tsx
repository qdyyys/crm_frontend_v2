import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { toast } from "sonner";
import type { RootState } from "@/store";

import { useTelegramSocket } from "@/features/chats/hooks/useTelegramSocket";
import { useAttachments, fileToDataUrl } from "@/features/utils/useAttachments";
import { usePinned } from "@/features/chats/hooks/usePinned";
import { useCtxMenu } from "@/features/chats/hooks/useCtxMenu";
import { usePasteUpload } from "@/features/chats/hooks/usePasteUpload";
import PinnedBar from "@/features/chats/components/PinnedBar";
import MessageList from "@/features/chats/components/MessageList";
import ContextMenu from "@/features/chats/components/ContextMenu";
import ChatContextMenu from "@/features/chats/components/ChatContextMenu";
import Composer from "@/features/chats/components/Composer/Composer";
import AccountTabs from "@/features/chats/components/AccountTabs";
import ChatList from "@/features/chats/components/ChatList";
import { endWorkRequest } from "@/features/chats/services/panel";
import { useDrafts } from "@/features/chats/hooks/useDrafts";
import { validateObjectId } from "@/features/chats/utils/validateObjectId";
import { fetchMe } from "@/services/authService";
import { useBreakpoint } from "@/features/chats/hooks/useBreakpoint";
import {
  ChevronLeft,
  CheckCheck,
  X,
  Save,
  SquarePen,
  Search,
} from "lucide-react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/axios";
import SearchResultsList from "@/features/chats/components/SearchResultsList";
import ForwardPicker from "@/features/chats/components/ForwardPicker";
import ImagePreload from "@/components/ImagePreload";

const Chats = () => {
  const user = useSelector((state: RootState) => state.user.user);
  useNavigate();

  const canOpenChatCtxMenu = true;

  const token = localStorage.getItem("access_token");
  const dispatch = useDispatch();

  const [searchParams] = useSearchParams();
  const forcedTgParam = searchParams.get("tg");
  const [forcedMode, setForcedMode] = useState(false);

  const isMobile = useBreakpoint("(max-width: 767.98px)");
  const [mobileView, setMobileView] = useState<"list" | "dialog">("list");

  const [ending, setEnding] = useState(false);
  const [starting, setStarting] = useState(false);

  const [activeTgAccount, setActiveTgAccount] = useState<any | null>(null);

  const tgScripts = useMemo(() => {
    return Array.isArray(activeTgAccount?.scripts)
      ? activeTgAccount!.scripts
      : [];
  }, [activeTgAccount]);

  const tgVideos = useMemo(() => {
    return Array.isArray(activeTgAccount?.videos)
      ? activeTgAccount!.videos
      : [];
  }, [activeTgAccount]);

  const telegramAccountId = activeTgAccount?.telegram_id || null;
  const isWorking = Boolean(user?.is_working);

  const [reloadKey, setReloadKey] = useState(0);
  const forceReconnect = () => setReloadKey((k) => k + 1);

  type StatusItem = {
    title: string;
    color?: string;
    line?: string;
    login?: string;
  };

  const [statusMenu, setStatusMenu] = useState<{
    open: boolean;
    anchor?: { x: number; y: number };
    chatId?: number;
    items: StatusItem[];
    loading: boolean;
    error?: string | null;
  }>({ open: false, items: [], loading: false });

  const openStatusMenu = async (
    chat: any,
    anchor?: { x: number; y: number }
  ) => {
    const id = Number(chat?.id ?? chat?.chat_id);
    if (!Number.isFinite(id)) return;

    setStatusMenu({
      open: true,
      chatId: id,
      items: [],
      loading: true,
      anchor,
      error: null,
    });

    try {
      const { data } = await api.get("/panel/accounts/admin/statuses", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw: any[] = Array.isArray(data?.statuses) ? data.statuses : [];
      const map = new Map<string, StatusItem>();
      for (const it of raw) {
        const title = String(it?.status ?? it?.title ?? "").trim();
        if (!title) continue;
        if (!map.has(title))
          map.set(title, {
            title,
            color: it?.color,
            line: it?.line,
            login: it?.login,
          });
      }

      setStatusMenu((st) => ({
        ...st,
        loading: false,
        items: Array.from(map.values()),
      }));
    } catch {
      setStatusMenu((st) => ({
        ...st,
        loading: false,
        error: "Не удалось загрузить статусы",
      }));
      toast.error("Не удалось загрузить статусы");
    }
  };

  const closeStatusMenu = () =>
    setStatusMenu({ open: false, items: [], loading: false, error: null });

  const applyStatus = (item: StatusItem) => {
    const cid = statusMenu.chatId;
    if (!cid) return;

    sendMessage({
      type: "set_status",
      data: { chat_id: cid, status: item.title },
    });

    setChats((prev) =>
      prev.map((c: any) =>
        Number(c.id) === cid
          ? { ...c, status: { title: item.title, color: item.color } }
          : c
      )
    );

    closeStatusMenu();
  };

  const {
    chats,
    messages,
    accountRole,
    isLoadingChats,
    selectedChat,
    setSelectedChat,
    sendMessage,
    setChats,
    loadOlder,
    isLoadingOlder,
    hasMoreOlder,
    setMessages,
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
    clearSearchInChat,
  } = useTelegramSocket(telegramAccountId, token, isWorking, reloadKey);

  const [chatOpenSeq, setChatOpenSeq] = useState(0);

  const { setServerNote, debouncedSendNote } = useDrafts(sendMessage);

  const [openOrigin, setOpenOrigin] = useState<{
    type: "search" | "dialog";
    hit?: any;
    seq?: number;
  } | null>(null);

  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const {
    attachments,
    addFilesAsAttachments,
    setAttachments,
    clearAttachments,
  } = useAttachments();

  const {
    msgRefs,
    pinnedMessages,
    pinnedIndex,
    setPinnedIndex,
    scrollToMessageById,
  } = usePinned(messages, selectedChat);

  const { ctxMenu, setCtxMenu, ctxMenuRef, openCtxMenu } = useCtxMenu();

  const {
    ctxMenu: chatMenu,
    setCtxMenu: setChatMenu,
    ctxMenuRef: chatMenuRef,
    openCtxMenu: openChatMenu,
  } = useCtxMenu();

  const [chatFieldEditor, setChatFieldEditor] = useState<{
    show: boolean;
    chatId: number | null;
    mode: "signature" | null;
    value: string;
  }>({ show: false, chatId: null, mode: null, value: "" });
  const [uiResetKey, setUiResetKey] = useState(0);
  const didOffResetRef = useRef(false);

  const hardResetUI = () => {
    resetComposer();

    setShowVideoPicker(false);
    setScriptState({ show: false, filtered: [], activeIndex: 0 });
    setCtxMenu(null);
    setChatMenu(null);
    setChatFieldEditor({ show: false, chatId: null, mode: null, value: "" });

    setUiResetKey((k) => k + 1);
  };

  const toStatusObj = (s: any): { title: string; color?: string } | null => {
    if (!s) return null;
    if (typeof s === "string") {
      const title = s.trim();
      return title ? { title } : null;
    }
    if (typeof s === "object") {
      const title = String(s.title ?? s.status ?? "").trim();
      const color = s.color ? String(s.color) : undefined;
      return title ? { title, color } : null;
    }
    return null;
  };

  usePasteUpload(addFilesAsAttachments, [attachments.length]);

  useEffect(() => {
    const list = Array.isArray(user?.telegram_accounts)
      ? user!.telegram_accounts
      : [];

    if (!list.length) return;

    if (activeTgAccount || forcedTgParam) return;

    try {
      const saved = localStorage.getItem(SAVED_TG_KEY) || "";
      const found = saved ? findAccountByKey(list, saved) : null;
      if (found) {
        setActiveTgAccount(found);
        return;
      }
    } catch {}

    setActiveTgAccount(list[0]);
  }, [user?.telegram_accounts, activeTgAccount, forcedTgParam]);

  useEffect(() => {
    const list = Array.isArray(user?.telegram_accounts)
      ? user!.telegram_accounts
      : [];

    if (!list.length) {
      if (activeTgAccount) setActiveTgAccount(null);
      try {
        localStorage.removeItem(SAVED_TG_KEY);
      } catch {}
      return;
    }

    if (activeTgAccount && findAccountByKey(list, accKey(activeTgAccount))) {
      return;
    }

    try {
      const saved = localStorage.getItem(SAVED_TG_KEY) || "";
      const found = saved ? findAccountByKey(list, saved) : null;
      if (found) {
        setActiveTgAccount(found);
        return;
      }
    } catch {}

    setActiveTgAccount(list[0]);
  }, [user?.telegram_accounts, activeTgAccount]);

  useEffect(() => {
    if (!isWorking) {
      if (!didOffResetRef.current) {
        setChats([]);
        setSelectedChat(null as any);
        setMessages([]);
        hardResetUI();
        didOffResetRef.current = true;
      }
    } else {
      didOffResetRef.current = false;
    }
  }, [isWorking, setChats, setSelectedChat, setMessages]);

  const startWorkHere = async () => {
    if (!token) {
      toast.error("Нет токена авторизации");
      return;
    }
    try {
      setStarting(true);
      const { data } = await api.post("/panel/accounts/start_work");
      await fetchMe(dispatch as any);
      toast.success(data?.message || "Смена начата");
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      if (status === 400) {
        toast.message(msg || "Смена уже активна");
        await fetchMe(dispatch as any);
      } else if (status === 401) {
        toast.error(msg || "Неавторизован");
      } else {
        toast.error(msg || "Не удалось начать смену");
      }
    } finally {
      setStarting(false);
    }
  };

  const endWork = async () => {
    if (!token) {
      toast.error("Нет токена авторизации");
      return;
    }
    try {
      setEnding(true);
      const data = await endWorkRequest();
      await fetchMe(dispatch as any);
      toast.success(data?.message || "Смена завершена");
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 400)
        toast.warning(data?.message || "Работа не была начата");
      else if (status === 401) {
        toast.error(data?.message || "Неавторизован");
        localStorage.removeItem("access_token");
      } else if (status === 404)
        toast.error(data?.message || "Аккаунт не найден");
      else toast.error(data?.message || "Не удалось завершить работу");
    } finally {
      setEnding(false);
    }
  };

  const handleSwitchAccount = (acc: any) => {
    const curKey = accKey(activeTgAccount);
    const nextKey = accKey(acc);

    if (curKey && nextKey && curKey === nextKey) {
      hardResetUI();
      setChats([]);
      setSelectedChat(null as any);
      setMessages([]);
      forceReconnect();
      return;
    }

    hardResetUI();
    setActiveTgAccount(acc);
    try {
      const key = nextKey;
      if (key) localStorage.setItem(SAVED_TG_KEY, key);
    } catch {}
    setChats([]);
    setSelectedChat(null as any);
    if (isMobile) setMobileView("list");
  };

  const handleSelectChat = (chat: any) => {
    hardResetUI();

    setOpenOrigin({ type: "dialog", seq: Date.now() });
    setSelectedChat(chat ? { ...chat } : chat);

    setChatOpenSeq((s) => s + 1);

    hydratingDraftRef.current = true;
    const serverNote = String(chat?.note ?? "");
    setServerNote(serverNote);

    setMessageText(serverNote);

    if (isMobile) setMobileView("dialog");
  };

  useEffect(() => {
    if (selectedChat?.id) hydratingDraftRef.current = true;
  }, [selectedChat?.id]);

  const pickForwardTarget = (chat: any) => {
    if (!forwardDraft) return;
    const toId = Number(chat?.id);
    if (!Number.isFinite(toId)) return;

    setShowForwardPicker(false);
    if (!selectedChat || Number(selectedChat.id) !== toId) {
      setSelectedChat(chat);
    }

    const srcMsg = messages.find(
      (x: any) => Number(x.id) === Number(forwardDraft.message_id)
    );
    setReplyTo({
      __forward__: true,
      id: forwardDraft.message_id,
      text: srcMsg?.text ?? "",
      from_user: srcMsg?.from_user,
    });

    setForwardDraft((prev) => (prev ? { ...prev, to_chat_id: toId } : prev));
  };

  const normColor = (c?: string) => {
    if (!c) return undefined;
    const s = String(c).trim();

    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
    if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`;
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(s)) return s;
    if (/^[a-z]+$/i.test(s)) return s;

    return undefined;
  };

  useEffect(() => {
    if (!isMobile) setMobileView("list");
  }, [isMobile]);

  useEffect(() => {
    if (!isWorking) return;
    const chatId = selectedChat?.id;
    if (!chatId) return;

    // просто всегда шлём текущее значение — без условий
    debouncedSendNote(String(chatId), messageText ?? "");
  }, [messageText, selectedChat?.id, isWorking]);

  const handleSendUniversal = async (opts?: { pasted?: boolean }) => {
    if (!selectedChat) return;

    const text = messageText.trim();
    const picked = attachments.slice(0, 10);
    const images = picked.filter((a) => a.kind === "image");
    const videos = picked.filter((a) => a.kind === "video");
    const hasText = !!text;
    const hasMedia = picked.length > 0;

    if (!hasText && !hasMedia && !forwardDraft) return;

    try {
      if (forwardDraft?.from_chat_id && forwardDraft?.message_id) {
        const toId = forwardDraft.to_chat_id ?? Number(selectedChat.id);
        sendMessage({
          type: "forward_message",
          data: {
            from_chat_id: Number(forwardDraft.from_chat_id),
            to_chat_id: Number(toId),
            message_ids: [Number(forwardDraft.message_id)],
            dropauthor: Boolean(forwardDraft.dropauthor),
          },
        });
      }

      if (hasText || hasMedia) {
        const photosPayload = images.length
          ? await Promise.all(images.map((a) => fileToDataUrl(a.file)))
          : undefined;
        const videosPayload = videos.length
          ? await Promise.all(videos.map((a) => fileToDataUrl(a.file)))
          : undefined;

        const data: any = {
          chat_id: forwardDraft?.to_chat_id ?? selectedChat.id,
          pasted: Boolean(opts?.pasted),
        };
        if (hasText) data.text = text;
        if (photosPayload?.length) data.photos = photosPayload;
        if (videosPayload?.length) data.videos = videosPayload;

        if (!forwardDraft && replyTo?.id) data.reply_to_id = replyTo.id;

        sendMessage({ type: "send_message", data });
      }

      setTimeout(() => {
        sendMessage({
          type: "set_note",
          data: { chat_id: String(selectedChat.id), note: "" },
        });
      }, 1500);
    } catch (e) {
      toast.error("Не удалось отправить сообщение");
      console.error(e);
      return;
    } finally {
      resetComposer();
      setForwardDraft(null);
      setReplyTo(null);
    }
  };

  const handleSendMessage = (opts?: { pasted?: boolean }) =>
    handleSendUniversal(opts);

  const handleSendVideoNote = (dataUrl: string) => {
    if (!selectedChat) return;
    toast.info("Отправка видео-кружка…");
    sendMessage({
      action: "send_video_note",
      data: {
        chat_id: selectedChat.id,
        video_note: dataUrl,
        ...(replyTo?.id ? { reply_to_id: replyTo.id } : {}),
      },
    });
  };

  const doPin = (m: any) => {
    if (!selectedChat) return;
    sendMessage({
      type: "pin_message",
      data: { chat_id: selectedChat.id, message_id: m.id },
    });
    setCtxMenu(null);
  };
  const doUnpin = (m: any) => {
    if (!selectedChat) return;
    sendMessage({
      type: "pin_message",
      data: { chat_id: selectedChat.id, message_id: m.id, unpin: true },
    });
    setCtxMenu(null);
  };
  const doReply = (m: any) => {
    setReplyTo(m);
    setCtxMenu(null);
  };
  const doCopy = async (m: any) => {
    try {
      if (m?.text) {
        await navigator.clipboard.writeText(String(m.text));
        toast.success("Текст скопирован в буфер обмена.");
      } else toast.info("Нечего копировать");
    } catch {
      toast.error("Не удалось скопировать");
    }
    setCtxMenu(null);
  };
  const doForwardStart = (m: any) => {
    if (!selectedChat?.id || !m?.id) return;
    setForwardDraft({
      from_chat_id: Number(selectedChat.id),
      message_id: Number(m.id),
      dropauthor: true,
    });
    setCtxMenu(null);
    setShowForwardPicker(true);
  };

  const doTranslate = (m: any) => {
    if (!m?.id || !m?.text?.trim()) return;
    setMessages((prev: any[]) =>
      prev.map((x: any) =>
        Number(x.id) === Number(m.id)
          ? {
              ...x,
              translating: true,
              original_text: x.original_text ?? x.text ?? "",
              showing_original: false,
            }
          : x
      )
    );
    translateMessage(m.id, m.text);
  };

  const doToggleOriginal = (m: any) => {
    if (!m?.id) return;
    setMessages((prev: any[]) =>
      prev.map((x: any) => {
        if (Number(x.id) !== Number(m.id)) return x;
        const hasTranslated =
          typeof x.translated_text === "string" && x.translated_text.length > 0;
        if (!hasTranslated) return x;
        const showingOriginal = !!x.showing_original;
        if (showingOriginal) {
          return { ...x, text: x.translated_text, showing_original: false };
        }
        const original = x.original_text ?? x.text ?? "";
        return { ...x, text: original, showing_original: true };
      })
    );
  };

  const markCurrentChatAsRead = () => {
    if (!selectedChat?.id) return;
    sendMessage({ type: "read_messages", data: { chat_id: selectedChat.id } });
    setChats((prev: any[]) =>
      prev.map((c) =>
        c.id === selectedChat.id ? { ...c, unread_count: 0 } : c
      )
    );
  };

  const beginSetSignature = (chat: any) => {
    setChatMenu(null);
    const current = `${chat?.channel_signature ?? ""}`;
    setChatFieldEditor({
      show: true,
      chatId: Number(chat.id),
      mode: "signature",
      value: current,
    });
  };

  const submitChatField = () => {
    const id = chatFieldEditor.chatId;
    const mode = chatFieldEditor.mode;
    const value = (chatFieldEditor.value ?? "").trim();
    if (!id || mode !== "signature") return;

    sendMessage({
      type: "set_channel_signature",
      data: { chat_id: id, channel_signature: value },
    });
    setChats((prev) =>
      prev.map((c: any) =>
        Number(c.id) === Number(id) ? { ...c, channel_signature: value } : c
      )
    );
    setChatFieldEditor({ show: false, chatId: null, mode: null, value: "" });
  };

  const cancelChatField = () =>
    setChatFieldEditor({ show: false, chatId: null, mode: null, value: "" });

  const userForTabs = useMemo(() => {
    if (forcedMode && activeTgAccount) {
      return { ...(user || {}), telegram_accounts: [activeTgAccount] };
    }
    return user;
  }, [forcedMode, activeTgAccount, user]);

  const activeSignature = useMemo(() => {
    const id = selectedChat?.id;
    if (!id) return "";
    const fromList =
      chats.find((c) => Number(c.id) === Number(id))?.channel_signature ?? "";
    const fromSelected = (selectedChat as any)?.channel_signature ?? "";
    const fromEditor =
      chatFieldEditor.show &&
      chatFieldEditor.mode === "signature" &&
      Number(chatFieldEditor.chatId) === Number(id)
        ? chatFieldEditor.value
        : "";
    return `${fromEditor || fromList || fromSelected}`.trim();
  }, [chats, selectedChat, chatFieldEditor]);

  const activeStatus = useMemo(() => {
    const id = selectedChat?.id;
    if (!id) return null;

    const fromList = chats.find((c) => Number(c.id) === Number(id))?.status;
    const fromSelected = (selectedChat as any)?.status;

    return toStatusObj(fromList) ?? toStatusObj(fromSelected);
  }, [chats, selectedChat]);

  const isActiveFirstLine = useMemo(() => {
    const acc: any = activeTgAccount;
    if (!acc) return false;

    const toStr = (v: any) => {
      if (v == null) return "";
      if (typeof v === "string" || typeof v === "number") return String(v);
      if (typeof v === "object")
        return String(v.name ?? v.title ?? v.value ?? v.id ?? "");
      return "";
    };

    if (Array.isArray(acc.lines)) {
      return acc.lines.some((x: any) => {
        const s = toStr(x).trim().toLowerCase();
        return (
          s === "first" || s === "1" || s === "1st" || s.includes("первая")
        );
      });
    }

    const candidates = [
      acc.line,
      acc.support_line,
      acc.queue_line,
      acc.tier,
      acc.stage,
    ];
    for (const c of candidates) {
      const s = toStr(c).trim().toLowerCase();
      if (s === "first" || s === "1" || s === "1st" || s.includes("первая"))
        return true;
    }

    return false;
  }, [activeTgAccount]);

  type LineTab = "first" | "second";

  function shouldShowMoveToSecondLine(
    chat: any,
    isActiveFirstLine: boolean
  ): boolean {
    if (!isActiveFirstLine) return false;
    if (!chat || !chat.line) return false;

    const line = String(chat.line).toLowerCase().trim();
    return line === "first_line";
  }

  const switchLine = (tab: LineTab) => {
    if (tab === lineTab) return;
    hardResetUI();
    setSelectedChat(null as any);
    setMessages([]);
    if (isMobile) setMobileView("list");
    setLineTab(tab);
  };

  const normLine = (v: any): "first" | "second" | null => {
    const s = String(v ?? "")
      .trim()
      .toLowerCase();
    if (!s) return null;

    // точные твои варианты
    if (s === "first_line") return "first";
    if (s === "second_line") return "second";

    // старые / альтернативные
    if (s === "first" || s === "1" || s === "1st" || s.includes("первая"))
      return "first";
    if (s === "second" || s === "2" || s === "2nd" || s.includes("вторая"))
      return "second";

    if (s.startsWith("first")) return "first";
    if (s.startsWith("second")) return "second";

    return null;
  };

  const accHasFirst = useMemo(() => {
    const arr = Array.isArray(activeTgAccount?.lines)
      ? activeTgAccount!.lines
      : [];
    return arr.some((x: any) => normLine(x) === "first");
  }, [activeTgAccount]);

  const accHasSecond = useMemo(() => {
    const arr = Array.isArray(activeTgAccount?.lines)
      ? activeTgAccount!.lines
      : [];
    return arr.some((x: any) => normLine(x) === "second");
  }, [activeTgAccount]);

  const hasBothLines = accHasFirst && accHasSecond;

  const LINE_TAB_KEY = (acc: any) => `chats:lineTab:${accKey(acc)}`;

  const [lineTab, setLineTab] = useState<LineTab>("first");

  useEffect(() => {
    if (!activeTgAccount) return;
    if (!hasBothLines) {
      return;
    }
    try {
      const saved = localStorage.getItem(
        LINE_TAB_KEY(activeTgAccount)
      ) as LineTab | null;
      if (saved === "first" || saved === "second") {
        setLineTab(saved);
      } else {
        setLineTab("first");
      }
    } catch {
      setLineTab("first");
    }
  }, [activeTgAccount, hasBothLines]);

  useEffect(() => {
    if (!activeTgAccount || !hasBothLines) return;
    try {
      localStorage.setItem(LINE_TAB_KEY(activeTgAccount), lineTab);
    } catch {}
  }, [lineTab, activeTgAccount, hasBothLines]);

  const moveChatToSecondLine = (chat: any) => {
    setChatMenu(null);
    const id = Number(chat?.id ?? chat?.chat_id);
    if (!Number.isFinite(id)) return;
    sendMessage({
      type: "add_chat_to_second_line",
      data: { chat_id: String(id) },
    });
  };

  useEffect(() => {
    const q = forcedTgParam?.trim();
    if (!q) {
      setForcedMode(false);
      return;
    }

    const curId = String(
      activeTgAccount?.telegram_id ??
        activeTgAccount?.user_id ??
        activeTgAccount?.id ??
        activeTgAccount?.phone ??
        ""
    );
    if (curId === q) {
      setForcedMode(true);
      return;
    }

    const list = Array.isArray(user?.telegram_accounts)
      ? user!.telegram_accounts
      : [];
    const found = list.find(
      (tg: any) =>
        String(tg?.telegram_id ?? tg?.user_id ?? tg?.id ?? tg?.phone) === q
    );

    setForcedMode(true);
    hardResetUI();
    setActiveTgAccount(found ?? { telegram_id: q });
    setChats([]);
    setSelectedChat(null as any);
    if (isMobile) setMobileView("list");
  }, [forcedTgParam, user?.telegram_accounts]);

  useEffect(() => {
    if (isMobile && mobileView === "dialog" && !selectedChat) {
      setMobileView("list");
    }
  }, [isMobile, mobileView, selectedChat]);

  const resetComposer = () => {
    setMessageText("");
    setReplyTo(null);
    setForwardDraft(null);
    setScriptState({ show: false, filtered: [], activeIndex: 0 });
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });

    setShowVideoPicker(false);

    setUiResetKey((k) => k + 1);
  };

  const handleSendSavedVideo = (videoMongoId: string) => {
    if (!selectedChat) return;

    if (!validateObjectId(videoMongoId)) {
      toast.error("Неверный формат ID видео (ожидается ObjectID)");
      return;
    }

    const data: any = {
      chat_id: selectedChat.id,
      video_id: videoMongoId,
      ...(replyTo?.id ? { reply_to_id: replyTo.id } : {}),
    };

    sendMessage({ type: "send_video", data });
    setShowVideoPicker(false);
    setCtxMenu(null);
    resetComposer();
  };

  const [scriptState, setScriptState] = useState({
    show: false,
    filtered: [] as any[],
    activeIndex: 0,
  });
  const [showVideoPicker, setShowVideoPicker] = useState(false);

  const editorPlaceholder = "Подпись канала";

  const requestTranscription = (messageId: number | string) => {
    if (!selectedChat?.id) return;
    if (!activeTgAccount?.is_premium) return;

    setMessages((prev: any[]) =>
      prev.map((m: any) =>
        Number(m.id) === Number(messageId) ? { ...m, transcribing: true } : m
      )
    );

    sendMessage({
      type: "get_transcription",
      data: { chat_id: selectedChat.id, message_id: Number(messageId) },
    });
  };

  const onMoveSelectedChatToSecondLine = () => {
    if (!selectedChat) return;

    moveChatToSecondLine(selectedChat);

    const movedId = Number(selectedChat.id);
    setChats((prev) =>
      prev.map((c: any) =>
        Number(c.id) === movedId ? { ...c, line: "second" } : c
      )
    );

    if (hasBothLines) {
      if (lineTab === "first") {
        switchLine("second");
      }
    } else {
      setSelectedChat(null as any);
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!activeTgAccount) return;

    if (hasBothLines) {
      return;
    }

    const desired: "first" | "second" =
      accHasFirst && !accHasSecond
        ? "first"
        : !accHasFirst && accHasSecond
        ? "second"
        : "first";

    if (lineTab !== desired) {
      hardResetUI();
      setSelectedChat(null as any);
      setMessages([]);
      if (isMobile) setMobileView("list");
      setLineTab(desired);
    }
  }, [activeTgAccount, accHasFirst, accHasSecond, hasBothLines]);

  const SAVED_TG_KEY = "chats:lastTgAccountId";

  const accKey = (acc: any) =>
    String(
      acc?.telegram_id ??
        acc?.user_id ??
        acc?.id ??
        acc?.phone ??
        acc?.username ??
        ""
    );

  const findAccountByKey = (list: any[], key: string) =>
    list.find((a) => accKey(a) === key);

  const filteredChats = useMemo(() => {
    const lineOf = (v: any): "first" | "second" | null => {
      const s = String(v ?? "").toLowerCase();
      if (
        s.includes("first") ||
        s === "1" ||
        s === "1st" ||
        s.includes("первая")
      )
        return "first";
      if (
        s.includes("second") ||
        s === "2" ||
        s === "2nd" ||
        s.includes("вторая")
      )
        return "second";
      return null;
    };
    return chats.filter((c: any) => {
      const l = lineOf(c?.line);
      if (!l) return true;
      return l === lineTab;
    });
  }, [chats, lineTab]);

  const orderedChats = useMemo(() => {
    const pinned = filteredChats
      .filter((c: any) => c.is_pinned)
      .sort((a: any, b: any) => (a.pinned_pos ?? 1e9) - (b.pinned_pos ?? 1e9));

    const others = filteredChats.filter((c: any) => !c.is_pinned);

    return [...pinned, ...others];
  }, [filteredChats]);

  const togglePinChat = (chat: any, pin: boolean) => {
    const id = Number(chat?.id ?? chat?.chat_id);
    if (!Number.isFinite(id)) return;

    setChats((prev) => {
      const pinned = prev
        .filter((c: any) => c.is_pinned)
        .sort(
          (a: any, b: any) => (a.pinned_pos ?? 1e9) - (b.pinned_pos ?? 1e9)
        );
      let next = prev.map((c: any) => {
        if (Number(c.id) !== id) return c;
        if (pin) {
          const newPos = (pinned[pinned.length - 1]?.pinned_pos ?? 0) + 1;
          return { ...c, is_pinned: true, pinned_pos: newPos };
        }
        return { ...c, is_pinned: false, pinned_pos: undefined };
      });

      const pinnedNow = next
        .filter((c: any) => c.is_pinned)
        .sort((a: any, b: any) => (a.pinned_pos ?? 1e9) - (b.pinned_pos ?? 1e9))
        .map((c: any, i: number) => ({ ...c, pinned_pos: i + 1 }));

      const nonPinned = next.filter((c: any) => !c.is_pinned);
      return [...pinnedNow, ...nonPinned];
    });

    sendMessage({
      type: "pin_chat",
      data: { chat_id: id, pin: Boolean(pin) },
    });

    setChatMenu(null);
  };

  const movePinnedChat = (chatId: number, newPos1: number) => {
    setChats((prev) => {
      const pinned = prev.filter((c: any) => c.is_pinned);
      const others = prev.filter((c: any) => !c.is_pinned);

      const ordered = pinned
        .slice()
        .sort(
          (a: any, b: any) => (a.pinned_pos ?? 1e9) - (b.pinned_pos ?? 1e9)
        );

      const idx = ordered.findIndex(
        (c: any) => Number(c.id) === Number(chatId)
      );
      if (idx === -1) return prev;

      const [item] = ordered.splice(idx, 1);
      ordered.splice(Math.max(0, newPos1 - 1), 0, item);

      const normalized = ordered.map((c: any, i: number) => ({
        ...c,
        pinned_pos: i + 1,
        is_pinned: true,
      }));

      return [...normalized, ...others];
    });

    sendMessage({
      type: "move_pinned_chat",
      data: { chat_id: chatId, new_position: newPos1 },
    });
  };

  const currentPagingLine: "first" | "second" = useMemo(() => {
    if (hasBothLines) return lineTab;
    if (accHasFirst && !accHasSecond) return "first";
    if (!accHasFirst && accHasSecond) return "second";
    return "first";
  }, [hasBothLines, lineTab, accHasFirst, accHasSecond]);

  const hasMoreForUI =
    currentPagingLine === "first" ? hasMoreChatsFirst : hasMoreChatsSecond;
  const loadingMoreForUI =
    currentPagingLine === "first" ? isLoadingMoreFirst : isLoadingMoreSecond;
  const onReachEndForUI = () => loadMoreChats(currentPagingLine);

  const [forwardDraft, setForwardDraft] = useState<{
    from_chat_id: number;
    message_id: number;
    to_chat_id?: number;
    dropauthor?: boolean;
  } | null>(null);

  const [showForwardPicker, setShowForwardPicker] = useState(false);

  const [localSearch, setLocalSearch] = useState("");
  const searchDebRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const hydratingDraftRef = useRef(false);

  useEffect(() => {
    if (!searchQuery) setLocalSearch("");
  }, [searchQuery]);

  const scheduleSearch = (q: string) => {
    if (searchDebRef.current) window.clearTimeout(searchDebRef.current);
    searchDebRef.current = window.setTimeout(() => {
      const trimmed = q.trim();
      if (trimmed) {
        doSearch(trimmed);
      } else {
        clearSearch();
      }
    }, 250);
  };

  const clearSearchAll = () => {
    if (searchDebRef.current) window.clearTimeout(searchDebRef.current);
    setLocalSearch("");
    clearSearch();
    searchInputRef.current?.focus();
  };

  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatLocalQuery, setInChatLocalQuery] = useState("");

  const prevChatIdRef = useRef<number | string | null>(null);

  useEffect(() => {
    const curId = selectedChat?.id ?? null;
    if (!curId) return;

    if (prevChatIdRef.current === curId) return;
    prevChatIdRef.current = curId;

    setShowInChatSearch(false);
    setInChatLocalQuery("");
    clearSearchInChat();
  }, [selectedChat?.id, clearSearchInChat]);

  const canEditChatMeta = useMemo(() => {
    const roles: string[] = [
      ...(Array.isArray(user?.perms) ? user!.perms : []),
      accountRole ?? "",
    ].map((r) => String(r).toLowerCase());

    return roles.includes("chief_admin") || roles.includes("admin");
  }, [user?.perms, accountRole]);

  const getDisplayName = (m: any) => {
    const u = m?.from_user ?? m?.user ?? null;
    if (!u) return "";
    const first = String(u.first_name ?? "").trim();
    const last = String(u.last_name ?? "").trim();
    const username = String(u.username ?? "").trim();
    const name = [first, last].filter(Boolean).join(" ").trim();
    return (name || username || "").trim();
  };

  const getAvatarUrl = (m: any) => {
    const u = m?.from_user ?? m?.user ?? null;
    const ava = u?.avatar ?? null;
    return typeof ava === "string" && ava.trim() ? ava : null;
  };
  const formatShortDate = (d: any) => {
    if (d == null) return "";
    let ms: number;
    if (typeof d === "number") {
      ms = d > 2_000_000_000 ? d : d * 1000;
    } else {
      const t = Date.parse(String(d));
      ms = Number.isFinite(t) ? t : Date.now();
    }
    const dt = new Date(ms);
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const getMsgText = (m: any) =>
    String(m?.text ?? m?.message ?? m?.caption ?? "").trim();

  return (
    <main className="h-full">
      <section className="flex flex-col h-full relative">
        <AccountTabs
          user={userForTabs}
          activeTgAccount={activeTgAccount}
          onSwitch={handleSwitchAccount}
          onEndWork={endWork}
          ending={ending}
          accountRole={accountRole}
        />

        {isWorking &&
          (!isMobile ? (
            <PanelGroup
              direction="horizontal"
              className="flex-1 min-h-0 outline-none"
            >
              <Panel
                defaultSize={30}
                minSize={20}
                maxSize={60}
                className="bg-[#17212b] min-h-0 flex flex-col"
              >
                <div className="shrink-0">
                  {hasBothLines && (
                    <div className="px-2 pt-1 pb-1">
                      <div
                        role="tablist"
                        aria-label="Линия"
                        className="relative w-full rounded-xl border border-[#223140] bg-[#242f3d] backdrop-blur
                     px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
                      >
                        <div
                          className="
              pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)]
              rounded-lg bg-gradient-to-b from-[#214469] to-[#2b5278]
              shadow-[0_6px_16px_rgba(15,23,34,.6),inset_0_1px_0_rgba(255,255,255,.06)]
              transition-transform duration-300 will-change-transform
            "
                          style={{
                            transform:
                              lineTab === "first"
                                ? "translateX(0)"
                                : "translateX(calc(100%))",
                          }}
                          aria-hidden
                        />
                        <div className="grid grid-cols-2 gap-2 relative z-10">
                          <button
                            role="tab"
                            aria-selected={lineTab === "first"}
                            onClick={() => switchLine("first")}
                            className={`focus-visi
                h-8 rounded-md text-sm font-medium transition-colors w-full cursor-pointer
                focus:outline-none ble:ring-2 focus-visible:ring-[#4da3ff]
                ${
                  lineTab === "first"
                    ? "text-white"
                    : "text-white/70 hover:text-white"
                }
              `}
                          >
                            1 линия
                          </button>
                          <button
                            role="tab"
                            aria-selected={lineTab === "second"}
                            onClick={() => switchLine("second")}
                            className={`
                h-8 rounded-md text-sm font-medium transition-colors w-full cursor-pointer
                focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]
                ${
                  lineTab === "second"
                    ? "text-white"
                    : "text-white/70 hover:text-white"
                }
              `}
                          >
                            2 линия
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {chatFieldEditor.show && (
                    <div className="p-2 pb-1 pt-1 flex gap-1">
                      <input
                        className="w-full outline-none bg-[#242f3d] px-4 py-2 rounded-full placeholder:text-[#6c7f94] text-sm"
                        placeholder={editorPlaceholder}
                        value={chatFieldEditor.value}
                        onChange={(e) =>
                          setChatFieldEditor((s) => ({
                            ...s,
                            value: e.target.value,
                          }))
                        }
                        autoFocus
                      />
                      <button
                        onClick={submitChatField}
                        className="cursor-pointer bg-[#242f3d] px-2 rounded-full hover:opacity-[0.7] transition-opacity"
                      >
                        <Save size={17} />
                      </button>
                      <button
                        onClick={cancelChatField}
                        className="cursor-pointer bg-[#242f3d] px-2 rounded-full hover:opacity-[0.7] transition-opacity"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )}

                  <div className="px-2 pt-1 pb-2">
                    <div className="relative">
                      <input
                        ref={searchInputRef}
                        className="w-full outline-none bg-[#242f3d] px-4 py-2 rounded-full placeholder:text-[#6c7f94] text-sm"
                        placeholder="Поиск"
                        value={localSearch}
                        onChange={(e) => {
                          const q = e.target.value;
                          setLocalSearch(q);
                          scheduleSearch(q);
                        }}
                      />
                      {!!searchQuery && (
                        <button
                          onClick={() => {
                            clearSearchAll();
                          }}
                          className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                          aria-label="Очистить поиск"
                          title="Очистить"
                        >
                          <X
                            size={16}
                            className="text-[#6c7883] hover:text-white"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto tg-scroll ">
                  {searchQuery ? (
                    <SearchResultsList
                      results={searchResults}
                      isSearching={isSearching}
                      hasMore={searchHasMore}
                      onReachEnd={() => loadMoreSearch(50)}
                      onPick={(hit) => {
                        setOpenOrigin({ type: "search", hit, seq: Date.now() });
                        openSearchHit(Number(hit.chat_id), Number(hit.id));
                      }}
                      chats={orderedChats}
                    />
                  ) : (
                    <ChatList
                      chats={orderedChats}
                      isLoading={isLoadingChats}
                      selectedChatId={selectedChat?.id}
                      onSelect={handleSelectChat}
                      onChatContextMenu={
                        canOpenChatCtxMenu
                          ? (eOrPos, chat) => openChatMenu(eOrPos as any, chat)
                          : undefined
                      }
                      onReorderPinned={(dragId, newPos1) =>
                        movePinnedChat(dragId, newPos1)
                      }
                      onReachEnd={onReachEndForUI}
                      hasMore={hasMoreForUI}
                      loadingMore={loadingMoreForUI}
                    />
                  )}
                </div>

                <ForwardPicker
                  open={showForwardPicker}
                  chats={chats}
                  onPick={pickForwardTarget}
                  onClose={() => {
                    setShowForwardPicker(false);
                    if (!forwardDraft?.to_chat_id) setForwardDraft(null);
                  }}
                  dropAuthor={!!forwardDraft?.dropauthor}
                  onToggleDropAuthor={(v) =>
                    setForwardDraft((prev) =>
                      prev ? { ...prev, dropauthor: v } : prev
                    )
                  }
                  loadMoreChats={loadMoreChats}
                  hasMoreChatsFirst={hasMoreChatsFirst}
                  hasMoreChatsSecond={hasMoreChatsSecond}
                  isLoadingMoreFirst={isLoadingMoreFirst}
                  isLoadingMoreSecond={isLoadingMoreSecond}
                />
              </Panel>

              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-[#2b5278] transition-all cursor-col-resize" />

              <Panel className="bg-[#0e1621] flex flex-col min-h-0">
                {selectedChat ? (
                  <>
                    {/* Шапка + слой результатов поиска под ней */}
                    <div className="relative">
                      <div className="py-2 px-4 bg-[#17212b] flex items-center gap-2">
                        {!showInChatSearch ? (
                          <>
                            <h2 className="text-lg font-bold truncate flex-1">
                              {selectedChat.title ||
                                selectedChat.last_message?.from_user
                                  ?.first_name}
                            </h2>

                            <button
                              onClick={() => {
                                setShowInChatSearch(true);
                              }}
                              className="shrink-0 p-2 rounded-full hover:bg-[#1f2c3a] active:bg-[#1a2633] cursor-pointer"
                              title="Поиск по чату"
                              aria-label="Поиск по чату"
                            >
                              <Search size={16} />
                            </button>

                            {activeSignature && (
                              <span
                                className="ml-2 shrink-0 max-w-[45%] inline-flex items-center gap-2 py-[2.5px] px-[11px] rounded-full bg-[#1b2836] text-[12px] text-[#9ec1ff] border border-[#2b5278]/50 truncate"
                                title={`Подпись: ${activeSignature}`}
                              >
                                <span className="opacity-70">
                                  <SquarePen size={14} />
                                </span>
                                <span className="font-medium truncate">
                                  {activeSignature}
                                </span>
                              </span>
                            )}
                            {activeStatus && (
                              <span
                                className="ml-2 shrink-0 max-w-[45%] inline-flex items-center gap-2 py-[2.5px] px-[11px] rounded-full bg-[#1b2836] text-[12px] border border-[#2b5278]/50 truncate"
                                title={`Статус: ${activeStatus.title}`}
                              >
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      normColor(activeStatus.color) ||
                                      "#2b7852",
                                  }}
                                  aria-hidden
                                />
                                <span className="font-medium truncate">
                                  {activeStatus.title}
                                </span>
                              </span>
                            )}

                            <button
                              onClick={markCurrentChatAsRead}
                              className="shrink-0 p-2 rounded-full hover:bg-[#1f2c3a] active:bg-[#1a2633] cursor-pointer"
                              title="Отметить входящие как прочитанные"
                              aria-label="Отметить входящие как прочитанные"
                            >
                              <CheckCheck size={16} className="text-white/90" />
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              className="w-full outline-none bg-[#242f3d] px-4 py-2 rounded-full placeholder:text-[#6c7f94] text-sm"
                              placeholder="Поиск"
                              value={inChatLocalQuery}
                              onChange={(e) => {
                                const q = e.target.value;
                                setInChatLocalQuery(q);
                                if (q.trim()) {
                                  doSearchInChat(
                                    Number(selectedChat.id),
                                    q.trim()
                                  );
                                } else {
                                  clearSearchInChat();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  setInChatLocalQuery("");
                                  clearSearchInChat();
                                  setShowInChatSearch(false);
                                }
                              }}
                              autoFocus
                            />

                            <button
                              onClick={() => {
                                setInChatLocalQuery("");
                                clearSearchInChat();
                                setShowInChatSearch(false);
                              }}
                              className="absolute top-1/2 right-7 -translate-y-1/2 cursor-pointer"
                              aria-label="Очистить и закрыть поиск"
                              title="Очистить и закрыть"
                            >
                              <X
                                size={16}
                                className="text-[#6c7883] hover:text-white"
                              />
                            </button>
                          </div>
                        )}
                      </div>

                      {showInChatSearch &&
                        inChatLocalQuery.trim().length > 0 && (
                          <div
                            className="absolute left-4 right-4 top-[105%] z-20 max-h-[50vh] overflow-y-auto tg-scroll rounded-xl border border-[#223140] bg-[#17212b] p-1.5"
                            role="listbox"
                            aria-label="Результаты поиска по чату"
                          >
                            {isSearchingInChat && (
                              <div className="px-3 py-2 text-sm text-white/70">
                                Поиск…
                              </div>
                            )}

                            {!isSearchingInChat &&
                              inChatSearchResults.length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-400">
                                  Нет результатов
                                </div>
                              )}

                            {inChatSearchResults.map((m) => {
                              const name = getDisplayName(m);
                              const ava = getAvatarUrl(m);
                              const msg = getMsgText(m);
                              const when = formatShortDate(m?.date);

                              return (
                                <button
                                  key={m.id}
                                  onClick={() => {
                                    setOpenOrigin({
                                      type: "search",
                                      hit: m,
                                      seq: Date.now(),
                                    });
                                    openSearchHit(
                                      Number(selectedChat.id),
                                      Number(m.id)
                                    );
                                    setShowInChatSearch(false);
                                    setInChatLocalQuery("");
                                    clearSearchInChat();
                                  }}
                                  className="w-full text-left block px-3 py-2 hover:bg-[#1f2c3a] focus:bg-[#1f2c3a] cursor-pointer rounded-xl"
                                >
                                  <div className="flex items-center gap-3">
                                    {/* Аватар — показываем только если пришёл непустой url */}
                                    {ava ? (
                                      <ImagePreload src={ava} width={40} />
                                    ) : null}

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-baseline gap-2">
                                        {/* Имя — только если не пусто */}
                                        {name ? (
                                          <div className="font-medium text-[14px] text-white truncate">
                                            {name}
                                          </div>
                                        ) : null}
                                        {/* Дата — только если получилось распарсить */}
                                        {when ? (
                                          <div className="ml-auto text-[12px] text-[#6c7f94] shrink-0">
                                            {when}
                                          </div>
                                        ) : null}
                                      </div>

                                      {/* Текст — только если не пусто */}
                                      {msg ? (
                                        <div className="text-[12px] text-white/90">
                                          {msg}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}

                            {/* Пагинация (как было) */}
                            {inChatHasMore && (
                              <div className="p-2 flex justify-center">
                                <button
                                  onClick={() =>
                                    loadMoreSearchInChat(
                                      Number(selectedChat.id),
                                      50
                                    )
                                  }
                                  className="text-sm text-[#9cb2c9] hover:text-white"
                                >
                                  Загрузить ещё
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    <PinnedBar
                      pinnedMessages={pinnedMessages}
                      pinnedIndex={pinnedIndex}
                      setPinnedIndex={setPinnedIndex}
                      onClickShow={scrollToMessageById}
                    />
                    <MessageList
                      messages={messages}
                      openSeq={chatOpenSeq}
                      openCtxMenu={openCtxMenu}
                      msgRefs={msgRefs}
                      onLoadOlder={() =>
                        selectedChat && loadOlder(selectedChat.id, 50)
                      }
                      isLoadingOlder={isLoadingOlder}
                      hasMoreOlder={hasMoreOlder}
                      onRequestTranscription={requestTranscription}
                      allowTranscription={Boolean(activeTgAccount?.is_premium)}
                      onTranslate={doTranslate}
                      onToggleOriginal={doToggleOriginal}
                      onLoadNewer={() => loadNewer(selectedChat?.id, 50)}
                      isLoadingNewer={isLoadingNewer}
                      hasMoreNewer={hasMoreNewer}
                      chatId={selectedChat?.id}
                      openedBy={openOrigin?.type ?? "dialog"}
                      originFromSearch={
                        openOrigin?.type === "search" ? openOrigin.hit : null
                      }
                    />

                    <Composer
                      messageText={messageText}
                      setMessageText={setMessageText}
                      attachments={attachments}
                      addFilesAsAttachments={addFilesAsAttachments}
                      removeAttachment={(id) =>
                        setAttachments((prev) => {
                          const item = prev.find((x) => x.id === id);
                          if (item) URL.revokeObjectURL(item.url);
                          return prev.filter((x) => x.id !== id);
                        })
                      }
                      clearAttachments={clearAttachments}
                      replyTo={replyTo}
                      setReplyTo={setReplyTo}
                      onSend={handleSendMessage}
                      userScripts={tgScripts}
                      scriptState={scriptState}
                      setScriptState={setScriptState as any}
                      onSendVideoNote={handleSendVideoNote}
                      userVideos={tgVideos}
                      showVideoPicker={showVideoPicker}
                      setShowVideoPicker={setShowVideoPicker}
                      onPickSavedVideo={handleSendSavedVideo}
                      autoFocusKey={selectedChat?.id ?? null}
                      selectedUserId={Number(selectedChat?.id) || undefined}
                      channels={userChannels}
                      channelsLoading={isLoadingUserChannels}
                      onOpenChannels={(uid) => requestUserChannels(uid)}
                      onProcessDeposit={(payload) => processDeposit(payload)}
                      channelsError={userChannelsError}
                      resetKey={uiResetKey}
                      canDeposit={isActiveFirstLine}
                      showMoveToSecondLine={shouldShowMoveToSecondLine(
                        selectedChat,
                        isActiveFirstLine
                      )}
                      onMoveToSecondLine={onMoveSelectedChatToSecondLine}
                    />

                    <ContextMenu
                      ctxMenu={ctxMenu}
                      ctxMenuRef={ctxMenuRef}
                      onReply={doReply}
                      onForward={doForwardStart}
                      onPin={doPin}
                      onUnpin={doUnpin}
                      onCopy={doCopy}
                    />
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm">
                    <p className="py-1 px-3 rounded-full bg-[#1e2c3a]">
                      Выберите чат, чтобы начать переписку
                    </p>
                  </div>
                )}
              </Panel>
            </PanelGroup>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {mobileView === "list" && (
                <div className="flex-1 bg-[#17212b] flex flex-col min-h-0">
                  <div className="shrink-0">
                    {hasBothLines && (
                      <div className="px-2 pt-1 pb-1">
                        <div
                          role="tablist"
                          aria-label="Линия"
                          className="relative w-full rounded-xl border border-[#223140] bg-[#242f3d] backdrop-blur
                       px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
                        >
                          <div
                            className="
                pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)]
                rounded-lg bg-gradient-to-b from-[#214469] to-[#2b5278]
                shadow-[0_6px_16px_rgba(15,23,34,.6),inset_0_1px_0_rgba(255,255,255,.06)]
                transition-transform duration-300 will-change-transform
              "
                            style={{
                              transform:
                                lineTab === "first"
                                  ? "translateX(0)"
                                  : "translateX(calc(100% + 8px))",
                            }}
                            aria-hidden
                          />
                          <div className="grid grid-cols-2 gap-2 relative z-10">
                            <button
                              role="tab"
                              aria-selected={lineTab === "first"}
                              onClick={() => switchLine("first")}
                              className={`
                  h-8 rounded-md text-sm font-medium transition-colors w-full cursor-pointer
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]
                  ${
                    lineTab === "first"
                      ? "text-white"
                      : "text-white/70 hover:text-white"
                  }
                `}
                            >
                              1 линия
                            </button>
                            <button
                              role="tab"
                              aria-selected={lineTab === "second"}
                              onClick={() => switchLine("second")}
                              className={`
                  h-8 rounded-md text-sm font-medium transition-colors w-full cursor-pointer
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]
                  ${
                    lineTab === "second"
                      ? "text-white"
                      : "text-white/70 hover:text-white"
                  }
                `}
                            >
                              2 линия
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {chatFieldEditor.show && (
                      <div className="p-2 pb-1 pt-1 flex gap-1">
                        <input
                          className="w-full outline-none bg-[#242f3d] px-4 py-2 rounded-full placeholder:text-[#6c7f94] text-sm"
                          placeholder={editorPlaceholder}
                          value={chatFieldEditor.value}
                          onChange={(e) =>
                            setChatFieldEditor((s) => ({
                              ...s,
                              value: e.target.value,
                            }))
                          }
                          autoFocus
                        />
                        <button
                          onClick={submitChatField}
                          className="cursor-pointer bg-[#242f3d] px-2 rounded-full hover:opacity-[0.7] transition-opacity"
                        >
                          <Save size={17} />
                        </button>
                        <button
                          onClick={cancelChatField}
                          className="cursor-pointer bg-[#242f3d] px-2 rounded-full hover:opacity-[0.7] transition-opacity"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    )}

                    <div className="px-2 pt-1 pb-2">
                      <div className="relative">
                        <input
                          ref={searchInputRef}
                          className="w-full outline-none bg-[#242f3d] px-4 py-2 rounded-full placeholder:text-[#6c7f94] text-sm"
                          placeholder="Поиск"
                          value={localSearch}
                          onChange={(e) => {
                            const q = e.target.value;
                            setLocalSearch(q);
                            scheduleSearch(q);
                          }}
                        />
                        {!!searchQuery && (
                          <button
                            onClick={() => clearSearchAll()}
                            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                            aria-label="Очистить поиск"
                            title="Очистить"
                          >
                            <X
                              size={16}
                              className="text-[#6c7883] hover:text-white"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto tg-scroll">
                    {searchQuery ? (
                      <SearchResultsList
                        results={searchResults}
                        isSearching={isSearching}
                        hasMore={searchHasMore}
                        onReachEnd={() => loadMoreSearch(50)}
                        onPick={(hit) => {
                          setOpenOrigin({
                            type: "search",
                            hit,
                            seq: Date.now(),
                          });
                          openSearchHit(Number(hit.chat_id), Number(hit.id));
                        }}
                        chats={orderedChats}
                      />
                    ) : (
                      <ChatList
                        chats={orderedChats}
                        isLoading={isLoadingChats}
                        selectedChatId={selectedChat?.id}
                        onSelect={handleSelectChat}
                        onChatContextMenu={
                          canOpenChatCtxMenu
                            ? (eOrPos, chat) =>
                                openChatMenu(eOrPos as any, chat)
                            : undefined
                        }
                        onReorderPinned={(dragId, newPos1) =>
                          movePinnedChat(dragId, newPos1)
                        }
                        onReachEnd={onReachEndForUI}
                        hasMore={hasMoreForUI}
                        loadingMore={loadingMoreForUI}
                      />
                    )}
                  </div>
                </div>
              )}

              {mobileView === "dialog" && selectedChat && (
                <div className="flex-1 bg-[#0e1621] flex flex-col min-h-0">
                  <div className="flex items-center gap-2 py-2 px-3 bg-[#17212b]">
                    <button
                      onClick={() => setMobileView("list")}
                      className="shrink-0 p-2 rounded-full hover:bg-[#1f2c3a] active:bg-[#1a2633]"
                      aria-label="Назад к списку"
                    >
                      <ChevronLeft className="w-6 h-6 text-white/90" />
                    </button>

                    <h2 className="font-semibold truncate flex-1">
                      {selectedChat.title ||
                        selectedChat.last_message?.from_user?.first_name}
                    </h2>

                    {activeSignature && (
                      <span
                        className="ml-2 shrink-0 max-w-[45%] inline-flex items-center gap-2 py-[2.5px] px-[11px] rounded-full bg-[#1b2836] text-[12px] text-[#9ec1ff] border border-[#2b5278]/50 truncate"
                        title={`Подпись: ${activeSignature}`}
                      >
                        <span className="opacity-70">
                          <SquarePen size={14} />
                        </span>
                        <span className="font-medium truncate">
                          {activeSignature}
                        </span>
                      </span>
                    )}

                    {activeStatus && (
                      <span
                        className="ml-2 shrink-0 max-w-[45%] inline-flex items-center gap-2 py-[2.5px] px-[11px] rounded-full bg-[#1b2836] text-[12px] border border-[#2b5278]/50 truncate"
                        title={`Статус: ${activeStatus.title}`}
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              normColor(activeStatus.color) || "#2b7852",
                          }}
                          aria-hidden
                        />

                        <span className="font-medium truncate">
                          {activeStatus.title}
                        </span>
                      </span>
                    )}
                    <button
                      onClick={markCurrentChatAsRead}
                      className="shrink-0 p-2 rounded-full hover:bg-[#1f2c3a] active:bg-[#1a2633]"
                      title="Отметить входящие как прочитанные"
                      aria-label="Отметить входящие как прочитанные"
                    >
                      <CheckCheck size={16} className="text-white/90" />
                    </button>
                  </div>

                  <PinnedBar
                    pinnedMessages={pinnedMessages}
                    pinnedIndex={pinnedIndex}
                    setPinnedIndex={setPinnedIndex}
                    onClickShow={scrollToMessageById}
                  />

                  <MessageList
                    messages={messages}
                    openSeq={chatOpenSeq}
                    openCtxMenu={openCtxMenu}
                    msgRefs={msgRefs}
                    onLoadOlder={() =>
                      selectedChat && loadOlder(selectedChat.id, 50)
                    }
                    isLoadingOlder={isLoadingOlder}
                    hasMoreOlder={hasMoreOlder}
                    onRequestTranscription={requestTranscription}
                    allowTranscription={Boolean(activeTgAccount?.is_premium)}
                    onTranslate={doTranslate}
                    onToggleOriginal={doToggleOriginal}
                    onLoadNewer={() => loadNewer(selectedChat?.id, 50)}
                    isLoadingNewer={isLoadingNewer}
                    hasMoreNewer={hasMoreNewer}
                    chatId={selectedChat?.id}
                    openedBy={openOrigin?.type ?? "dialog"}
                    originFromSearch={
                      openOrigin?.type === "search" ? openOrigin.hit : null
                    }
                  />

                  <Composer
                    messageText={messageText}
                    setMessageText={setMessageText}
                    attachments={attachments}
                    addFilesAsAttachments={addFilesAsAttachments}
                    removeAttachment={(id) =>
                      setAttachments((prev) => {
                        const item = prev.find((x) => x.id === id);
                        if (item) URL.revokeObjectURL(item.url);
                        return prev.filter((x) => x.id !== id);
                      })
                    }
                    clearAttachments={clearAttachments}
                    replyTo={replyTo}
                    setReplyTo={setReplyTo}
                    onSend={handleSendMessage}
                    userScripts={tgScripts}
                    scriptState={scriptState}
                    setScriptState={setScriptState as any}
                    onSendVideoNote={handleSendVideoNote}
                    userVideos={tgVideos}
                    showVideoPicker={showVideoPicker}
                    setShowVideoPicker={setShowVideoPicker}
                    onPickSavedVideo={handleSendSavedVideo}
                    autoFocusKey={selectedChat?.id ?? null}
                    selectedUserId={Number(selectedChat?.id) || undefined}
                    channels={userChannels}
                    channelsLoading={isLoadingUserChannels}
                    onOpenChannels={(uid) => requestUserChannels(uid)}
                    onProcessDeposit={(payload) => processDeposit(payload)}
                    channelsError={userChannelsError}
                    resetKey={uiResetKey}
                    canDeposit={isActiveFirstLine}
                    showMoveToSecondLine={shouldShowMoveToSecondLine(
                      selectedChat,
                      isActiveFirstLine
                    )}
                    onMoveToSecondLine={onMoveSelectedChatToSecondLine}
                  />

                  <ContextMenu
                    ctxMenu={ctxMenu}
                    ctxMenuRef={ctxMenuRef}
                    onReply={doReply}
                    onForward={doForwardStart}
                    onPin={doPin}
                    onUnpin={doUnpin}
                    onCopy={doCopy}
                  />
                </div>
              )}
            </div>
          ))}

        <ChatContextMenu
          ctxMenu={canOpenChatCtxMenu ? chatMenu : null}
          ctxMenuRef={chatMenuRef}
          onSetSignature={beginSetSignature}
          onSetStatus={(chat, anchor) => {
            setChatMenu(null);
            openStatusMenu(chat, anchor);
          }}
          onTogglePin={togglePinChat}
          onMoveToSecondLine={moveChatToSecondLine}
          showMoveToSecondLine={shouldShowMoveToSecondLine(
            selectedChat,
            isActiveFirstLine
          )}
          canEditMeta={canEditChatMeta}
        />

        {statusMenu.open && (
          <div
            className="fixed inset-0 z-[300]"
            onClick={closeStatusMenu}
            onContextMenu={(e) => e.preventDefault()}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="fixed w-[min(220px,92vw)] max-h-[60vh] overflow-auto rounded-lg border border-[#0f1a22] bg-[#17212b] shadow-xl text-sm text-white"
              style={{
                left: statusMenu.anchor
                  ? Math.min(statusMenu.anchor.x, window.innerWidth - 320)
                  : "50%",
                top: statusMenu.anchor
                  ? Math.min(statusMenu.anchor.y, window.innerHeight - 240)
                  : "50%",
                transform: statusMenu.anchor
                  ? "translate(0, 0)"
                  : "translate(-50%, -50%)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {statusMenu.loading && (
                <div className="px-3 py-3 text-white/70">Загрузка…</div>
              )}
              {!statusMenu.loading && statusMenu.error && (
                <div className="px-3 py-3 text-red-400">{statusMenu.error}</div>
              )}

              {!statusMenu.loading && !statusMenu.error && (
                <ul className="py-1">
                  {statusMenu.items.map((it) => (
                    <li key={it.title}>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-[#1f2c3a] flex items-center gap-2 cursor-pointer"
                        onClick={() => applyStatus(it)}
                        title={it.title}
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: normColor(it.color) || "#2b5278",
                          }}
                        />

                        <span className="truncate">{it.title}</span>
                      </button>
                    </li>
                  ))}

                  {statusMenu.items.length === 0 && (
                    <li className="px-3 py-2 text-white/60">
                      Нет доступных статусов
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {!isWorking && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative max-w-md w-full rounded-2xl border border-[#233243] bg-[#0c141d]/95 shadow-xl px-5 py-6 text-center">
              <h3 className="text-white text-lg font-semibold">
                Ваша смена неактивна
              </h3>
              <p className="text-inactive text-sm mt-1">
                Нажмите «Начать смену», чтобы открыть чаты.
              </p>

              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={startWorkHere}
                  disabled={starting}
                  className="outline-none cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition text-left select-none
                    border-[#1e2c3a] bg-[#121a24] text-white/90
                    hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {starting ? "Запуск…" : "Начать смену"}
                </button>
                <Link
                  to="/"
                  className="outline-none cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition text-left select-none
                    border-[#1e2c3a] bg-[#121a24] text-white/90
                    hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                >
                  Панель
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default Chats;
