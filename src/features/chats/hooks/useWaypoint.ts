import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UseWaypointOpts = {
  rootRef?: React.RefObject<HTMLElement | null>;
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
};

export function useWaypoint<T extends Element = HTMLDivElement>({
  rootRef,
  rootMargin = "0px",
  threshold = 0,
  once = false,
}: UseWaypointOpts = {}) {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const [inView, setInView] = useState(false);
  const nodeRef = useRef<T | null>(null);

  const setWaypointRef = useCallback((node: T | null) => {
    nodeRef.current = node;
  }, []);
  const ioOpts = useMemo<IntersectionObserverInit>(
    () => ({
      root: rootRef?.current ?? null,
      rootMargin,
      threshold,
    }),
    [rootRef, rootMargin, JSON.stringify(threshold)]
  );

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    if (once && inView) return;

    const observer = new IntersectionObserver(([e]) => {
      setEntry(e);
      if (e.isIntersecting) {
        setInView(true);
        if (once) observer.unobserve(node);
      } else if (!once) {
        setInView(false);
      }
    }, ioOpts);

    observer.observe(node);
    return () => observer.disconnect();
  }, [ioOpts, once, inView]);

  return { setWaypointRef, inView, entry };
}
