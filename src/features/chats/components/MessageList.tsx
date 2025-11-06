import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import clsx from "clsx";
import ChatBubble from "@/components/BubbleMsg";
import { formatDayTitle, isSameDay } from "@/features/utils/dates";
import { buildServiceLabel } from "@/features/utils/serviceMessage";
import { normalizeMediaArray } from "@/features/utils/media";
import { useScrollToBottom } from "../hooks/useScrollToBottom";

const LOG = false;
const log = (...a: any[]) => LOG && console.log("[list]", ...a);

const DaySeparator = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center my-3">
    <span className="px-3 py-1 text-[12px] rounded-full bg-[#1e2c3a] font-semibold select-none">
      {label}
    </span>
  </div>
);

const SystemNotice = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center justify-center my-3 min-w-0">
    <span
      className="px-3 py-1 text-[12px] rounded-full bg-[#1e2c3a] font-semibold select-none inline-block max-w-[50%] truncate overflow-hidden whitespace-nowrap"
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </span>
  </div>
);

const cmpMsg = (a: any, b: any) => {
  const ta = Date.parse(a.date);
  const tb = Date.parse(b.date);
  if (ta !== tb) return ta - tb;
  const ia = Number(a.id) || 0;
  const ib = Number(b.id) || 0;
  return ia - ib;
};

type Props = {
  messages: any[];
  openCtxMenu: (e: React.MouseEvent, msg: any) => void;
  msgRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;

  onLoadOlder: () => void;
  isLoadingOlder: boolean;
  hasMoreOlder: boolean;

  onLoadNewer?: () => void;
  isLoadingNewer?: boolean;
  hasMoreNewer?: boolean;

  openSeq?: number;

  onRequestTranscription?: (messageId: number | string) => void;
  allowTranscription?: boolean;
  onTranslate?: (m: any) => void;
  onToggleOriginal?: (m: any) => void;
  chatId?: number | string;

  centerOnMessageId?: number | string | null;
  centerSeq?: number;
  centerBehavior?: ScrollBehavior;

  openedBy?: "search" | "dialog";
  originFromSearch?: any | null;
};

export default function MessageList({
  chatId,

  messages,
  openCtxMenu,
  msgRefs,

  onLoadOlder,
  isLoadingOlder,
  hasMoreOlder,

  onLoadNewer,
  isLoadingNewer = false,
  hasMoreNewer = true,

  onRequestTranscription,
  allowTranscription,
  onTranslate,
  onToggleOriginal,

  openedBy = "dialog",
  originFromSearch = null,
}: Props) {
  const sorted = useMemo(() => [...messages].sort(cmpMsg), [messages]);

  const originRef = useRef<any | null>(null);

  let lastDayKey: string | null = null;

  const getPrevNonService = (arr: any[], i: number) => {
    for (let k = i - 1; k >= 0; k--)
      if (arr[k]?.message_type !== "service_message") return arr[k];
    return null;
  };
  const getNextNonService = (arr: any[], i: number) => {
    for (let k = i + 1; k < arr.length; k++)
      if (arr[k]?.message_type !== "service_message") return arr[k];
    return null;
  };
  const sameSender = (a: any, b: any) => {
    if (!a || !b) return false;
    if (a.is_outgoing && b.is_outgoing) return true;
    if (a.is_outgoing !== b.is_outgoing) return false;
    const uA = a?.from_user ?? {};
    const uB = b?.from_user ?? {};
    const key = (u: any) =>
      String(u.id ?? u.peer_id ?? "") ||
      (u.username ? `@${String(u.username).toLowerCase()}` : "");
    const ka = key(uA);
    const kb = key(uB);
    return ka && kb ? ka === kb : true;
  };
  const normalizeIsRead = (v: any): boolean | undefined => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v > 0;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes"].includes(s)) return true;
      if (["false", "0", "no"].includes(s)) return false;
    }
    return undefined;
  };

  // ===== refs & helpers =====

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const removeStaggerTimerRef = useRef<number | null>(null);

  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  const olderReqRef = useRef(false);

  const prevHRef = useRef(0);
  const prevTopRef = useRef(0);

  const ioArmedRef = useRef(false);
  const userInteractedRef = useRef(false);

  const searchCenterDoneRef = useRef(false);

  const { scrollToBottomWhenReady } = useScrollToBottom(scrollerRef, {
    nearBottomOffset: 48,
    behavior: "smooth",
    waitImagesOnReady: false,
    logEnabled: false,
  });

  const lastId = sorted.length ? sorted[sorted.length - 1].id : 0;
  const readyKey = `${chatId ?? "none"}:${lastId}`;
  const anchorUnlockTimerRef = useRef<number | null>(null);

  const highlightTimerRef = useRef<number | null>(null);

  const flashHighlight = (el: HTMLElement) => {
    el.classList.remove("msg-highlight");
    (el as any).offsetWidth;
    el.classList.add("msg-highlight");

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => {
      el.classList.remove("msg-highlight");
      highlightTimerRef.current = null;
    }, 1100);
  };

  useEffect(() => {
    if (openedBy === "search" && originFromSearch?.id) {
      searchCenterDoneRef.current = false;
    } else {
      searchCenterDoneRef.current = true;
    }
  }, [chatId, openedBy, originFromSearch?.id]);

  useEffect(() => {
    if (!chatId) return;

    if (openedBy === "search") {
      if (searchCenterDoneRef.current) return;

      const el = scrollerRef.current;
      if (!el) return;

      el.style.setProperty("overflow-anchor", "none");
      ioArmedRef.current = false;

      const id = Number(originFromSearch?.id);
      if (!Number.isFinite(id)) return;

      const node = el.querySelector(
        `[data-msg-id="${id}"]`
      ) as HTMLElement | null;
      if (!node) return;

      node.scrollIntoView({ block: "center", behavior: "smooth" });

      const hardCenter = () => {
        const s = scrollerRef.current;
        if (!s || !node) return;
        const sRect = s.getBoundingClientRect();
        const nRect = node.getBoundingClientRect();
        const top = nRect.top - sRect.top + s.scrollTop;
        const target =
          top -
          (s.clientHeight - (node.offsetHeight || node.clientHeight || 0)) / 2;
        s.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          hardCenter();
          scrollerRef.current?.classList.remove("tg-stagger");
          flashHighlight(node);
          searchCenterDoneRef.current = true;
        });
      });

      const fixTimer = window.setTimeout(hardCenter, 600);

      if (anchorUnlockTimerRef.current)
        clearTimeout(anchorUnlockTimerRef.current);
      anchorUnlockTimerRef.current = window.setTimeout(() => {
        el.style.removeProperty("overflow-anchor");
        anchorUnlockTimerRef.current = null;
      }, 900);

      return () => {
        clearTimeout(fixTimer);
        if (anchorUnlockTimerRef.current) {
          clearTimeout(anchorUnlockTimerRef.current);
          anchorUnlockTimerRef.current = null;
        }
        el.style.removeProperty("overflow-anchor");
      };
    } else {
      scrollToBottomWhenReady(readyKey, "auto");
    }
  }, [
    readyKey,
    chatId,
    scrollToBottomWhenReady,
    openedBy,
    originFromSearch?.id,
  ]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const arm = () => {
      userInteractedRef.current = true;
      ioArmedRef.current = true;
      searchCenterDoneRef.current = true;
    };

    const onWheel = () => arm();
    const onTouch = () => arm();
    const onKey = (e: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(e.key)
      )
        arm();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (el.contains(e.target as Node)) arm();
    };

    ioArmedRef.current = openedBy !== "search";

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("keydown", onKey as any, { passive: true } as any);
    window.addEventListener(
      "mousedown",
      onMouseDown as any,
      { passive: true } as any
    );

    return () => {
      el.removeEventListener("wheel", onWheel as any);
      el.removeEventListener("touchstart", onTouch as any);
      window.removeEventListener("keydown", onKey as any);
      window.removeEventListener("mousedown", onMouseDown as any);
    };
  }, [openedBy]);

  const measure = useCallback(() => {
    const el = scrollerRef.current!;
    return {
      top: el.scrollTop,
      h: el.scrollHeight,
      ch: el.clientHeight,
    };
  }, []);

  const snapshotBeforeLoadOlder = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { top, h } = measure();
    prevTopRef.current = top;
    prevHRef.current = h;
    olderReqRef.current = true;
    log("snapshot[older] before", { top: Math.round(top), h });
  }, [measure]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    if (olderReqRef.current) {
      const deltaH = el.scrollHeight - prevHRef.current;
      const nextTop = prevTopRef.current + deltaH;
      el.scrollTop = nextTop;
      olderReqRef.current = false;
      log("restore after older", {
        deltaH,
        prevTop: Math.round(prevTopRef.current),
        nextTop: Math.round(nextTop),
      });
    }
  }, [messages.length]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const topNode = topSentinelRef.current;
    const botNode = bottomSentinelRef.current;

    const opts: IntersectionObserverInit = {
      root,
      rootMargin: "150px 0px",
      threshold: 0.01,
    };

    const topIO =
      topNode &&
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        if (!ioArmedRef.current) {
          log("TOP reached — ignored (no user interaction yet)");
          return;
        }
        if (!hasMoreOlder || isLoadingOlder) {
          log("TOP reached — skip:", { hasMoreOlder, isLoadingOlder });
          return;
        }
        log("TOP reached — load older");
        snapshotBeforeLoadOlder();
        onLoadOlder();
      }, opts);

    const botIO =
      botNode &&
      new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;

        if (!ioArmedRef.current) {
          log("BOTTOM reached — ignored (no user interaction yet)");
          return;
        }
        if (!onLoadNewer) return;
        if (!hasMoreNewer || isLoadingNewer) {
          log("BOTTOM reached — skip:", { hasMoreNewer, isLoadingNewer });
          return;
        }
        searchCenterDoneRef.current = true;

        log("BOTTOM reached — load newer");
        onLoadNewer();
      }, opts);

    if (topIO && topNode) topIO.observe(topNode);
    if (botIO && botNode) botIO.observe(botNode);

    return () => {
      topIO?.disconnect();
      botIO?.disconnect();
    };
  }, [
    hasMoreOlder,
    isLoadingOlder,
    onLoadOlder,
    hasMoreNewer,
    isLoadingNewer,
    onLoadNewer,
    snapshotBeforeLoadOlder,
  ]);

  useEffect(() => {
    originRef.current = originFromSearch ?? null;

    if (openedBy === "search") {
      (window as any).__messageListOrigin = {
        type: "search",
        hit: originFromSearch,
        at: new Date().toISOString(),
      };
    } else {
      (window as any).__messageListOrigin = {
        type: "dialog",
        at: new Date().toISOString(),
      };
    }
  }, [openedBy, originFromSearch]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    el.classList.remove("tg-stagger");
    if (removeStaggerTimerRef.current) {
      clearTimeout(removeStaggerTimerRef.current);
      removeStaggerTimerRef.current = null;
    }

    if (openedBy === "dialog") {
      el.classList.add("tg-stagger");
      removeStaggerTimerRef.current = window.setTimeout(() => {
        el.classList.remove("tg-stagger");
        removeStaggerTimerRef.current = null;
      }, 350);
    }

    if (openedBy === "search") {
      el.classList.remove("tg-stagger");
    }

    return () => {
      if (removeStaggerTimerRef.current) {
        clearTimeout(removeStaggerTimerRef.current);
        removeStaggerTimerRef.current = null;
      }
      el.classList.remove("tg-stagger");
    };
  }, [openedBy, chatId]);

  // ===== Render =====

  const shouldAnim = openedBy !== "search";

  return (
    <div
      className={clsx(
        "ml-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-2 flex flex-col tg-scroll",
        shouldAnim && "ml-anim"
      )}
      ref={scrollerRef}
    >
      {/* Верхний «маяк» для авто-догрузки старых */}
      <div
        ref={topSentinelRef}
        aria-hidden
        style={{ height: 1, marginTop: -1 }}
      />

      {sorted.map((msg, idx) => {
        const d = new Date(msg.date);
        const dayKey = d.toISOString().slice(0, 10);
        const needSeparator = dayKey !== lastDayKey;
        if (needSeparator) lastDayKey = dayKey;

        const prev = getPrevNonService(sorted, idx);
        const next = getNextNonService(sorted, idx);
        const sameDayWithPrev = !!prev && isSameDay(d, new Date(prev.date));
        const sameDayWithNext = !!next && isSameDay(d, new Date(next.date));
        const sameAsPrev = !!prev && sameDayWithPrev && sameSender(prev, msg);
        const sameAsNext = !!next && sameDayWithNext && sameSender(next, msg);

        const showTail = !sameAsNext;
        const mt = sameAsPrev ? "mt-[2px]" : "mt-[8px]";
        const mediaArray = normalizeMediaArray(msg);
        const edited = !!msg.is_edited || !!msg.edited;
        const idNum = typeof msg.id === "number" ? msg.id : Number(msg.id);

        return (
          <div key={`wrap-${msg.id}`} className={clsx("flex flex-col", mt)}>
            {needSeparator && <DaySeparator label={formatDayTitle(d)} />}
            {msg.message_type === "service_message" ? (
              <SystemNotice>{buildServiceLabel(msg, sorted, idx)}</SystemNotice>
            ) : (
              <div
                ref={(el) => {
                  if (!Number.isNaN(idNum)) msgRefs.current[idNum] = el;
                }}
                data-msg-id={idNum}
                className="inline-block"
                onContextMenu={(e) => openCtxMenu(e, msg)}
              >
                <ChatBubble
                  text={msg.text}
                  date={d.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                  isSender={msg.is_outgoing}
                  media={mediaArray}
                  forwardedFrom={msg.forwarded_from}
                  showTail={showTail}
                  seriesHasNext={sameAsNext}
                  avatar={msg?.from_user?.avatar}
                  isPinned={!!msg.is_pinned}
                  isRead={normalizeIsRead(msg.is_read)}
                  messageId={msg.id}
                  transcribing={!!msg.transcribing}
                  transcription={msg.transcription}
                  onRequestTranscription={onRequestTranscription}
                  allowTranscription={allowTranscription}
                  translating={!!msg.translating}
                  hasTranslated={
                    typeof msg?.translated_text === "string" &&
                    msg.translated_text.length > 0
                  }
                  showingOriginal={!!msg.showing_original}
                  onTranslateClick={(_) => onTranslate?.(msg)}
                  onToggleTranslateClick={(_) => onToggleOriginal?.(msg)}
                  edited={edited}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Нижний «маяк» для авто-догрузки новых */}
      <div
        ref={bottomSentinelRef}
        aria-hidden
        style={{ height: 1, marginBottom: -1 }}
      />
    </div>
  );
}
