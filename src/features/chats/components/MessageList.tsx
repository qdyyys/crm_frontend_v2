import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import ChatBubble from "@/components/BubbleMsg";
import { formatDayTitle, isSameDay } from "@/features/utils/dates";
import { buildServiceLabel } from "@/features/utils/serviceMessage";
import { normalizeMediaArray } from "@/features/utils/media";

const DEBUG = false;
const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

function ts() {
  const n = typeof performance !== "undefined" ? performance.now() : Date.now();
  return `${(n - t0).toFixed(1)}ms`;
}

function snap(el: HTMLDivElement | null, extra: Record<string, any> = {}) {
  const sTop = el?.scrollTop ?? -1;
  const sH = el?.scrollHeight ?? -1;
  const cH = el?.clientHeight ?? -1;
  const dist = sH >= 0 && cH >= 0 && sTop >= 0 ? sH - (sTop + cH) : -1;
  return {
    timestamp: ts(),
    scrollTop: Math.round(sTop),
    scrollHeight: sH,
    clientHeight: cH,
    distToBottom: Math.round(dist),
    ...extra,
  };
}

function logGroup(title: string, ...args: any[]) {
  if (!DEBUG) return;
  console.groupCollapsed(title);
  if (args.length) console.log(...args);
  console.groupEnd();
}

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
      className="
        px-3 py-1 text-[12px] rounded-full bg-[#1e2c3a] font-semibold select-none
        inline-block max-w-[50%] truncate overflow-hidden whitespace-nowrap
      "
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </span>
  </div>
);

function cmpMsg(a: any, b: any) {
  const ta = Date.parse(a.date);
  const tb = Date.parse(b.date);
  if (ta !== tb) return ta - tb;
  const ia = Number(a.id) || 0;
  const ib = Number(b.id) || 0;
  return ia - ib;
}

export default function MessageList({
  messages,
  openCtxMenu,
  msgRefs,
  onLoadOlder,
  isLoadingOlder,
  hasMoreOlder,
  chatKey,
  onRequestTranscription,
  allowTranscription,

  onTranslate,
  onToggleOriginal,
}: {
  messages: any[];
  openCtxMenu: (e: React.MouseEvent, msg: any) => void;
  msgRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  onLoadOlder: () => void;
  isLoadingOlder: boolean;
  hasMoreOlder: boolean;
  chatKey?: string | number | null;
  onRequestTranscription?: (messageId: number | string) => void;
  allowTranscription?: boolean;

  onTranslate?: (m: any) => void;
  onToggleOriginal?: (m: any) => void;
}) {
  const allowFetchOlderRef = useRef(false);
  const bottomVisibleRef = useRef(false);
  const progScrollDeadlineRef = useRef(0);

  const sorted = useMemo(() => [...messages].sort(cmpMsg), [messages]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const shouldStickRef = useRef(true);
  const roRef = useRef<ResizeObserver | null>(null);
  const bottomIORef = useRef<IntersectionObserver | null>(null);

  const STICK_THRESHOLD = 120;
  const TOP_THRESHOLD = 80;
  const prependInProgressRef = useRef(false);
  const prevHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const prevLenRef = useRef(0);

  const computeStick = () => {
    const el = wrapRef.current;
    if (!el) return;
    const dist = el.scrollHeight - (el.scrollTop + el.clientHeight);
    const prev = shouldStickRef.current;
    shouldStickRef.current = dist < STICK_THRESHOLD;
    if (DEBUG && prev !== shouldStickRef.current) {
      logGroup(
        `%c[Scroll]%c computeStick → ${
          shouldStickRef.current ? "STICK" : "FREE"
        }`,
        snap(el, { STICK_THRESHOLD, dist })
      );
    }
  };

  const onScroll = () => {
    const el = wrapRef.current;
    if (!el) return;
    computeStick();

    const now = Date.now();
    const underProgrammaticScroll = now < progScrollDeadlineRef.current;

    logGroup(
      "%c[Scroll]%c onScroll (user)",
      snap(el, {
        allowFetchOlder: allowFetchOlderRef.current,
        hasMoreOlder,
        isLoadingOlder,
        prependInProgress: prependInProgressRef.current,
        shouldStick: shouldStickRef.current,
        underProgrammaticScroll,
      })
    );

    if (underProgrammaticScroll) return;

    if (!allowFetchOlderRef.current) return;

    if (
      el.scrollTop <= TOP_THRESHOLD &&
      hasMoreOlder &&
      !isLoadingOlder &&
      !prependInProgressRef.current
    ) {
      logGroup(
        "%c[Scroll]%c onScroll → trigger onLoadOlder",
        snap(el, {
          reason: "near top",
          TOP_THRESHOLD,
          prevHeight: el.scrollHeight,
          prevScrollTop: el.scrollTop,
          prevLen: sorted.length,
        })
      );
      prevHeightRef.current = el.scrollHeight;
      prevScrollTopRef.current = el.scrollTop;
      prevLenRef.current = sorted.length;
      prependInProgressRef.current = true;
      onLoadOlder();
    }
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!prependInProgressRef.current) return;
    if (sorted.length <= prevLenRef.current) return;

    requestAnimationFrame(() => {
      const newHeight = el.scrollHeight;
      const delta = newHeight - prevHeightRef.current;

      logGroup(
        "%c[Scroll]%c prepend apply (compensate delta)",
        snap(el, {
          newHeight,
          prevHeight: prevHeightRef.current,
          delta,
          setScrollTopTo: prevScrollTopRef.current + delta,
        })
      );

      el.scrollTop = prevScrollTopRef.current + delta;
      prependInProgressRef.current = false;
    });
  }, [sorted.length]);

  const smoothToBottom = () => {
    const el = wrapRef.current;
    if (!el) return;
    const top = el.scrollHeight - el.clientHeight;

    logGroup("%c[Scroll]%c smoothToBottom()", snap(el, { targetTop: top }));

    progScrollDeadlineRef.current = Date.now() + 700;
    el.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    bottomIORef.current?.disconnect();
    if (!endRef.current) return;

    bottomIORef.current = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((e) => e.isIntersecting);
        bottomVisibleRef.current = isVisible;

        if (isVisible && !allowFetchOlderRef.current) {
          allowFetchOlderRef.current = true;
          logGroup(
            "%c[Scroll]%c allowFetchOlder enabled (bottom visible)",
            snap(wrapRef.current)
          );
        }
      },
      { root: wrapRef.current, threshold: 0.01 }
    );

    bottomIORef.current.observe(endRef.current);
    return () => bottomIORef.current?.disconnect();
  }, [chatKey]);

  useEffect(() => {
    computeStick();

    logGroup("%c[Scroll]%c enter chat", {
      t: ts(),
      chatKey,
      ...snap(wrapRef.current, { phase: "init before RAFs" }),
    });

    allowFetchOlderRef.current = false;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (shouldStickRef.current) smoothToBottom();
      });
    });

    prependInProgressRef.current = false;
    prevLenRef.current = sorted.length;
    bottomVisibleRef.current = false;
  }, [chatKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (prependInProgressRef.current) return;

    computeStick();

    const isFirstFill = el.scrollHeight > el.clientHeight && el.scrollTop === 0;

    if (isFirstFill || shouldStickRef.current) {
      logGroup(
        "%c[Scroll]%c messages.length changed → smoothToBottom",
        snap(el, {
          isFirstFill,
          shouldStick: shouldStickRef.current,
          reason: isFirstFill ? "first fill" : "stick",
        })
      );
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          smoothToBottom();
        });
      });
    } else {
      logGroup(
        "%c[Scroll]%c messages.length changed → no scroll",
        snap(el, {
          isFirstFill,
          shouldStick: shouldStickRef.current,
        })
      );
    }
  }, [messages.length]);

  useEffect(() => {
    computeStick();
    logGroup(
      "%c[Scroll]%c mount → initial smooth (if stick)",
      snap(wrapRef.current)
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (shouldStickRef.current) smoothToBottom();
      });
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    roRef.current?.disconnect();
    roRef.current = new ResizeObserver(() => {
      logGroup(
        "%c[Scroll]%c RO: content size changed",
        snap(el, {
          shouldStick: shouldStickRef.current,
          prependInProgress: prependInProgressRef.current,
        })
      );
      if (shouldStickRef.current && !prependInProgressRef.current) {
        smoothToBottom();
      }
    });
    roRef.current.observe(el);
    return () => roRef.current?.disconnect();
  }, []);

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

    const getKey = (m: any) => {
      const u = m?.from_user ?? {};
      return (
        String(u.id ?? "") ||
        String(u.peer_id ?? "") ||
        (u.username ? `@${u.username.toLowerCase()}` : "")
      );
    };

    const ka = getKey(a);
    const kb = getKey(b);

    if (ka && kb) return ka === kb;
    return true;
  };

  const lpTimer = useRef<number | null>(null);

  const startLongPress = (e: React.TouchEvent, msg: any) => {
    if (lpTimer.current) window.clearTimeout(lpTimer.current);
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;

    lpTimer.current = window.setTimeout(() => {
      openCtxMenu(
        { preventDefault() {}, clientX: startX, clientY: startY } as any,
        msg
      );
    }, 500);
  };

  const cancelLongPress = () => {
    if (lpTimer.current) {
      window.clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
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

  return (
    <div
      ref={wrapRef}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-2 flex flex-col tg-scroll"
    >
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

        return (
          <div key={`wrap-${msg.id}`} className={clsx("flex flex-col", mt)}>
            {needSeparator && <DaySeparator label={formatDayTitle(d)} />}

            {msg.message_type === "service_message" ? (
              <SystemNotice>{buildServiceLabel(msg, sorted, idx)}</SystemNotice>
            ) : (
              <div
                ref={(el) => {
                  const idNum =
                    typeof msg.id === "number" ? msg.id : Number(msg.id);
                  if (!Number.isNaN(idNum)) msgRefs.current[idNum] = el;
                }}
                className="inline-block"
                onContextMenu={(e) => openCtxMenu(e, msg)}
                onTouchStart={(e) => startLongPress(e, msg)}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onTouchMove={cancelLongPress}
                title="ПКМ / Долгое удержание — меню"
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
                  isRead={
                    msg.is_outgoing ? normalizeIsRead(msg.is_read) : undefined
                  }
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
      <div ref={endRef} />
    </div>
  );
}
