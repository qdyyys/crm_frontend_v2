import { useEffect, useRef, useState } from "react";
import type { CtxMenu } from "../types";

type AnyEventLike =
  | React.MouseEvent
  | MouseEvent
  | TouchEvent
  | {
      clientX?: number;
      clientY?: number;
      pageX?: number;
      pageY?: number;
      touches?: Array<{ clientX: number; clientY: number }>;
      preventDefault?: () => void;
      stopPropagation?: () => void;
    };

export function useCtxMenu() {
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ctxMenuRef.current) return setCtxMenu(null);
      if (!ctxMenuRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setCtxMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const getPos = (e: AnyEventLike) => {
    const t = (e as any)?.touches?.[0];
    if (t) return { x: t.clientX, y: t.clientY };
    const x = (e as any)?.clientX ?? (e as any)?.pageX ?? 0;
    const y = (e as any)?.clientY ?? (e as any)?.pageY ?? 0;
    return { x, y };
  };

  const openCtxMenu = (e: AnyEventLike, msg: any) => {
    try {
      (e as any)?.preventDefault?.();
    } catch {
      /* ignore */
    }
    try {
      (e as any)?.stopPropagation?.();
    } catch {
      /* ignore */
    }
    const { x, y } = getPos(e);
    setCtxMenu({ x, y, msg });
  };

  return { ctxMenu, setCtxMenu, ctxMenuRef, openCtxMenu };
}
