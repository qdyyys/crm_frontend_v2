import { useCallback, useEffect, useRef } from "react";

type ScrollBehavior = "auto" | "smooth";

export type useScrollToMessageCenterOpts = {
  nearBottomOffset?: number;
  behavior?: ScrollBehavior;
  waitImagesOnReady?: boolean;
  logEnabled?: boolean;
  minIntervalMs?: number;
};

export function useScrollToMessageCenter(
  scrollerRef: React.RefObject<HTMLElement | null>,
  {
    nearBottomOffset = 32,
    behavior = "auto",
    waitImagesOnReady = false,
    logEnabled = false,
    minIntervalMs = 0,
  }: useScrollToMessageCenterOpts = {}
) {
  const LOG = logEnabled;

  const isUserNearBottomRef = useRef(true);
  const lastRunAtRef = useRef(0);

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

  const sleepRaf = () =>
    new Promise<void>((r) => requestAnimationFrame(() => r()));

  const waitForNode = async (
    resolver: () => HTMLElement | null | undefined,
    tries = 120
  ) => {
    for (let i = 0; i < tries; i++) {
      const n = resolver() ?? null;
      if (n) return n as HTMLElement;
      await sleepRaf();
    }
    return null;
  };

  const relativeTop = useCallback(
    (scroller: HTMLElement, node: HTMLElement) => {
      const sRect = scroller.getBoundingClientRect();
      const nRect = node.getBoundingClientRect();
      return nRect.top - sRect.top + scroller.scrollTop;
    },
    []
  );

  const waitForReady = useCallback(async () => {
    const el = scrollerRef.current;
    if (!el) return;

    group("waitForReady()");
    log("start", dbgDims(el));

    await sleepRaf();
    await sleepRaf();

    let stable = 0;
    let prevH = -1;
    for (let i = 0; i < 24; i++) {
      const h = el.scrollHeight;
      stable = h === prevH ? stable + 1 : 0;
      prevH = h;
      if (stable >= 2) break;
      await sleepRaf();
    }

    if (waitImagesOnReady) {
      const imgs = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
      const need = imgs.filter((im) => !im.complete || im.naturalHeight === 0);
      if (need.length) {
        try {
          await Promise.allSettled(
            need.map((im) => (im.decode ? im.decode() : Promise.resolve()))
          );
        } catch {}
      }
    }

    log("ready", dbgDims(el));
    end();
  }, [scrollerRef, waitImagesOnReady]);

  const _center = useCallback(
    (el: HTMLElement, node: HTMLElement, b: ScrollBehavior) => {
      const nodeH = node.clientHeight || node.offsetHeight || 0;
      const top = relativeTop(el, node);
      const target = top - (el.clientHeight - nodeH) / 2;
      el.scrollTo({ top: Math.max(0, target), behavior: b });
      return { top, target };
    },
    [relativeTop]
  );

  const scrollToMessageCenterWhenReady = useCallback(
    async (
      _readyKey: string | number,
      resolver: () => HTMLElement | null | undefined,
      b: ScrollBehavior = behavior,
      opts?: { tries?: number }
    ) => {
      const el = scrollerRef.current;
      group("scrollToMessageCenterWhenReady()");

      const now = Date.now();
      if (minIntervalMs > 0 && now - lastRunAtRef.current < minIntervalMs) {
        log("skip (rate-limited)");
        end();
        return;
      }
      lastRunAtRef.current = now;

      await waitForReady();

      if (!el) {
        log("no element");
        end();
        return;
      }

      const node = await waitForNode(resolver, opts?.tries ?? 120);
      if (!node) {
        log("node not found");
        end();
        return;
      }

      const { top, target } = _center(el, node, b);
      log("do center", { behavior: b, dims: dbgDims(el), top, target });
      end();
    },
    [behavior, waitForReady, scrollerRef, _center, minIntervalMs]
  );

  /** Мгновенное центрирование (1 rAF), без ожиданий. */
  const scrollToMessageCenterNow = useCallback(
    async (
      resolver: () => HTMLElement | null | undefined,
      b: ScrollBehavior = behavior,
      opts?: { tries?: number }
    ) => {
      const el = scrollerRef.current;
      group("scrollToMessageCenterNow()");

      const now = Date.now();
      if (minIntervalMs > 0 && now - lastRunAtRef.current < minIntervalMs) {
        log("skip (rate-limited)");
        end();
        return;
      }
      lastRunAtRef.current = now;

      await sleepRaf();

      if (!el) {
        log("no element");
        end();
        return;
      }

      const node = await waitForNode(resolver, opts?.tries ?? 30);
      if (!node) {
        log("node not found (now)");
        end();
        return;
      }

      const { top, target } = _center(el, node, b);
      log("do center NOW", { behavior: b, dims: dbgDims(el), top, target });
      end();
    },
    [behavior, scrollerRef, _center, minIntervalMs]
  );

  const stickToBottomIfNear = useCallback(
    (b: ScrollBehavior = behavior) => {
      if (isUserNearBottomRef.current) scrollToBottom(b);
    },
    [scrollToBottom, behavior]
  );

  return {
    scrollToBottom,
    stickToBottomIfNear,
    isNearBottom,

    scrollToMessageCenterWhenReady,
    scrollToMessageCenterNow,
  };
}
