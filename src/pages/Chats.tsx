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
import { ChevronLeft, CheckCheck } from "lucide-react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/axios";

const Chats = () => {
  const user = useSelector((state: RootState) => state.user.user);
  // keep for future navigations
  useNavigate();
  const canOpenChatCtxMenu = (user?.perms ?? []).includes("chief_admin");

  const token = localStorage.getItem("access_token");
  const dispatch = useDispatch();

  const [searchParams] = useSearchParams();
  const forcedTgParam = searchParams.get("tg");
  const [forcedMode, setForcedMode] = useState(false);

  const isMobile = useBreakpoint("(max-width: 767.98px)");
  const [mobileView, setMobileView] = useState<"list" | "dialog">("list");

  // завершение/начало смены
  const [ending, setEnding] = useState(false);
  const [starting, setStarting] = useState(false);

  const [activeTgAccount, setActiveTgAccount] = useState<any | null>(null);

  const telegramAccountId = activeTgAccount?.telegram_id || null;
  const isWorking = Boolean(user?.is_working);

  const [reloadKey, setReloadKey] = useState(0);
  const forceReconnect = () => setReloadKey((k) => k + 1);

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
  } = useTelegramSocket(telegramAccountId, token, isWorking, reloadKey); // <= ВАЖНО: enabled = isWorking

  const { setServerNote, debouncedSendNote } = useDrafts(sendMessage);

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
    mode: "signature" | "status" | null;
    value: string;
  }>({ show: false, chatId: null, mode: null, value: "" });
  const [uiResetKey, setUiResetKey] = useState(0);
  const didOffResetRef = useRef(false);

  const hardResetUI = () => {
    // 1) то, что у тебя уже делает resetComposer
    resetComposer();

    // 2) закрыть все внутренние меню/состояния на уровне Chats
    setShowVideoPicker(false);
    setScriptState({ show: false, filtered: [], activeIndex: 0 });
    setCtxMenu(null);
    setChatMenu(null);
    setChatFieldEditor({ show: false, chatId: null, mode: null, value: "" });

    // 3) дернуть resetKey для Composer (внутри он закроет своё внутреннее состояние)
    setUiResetKey((k) => k + 1);
  };

  usePasteUpload(addFilesAsAttachments, [attachments.length]);

  // активный ТГ-аккаунт по умолчанию — первый у пользователя
  useEffect(() => {
    const list = Array.isArray(user?.telegram_accounts)
      ? user!.telegram_accounts
      : [];

    // нет аккаунтов — делать нечего
    if (!list.length) return;

    // если уже выбран или есть принудительный ?tg= — не трогаем
    if (activeTgAccount || forcedTgParam) return;

    // пробуем восстановить сохранённый
    try {
      const saved = localStorage.getItem(SAVED_TG_KEY) || "";
      const found = saved ? findAccountByKey(list, saved) : null;
      if (found) {
        setActiveTgAccount(found);
        return;
      }
    } catch {}

    // откат: берём первый
    setActiveTgAccount(list[0]);
  }, [user?.telegram_accounts, activeTgAccount, forcedTgParam]);

  useEffect(() => {
    const list = Array.isArray(user?.telegram_accounts)
      ? user!.telegram_accounts
      : [];

    if (!list.length) {
      // Сброс, если вообще нет аккаунтов
      if (activeTgAccount) setActiveTgAccount(null);
      try {
        localStorage.removeItem(SAVED_TG_KEY);
      } catch {}
      return;
    }

    // если активный есть и он ещё существует — всё ок
    if (activeTgAccount && findAccountByKey(list, accKey(activeTgAccount))) {
      return;
    }

    // если активный отсутствует/удалён — пробуем сохранённый
    try {
      const saved = localStorage.getItem(SAVED_TG_KEY) || "";
      const found = saved ? findAccountByKey(list, saved) : null;
      if (found) {
        setActiveTgAccount(found);
        return;
      }
    } catch {}

    // иначе откат на первый
    setActiveTgAccount(list[0]);
  }, [user?.telegram_accounts, activeTgAccount]);

  // Если смена стала неактивна — чистим локальные данные (и сокета нет вовсе)
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
      // дальше сокет сам подключится благодаря enabled = isWorking
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
      // после обновления профиля isWorking станет false => локальные данные очистятся, сокета не будет
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

    // если клик по уже активному — просто переподключаемся
    if (curKey && nextKey && curKey === nextKey) {
      hardResetUI();
      setChats([]);
      setSelectedChat(null as any);
      setMessages([]);
      forceReconnect(); // <— триггерим useEffect в хуке
      return;
    }

    // иначе обычное переключение
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

  useEffect(() => {
    console.log("текущиай аккаунт", activeTgAccount);
  }, [activeTgAccount]);

  const handleSelectChat = (chat: any) => {
    hardResetUI();
    setSelectedChat(chat);
    const serverNote = (chat?.note ?? "").trim();
    setServerNote(chat.id, serverNote);
    setMessageText(serverNote);
    if (isMobile) setMobileView("dialog");
  };

  useEffect(() => {
    if (!isMobile) setMobileView("list");
  }, [isMobile]);

  useEffect(() => {
    if (!isWorking) return;
    const chatId = selectedChat?.id;
    if (!chatId) return;
    debouncedSendNote(String(chatId), (messageText ?? "").trim());
  }, [isWorking, messageText, selectedChat?.id]);

  const handleSendUniversal = async (opts?: { pasted?: boolean }) => {
    if (!selectedChat) return;

    const text = messageText.trim();
    const picked = attachments.slice(0, 10);
    const images = picked.filter((a) => a.kind === "image");
    const videos = picked.filter((a) => a.kind === "video");

    const hasText = !!text;
    const hasMedia = picked.length > 0;
    if (!hasText && !hasMedia) return;

    try {
      const photosPayload = images.length
        ? await Promise.all(images.map((a) => fileToDataUrl(a.file)))
        : undefined;
      const videosPayload = videos.length
        ? await Promise.all(videos.map((a) => fileToDataUrl(a.file)))
        : undefined;

      const data: any = { chat_id: selectedChat.id };
      if (hasText) data.text = text;
      if (photosPayload?.length) data.photos = photosPayload;
      if (videosPayload?.length) data.videos = videosPayload;
      if (replyTo?.id) data.reply_to_id = replyTo.id;
      data.pasted = Boolean(opts?.pasted);

      sendMessage({ type: "send_message", data });
    } catch (e) {
      toast.error("Не удалось отправить сообщение");
      console.error(e);
      return;
    } finally {
      resetComposer();
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
        toast.success("Скопировано");
      } else toast.info("Нечего копировать");
    } catch {
      toast.error("Не удалось скопировать");
    }
    setCtxMenu(null);
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

  const beginSetStatus = (chat: any) => {
    setChatMenu(null);
    const current = `${chat?.status ?? ""}`;
    setChatFieldEditor({
      show: true,
      chatId: Number(chat.id),
      mode: "status",
      value: current,
    });
  };

  const submitChatField = () => {
    const id = chatFieldEditor.chatId;
    const mode = chatFieldEditor.mode;
    const value = (chatFieldEditor.value ?? "").trim();
    if (!id || !mode) return;

    if (mode === "signature") {
      sendMessage({
        type: "set_channel_signature",
        data: { chat_id: id, channel_signature: value },
      });
      setChats((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(id) ? { ...c, channel_signature: value } : c
        )
      );
      toast.success("Подпись отправлена");
    } else {
      sendMessage({
        type: "set_status",
        data: { chat_id: id, status: value },
      });
      setChats((prev) =>
        prev.map((c) =>
          Number(c.id) === Number(id) ? { ...c, status: value } : c
        )
      );
      toast.success("Статус обновлён");
    }

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
    if (!id) return "";
    const fromList =
      chats.find((c) => Number(c.id) === Number(id))?.status ?? "";
    const fromSelected = (selectedChat as any)?.status ?? "";
    const fromEditor =
      chatFieldEditor.show &&
      chatFieldEditor.mode === "status" &&
      Number(chatFieldEditor.chatId) === Number(id)
        ? chatFieldEditor.value
        : "";
    return `${fromEditor || fromList || fromSelected}`.trim();
  }, [chats, selectedChat, chatFieldEditor]);

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

  // --- line tabs (для аккаунтов у которых есть обе линии) ---
  type LineTab = "first" | "second";

  const switchLine = (tab: LineTab) => {
    if (tab === lineTab) return;
    // закрываем активный чат и чистим UI
    hardResetUI();
    setSelectedChat(null as any);
    setMessages([]);
    if (isMobile) setMobileView("list");
    setLineTab(tab);
  };

  const normLine = (v: any): "first" | "second" | null => {
    const s = String(v ?? "").toLowerCase();
    if (s.includes("first") || s === "1" || s === "1st" || s.includes("первая"))
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

  // при смене аккаунта — выставляем вкладку: загружаем сохранённую, иначе "first"/"second" по доступности
  useEffect(() => {
    if (!activeTgAccount) return;
    if (!hasBothLines) {
      // у аккаунта не обе линии — смысла в tab’ах нет
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

  // сохраняем выбор вкладки
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
    // текст/реплай/скрипт-меню/аттачи
    setMessageText("");
    setReplyTo(null);
    setScriptState({ show: false, filtered: [], activeIndex: 0 });
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });

    // закрыть видео-пикер (внутренний стейт на уровне Chats)
    setShowVideoPicker(false);

    // дернуть принудительный сброс внутренних попапов Composer (эмодзи/подтверждение 2-й линии/режимы)
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

  const editorPlaceholder =
    chatFieldEditor.mode === "status" ? "Статус чата" : "Подпись канала";
  const editorLabel =
    chatFieldEditor.mode === "status" ? "Сохранить" : "Сохранить";

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
  };

  // --- persist selected tg account ---
  const SAVED_TG_KEY = "chats:lastTgAccountId";

  // Универсальный способ получить стабильный id для сравнения/хранения
  const accKey = (acc: any) =>
    String(
      acc?.telegram_id ??
        acc?.user_id ??
        acc?.id ??
        acc?.phone ??
        acc?.username ??
        ""
    );

  // Найти аккаунт в списке по сохранённому ключу
  const findAccountByKey = (list: any[], key: string) =>
    list.find((a) => accKey(a) === key);

  const filteredChats = useMemo(() => {
    if (!hasBothLines) return chats; // табов нет — ничего не фильтруем
    const want = lineTab; // "first" | "second"
    return chats.filter((c: any) => {
      const l = normLine(c?.line);
      // если у чата не пришла линия — по умолчанию показываем в обеих
      if (!l) return true;
      return l === want;
    });
  }, [chats, hasBothLines, lineTab]);

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
                <div className="flex-1 min-h-0 overflow-y-auto tg-scroll">
                  {chatFieldEditor.show && (
                    <div className="sticky top-0 z-10 p-2 border-b border-[#0f1a22] bg-[#0e1621] flex gap-2">
                      <input
                        className="flex-1 bg-[#16222e] text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#2b5278]"
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
                        className="px-3 py-2 rounded bg-[#2b5278] hover:bg-[#2f5f8a] text-sm"
                      >
                        {editorLabel}
                      </button>
                      <button
                        onClick={cancelChatField}
                        className="px-3 py-2 rounded bg-[#1f2c3a] hover:bg-[#213546] text-sm cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  )}

                  {hasBothLines && (
                    <div className="sticky top-0 z-10 px-2 pt-2 pb-1 bg-[#0e1621] border-b border-[#0f1a22]">
                      <div className="inline-flex items-center rounded-lg p-1 bg-[#121a24] border border-[#1e2c3a] w-full">
                        <button
                          onClick={() => switchLine("first")}
                          className={`px-3 py-1.5 rounded-md text-sm transition w-full cursor-pointer
          ${
            lineTab === "first"
              ? "bg-[#2b5278] text-white"
              : "text-white/80 hover:bg-[#17212b]"
          }`}
                        >
                          1 линия
                        </button>
                        <button
                          onClick={() => switchLine("second")}
                          className={`px-3 py-1.5 rounded-md text-sm transition w-full cursor-pointer
          ${
            lineTab === "second"
              ? "bg-[#2b5278] text-white"
              : "text-white/80 hover:bg-[#17212b]"
          }`}
                        >
                          2 линия
                        </button>
                      </div>
                    </div>
                  )}

                  <ChatList
                    chats={filteredChats}
                    isLoading={isLoadingChats}
                    selectedChatId={selectedChat?.id}
                    onSelect={handleSelectChat}
                    onChatContextMenu={
                      canOpenChatCtxMenu
                        ? (eOrPos, chat) => openChatMenu(eOrPos as any, chat)
                        : undefined
                    }
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="w-1 bg-gray-700 hover:bg-[#2b5278] transition-all cursor-col-resize" />

              <Panel className="bg-[#0e1621] flex flex-col min-h-0">
                {selectedChat ? (
                  <>
                    <div className="py-2 px-4 bg-[#17212b] flex items-center gap-2">
                      <h2 className="text-lg font-bold truncate flex-1">
                        {selectedChat.title ||
                          selectedChat.last_message?.from_user?.first_name}
                      </h2>

                      {activeSignature && (
                        <span
                          className="ml-2 shrink-0 max-w-[45%] inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[#1b2836] text-[12px] text-[#9ec1ff] border border-[#2b5278]/50 truncate"
                          title={`Подпись: ${activeSignature}`}
                        >
                          <span className="opacity-70">подпись:</span>
                          <span className="font-medium truncate">
                            {activeSignature}
                          </span>
                        </span>
                      )}

                      {activeStatus && (
                        <span
                          className="ml-2 shrink-0 max-w-[40%] inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[#1b3628] text-[12px] text-[#9effc1] border border-[#2b7852]/50 truncate"
                          title={`Статус: ${activeStatus}`}
                        >
                          <span className="opacity-70">статус:</span>
                          <span className="font-medium truncate">
                            {activeStatus}
                          </span>
                        </span>
                      )}

                      <button
                        onClick={markCurrentChatAsRead}
                        className="shrink-0 p-2 rounded-full hover:bg-[#1f2c3a] active:bg-[#1a2633]"
                        title="Отметить входящие как прочитанные"
                        aria-label="Отметить входящие как прочитанные"
                      >
                        <CheckCheck className="w-5 h-5 text-white/90" />
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
                      openCtxMenu={openCtxMenu}
                      msgRefs={msgRefs}
                      onLoadOlder={() =>
                        selectedChat && loadOlder(selectedChat.id, 50)
                      }
                      isLoadingOlder={isLoadingOlder}
                      hasMoreOlder={hasMoreOlder}
                      chatKey={selectedChat?.id}
                      onRequestTranscription={requestTranscription}
                      allowTranscription={Boolean(activeTgAccount?.is_premium)}
                      onTranslate={doTranslate}
                      onToggleOriginal={doToggleOriginal}
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
                      userScripts={user?.scripts}
                      scriptState={scriptState}
                      setScriptState={setScriptState as any}
                      onSendVideoNote={handleSendVideoNote}
                      userVideos={(user as any)?.videos || []}
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
                      showMoveToSecondLine={isActiveFirstLine}
                      onMoveToSecondLine={onMoveSelectedChatToSecondLine}
                    />

                    <ContextMenu
                      ctxMenu={ctxMenu}
                      ctxMenuRef={ctxMenuRef}
                      onReply={doReply}
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
                <div className="flex-1 bg-[#17212b] overflow-y-auto flex flex-col">
                  {chatFieldEditor.show && (
                    <div className="sticky top-0 z-10 p-2 border-b border-[#0f1a22] bg-[#0e1621] flex gap-2">
                      <input
                        className="flex-1 bg-[#16222e] text-sm rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#2b5278]"
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
                        className="px-3 py-2 rounded bg-[#2b5278] hover:bg-[#2f5f8a] text-sm"
                      >
                        {editorLabel}
                      </button>
                      <button
                        onClick={cancelChatField}
                        className="px-3 py-2 rounded bg-[#1f2c3a] hover:bg-[#213546] text-sm cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  )}

                  <ChatList
                    chats={filteredChats}
                    isLoading={isLoadingChats}
                    selectedChatId={selectedChat?.id}
                    onSelect={handleSelectChat}
                    onChatContextMenu={
                      canOpenChatCtxMenu
                        ? (eOrPos, chat) => openChatMenu(eOrPos as any, chat)
                        : undefined
                    }
                  />
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
                        className="ml-2 shrink-0 max-w-[50%] inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[#1b2836] text-[11px] text-[#9ec1ff] border border-[#2b5278]/50 truncate"
                        title={`Подпись: ${activeSignature}`}
                      >
                        <span className="opacity-70">подпись:</span>
                        <span className="font-medium truncate">
                          {activeSignature}
                        </span>
                      </span>
                    )}

                    {activeStatus && (
                      <span
                        className="ml-2 shrink-0 max-w-[50%] inline-flex items-center gap-1 px-2 py-[2px] rounded-full bg-[#1b3628] text-[11px] text-[#9effc1] border border-[#2b7852]/50 truncate"
                        title={`Статус: ${activeStatus}`}
                      >
                        <span className="opacity-70">статус:</span>
                        <span className="font-medium truncate">
                          {activeStatus}
                        </span>
                      </span>
                    )}

                    <button
                      onClick={markCurrentChatAsRead}
                      className="shrink-0 p-2 rounded-full hover:bg-[#1f2c3a] active:bg-[#1a2633]"
                      title="Отметить входящие как прочитанные"
                      aria-label="Отметить входящие как прочитанные"
                    >
                      <CheckCheck className="w-5 h-5 text-white/90" />
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
                    openCtxMenu={openCtxMenu}
                    msgRefs={msgRefs}
                    onLoadOlder={() =>
                      selectedChat && loadOlder(selectedChat.id, 50)
                    }
                    isLoadingOlder={isLoadingOlder}
                    hasMoreOlder={hasMoreOlder}
                    chatKey={selectedChat?.id}
                    onRequestTranscription={requestTranscription}
                    allowTranscription={Boolean(activeTgAccount?.is_premium)}
                    onTranslate={doTranslate}
                    onToggleOriginal={doToggleOriginal}
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
                    userScripts={user?.scripts}
                    scriptState={scriptState}
                    setScriptState={setScriptState as any}
                    onSendVideoNote={handleSendVideoNote}
                    userVideos={(user as any)?.videos || []}
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
                    showMoveToSecondLine={isActiveFirstLine}
                    onMoveToSecondLine={onMoveSelectedChatToSecondLine}
                  />

                  <ContextMenu
                    ctxMenu={ctxMenu}
                    ctxMenuRef={ctxMenuRef}
                    onReply={doReply}
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
          onSetStatus={beginSetStatus}
          onMoveToSecondLine={moveChatToSecondLine}
          showMoveToSecondLine={isActiveFirstLine}
        />

        {/* Оверлей "смена неактивна" */}
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
