import { useEffect, useState } from "react";

export function useBreakpoint(query = "(max-width: 767.98px)") {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}
