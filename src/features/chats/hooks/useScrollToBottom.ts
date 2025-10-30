import { useCallback, useEffect, useRef } from "react";

type ScrollBehavior = "auto" | "smooth";

export type UseScrollToBottomOpts = {
  nearBottomOffset?: number;
  behavior?: ScrollBehavior;
  waitImagesOnReady?: boolean;
  logEnabled?: boolean;
};

export function useScrollToBottom(
  scrollerRef: React.RefObject<HTMLElement | null>,
  {
    nearBottomOffset = 32,
    behavior = "auto",
    waitImagesOnReady = false,
    logEnabled = false,
  }: UseScrollToBottomOpts = {}
) {
  const LOG = logEnabled;

  const isUserNearBottomRef = useRef(true);
  const lastReadyKeyRef = useRef<string | number | null>(null);

  const dbgDims = (el: HTMLElement | null) =>
    el
      ? {
          scrollTop: Math.round(el.scrollTop),
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          atBottom: Math.round(
            el.scrollHeight - el.clientHeight - el.scrollTop
          ),
        }
      : {};

  const log = (...a: any[]) => LOG && console.log("[scroll]", ...a);
  const group = (t: string) => LOG && console.groupCollapsed(`[scroll] ${t}`);
  const end = () => LOG && console.groupEnd();

  const isNearBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    const diff = el.scrollHeight - el.clientHeight - el.scrollTop;
    return diff <= nearBottomOffset;
  }, [scrollerRef, nearBottomOffset]);

  const scrollToBottom = useCallback(
    (b: ScrollBehavior = behavior) => {
      const el = scrollerRef.current;
      if (!el) return;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: b });
      });
    },
    [scrollerRef, behavior]
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const near = isNearBottom();
      isUserNearBottomRef.current = near;
      if (LOG) log("nearBottom:", near, dbgDims(el));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollerRef, isNearBottom]);

  const waitForReady = useCallback(async () => {
    const el = scrollerRef.current;
    if (!el) return;

    group("waitForReady()");
    log("start", dbgDims(el));

    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const observedGrowth = await new Promise<boolean>((resolve) => {
      let grew = false;
      let lastH = el.scrollHeight;

      if ("ResizeObserver" in window) {
        const ro = new ResizeObserver(() => {
          const h = el.scrollHeight;
          if (h !== lastH) {
            grew = true;
            lastH = h;
          }
        });
        ro.observe(el);
        requestAnimationFrame(() => {
          ro.disconnect();
          resolve(grew);
        });
      } else {
        resolve(false);
      }
    });

    let stable = 0;
    let prevH = -1;
    for (let i = 0; i < 24; i++) {
      const h = el.scrollHeight;
      stable = h === prevH ? stable + 1 : 0;
      prevH = h;
      if (stable >= 2) break;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
    log("height stabilized", dbgDims(el), "growthObserved:", observedGrowth);

    if (waitImagesOnReady) {
      const imgs = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
      const need = imgs.filter((im) => !im.complete || im.naturalHeight === 0);
      if (need.length) {
        log("decode images:", need.length);
        try {
          await Promise.allSettled(
            need.map((im) => (im.decode ? im.decode() : Promise.resolve()))
          );
          log("images decoded");
        } catch (e) {
          log("decode error", e);
        }
      }
    }

    log("ready", dbgDims(el));
    end();
  }, [scrollerRef, waitImagesOnReady]);

  /**
   * ОДНОРАЗОВЫЙ автоскролл вниз, когда контент готов.
   * Выстреливает ровно один раз на каждый readyKey.
   */
  const scrollToBottomWhenReady = useCallback(
    async (readyKey: string | number, b: ScrollBehavior = behavior) => {
      const el = scrollerRef.current;
      group("scrollToBottomWhenReady()");
      log("readyKey:", readyKey, "last:", lastReadyKeyRef.current);

      lastReadyKeyRef.current = readyKey;

      await waitForReady();

      if (!el) {
        log("no element");
        end();
        return;
      }

      log("do scroll", { behavior: b, dims: dbgDims(el) });
      el.scrollTo({ top: el.scrollHeight, behavior: b });
      log("requested → top:", el.scrollHeight);
      end();
    },
    [behavior, waitForReady]
  );

  /** «липкий» скролл — зови при приходе новых сообщений */
  const stickToBottomIfNear = useCallback(
    (b: ScrollBehavior = behavior) => {
      if (isUserNearBottomRef.current) scrollToBottom(b);
    },
    [scrollToBottom, behavior]
  );

  /** сбросить lastReadyKey (например, при полном демонтировании списка) */
  const resetScrollKey = useCallback(() => {
    lastReadyKeyRef.current = null;
  }, []);

  return {
    scrollToBottom,
    stickToBottomIfNear,
    isNearBottom,
    scrollToBottomWhenReady,
    resetScrollKey,
  };
}
