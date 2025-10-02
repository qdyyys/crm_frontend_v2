import { useEffect, useMemo, useRef, useState } from "react";

export const useLogsBrowser = (allLogs: string[], chunk = 300) => {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [shown, setShown] = useState(chunk);
  const [autoLoad, setAutoLoad] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => setShown(chunk), [debounced, chunk]);

  const filtered = useMemo(() => {
    if (!debounced) return allLogs;
    const q = debounced.toLowerCase();
    return allLogs.filter((l) => String(l).toLowerCase().includes(q));
  }, [allLogs, debounced]);

  const visible = useMemo(() => filtered.slice(0, shown), [filtered, shown]);

  useEffect(() => {
    if (!autoLoad) return;
    const el = bottomRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting) {
        setShown((prev: number) => Math.min(prev + chunk, filtered.length));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [filtered.length, autoLoad, chunk]);

  return {
    query,
    setQuery,
    filtered,
    visible,
    bottomRef,
    autoLoad,
    setAutoLoad,
    shown,
    setShown,
    debounced,
  };
};
