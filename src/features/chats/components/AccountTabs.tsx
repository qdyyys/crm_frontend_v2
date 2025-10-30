import { useEffect, useMemo, useRef, useState } from "react";
import {
  Settings,
  ChevronLeft,
  ChevronRight,
  Spline,
  LogOut,
} from "lucide-react";
import { Link } from "react-router-dom";
import ImagePreload from "@/components/ImagePreload";
import defaultAvatar from "@public/images/df_avatar.jpg";
import { Button } from "@/components/ui/button";
import { useDispatch } from "react-redux";
import { clearUser } from "@/store/UserSlice";
import { useNavigate } from "react-router-dom";

type Props = {
  user: any;
  activeTgAccount: any | null;
  onSwitch: (acc: any) => void;
  onEndWork: () => void;
  ending: boolean;
  accountRole: string | null;
};

export default function AccountTabs({
  user,
  activeTgAccount,
  onSwitch,
  onEndWork,
  ending,
  accountRole,
}: Props) {
  const accounts: any[] = useMemo(
    () =>
      Array.isArray(user?.telegram_accounts) ? user.telegram_accounts : [],
    [user?.telegram_accounts]
  );

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      ["token", "access_token", "refresh_token"].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } finally {
      dispatch(clearUser());
      navigate("/sign-in", { replace: true });
    }
  };

  const updateArrows = () => {
    const el = wrapRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanLeft(scrollLeft > 0);
    setCanRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const scrollByPage = (dir: -1 | 1) => {
    const el = wrapRef.current;
    if (!el) return;
    const items = Array.from(
      el.querySelectorAll<HTMLLIElement>("li[data-snap]")
    );
    if (!items.length) return;

    const x = el.scrollLeft;
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < items.length; i++) {
      const d = Math.abs(items[i].offsetLeft - x);
      if (d < best) {
        best = d;
        idx = i;
      }
    }

    const nextIdx = Math.min(Math.max(idx + dir, 0), items.length - 1);
    const target = items[nextIdx].offsetLeft;

    if (Math.abs(target - x) < 1) {
      const next2 = Math.min(Math.max(nextIdx + dir, 0), items.length - 1);
      el.scrollTo({ left: items[next2].offsetLeft, behavior: "smooth" });
    } else {
      el.scrollTo({ left: target, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    updateArrows();
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateArrows());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [accounts.length]);

  const normalizeLines = (tg: any): ("1" | "2")[] => {
    const out = new Set<"1" | "2">();
    const arr = Array.isArray(tg?.lines) ? tg.lines : [];
    for (const v of arr) {
      const s = String(v ?? "")
        .trim()
        .toLowerCase();
      if (s.startsWith("first") || s === "1" || s === "one") out.add("1");
      if (s.startsWith("second") || s === "2" || s === "two") out.add("2");
    }
    return Array.from(out).sort();
  };
  const linesText = (tg: any) => {
    const l = normalizeLines(tg);
    return l.length ? l.join(" | ") : null;
  };

  return (
    <header className="flex items-center justify-between gap-3 px-3 py-2 pb-2 border-b-3 border-gray-700 bg-[#0e1621]">
      {/* Левая часть: стрелки + скролл-лента */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Левая стрелка (не absolute) */}
        <button
          onClick={() => scrollByPage(-1)}
          disabled={!canLeft}
          className={[
            "outline-none p-1 rounded-lg border transition shadow cursor-pointer",
            "border-[#1e2c3a] bg-[#121a24] hover:bg-[#17212b] hover:border-[#2b5278]",
            !canLeft ? "opacity-40 cursor-default hover:bg-[#121a24]" : "",
          ].join(" ")}
          aria-label="Назад"
          title="Назад"
        >
          <ChevronLeft className="w-5 h-5 text-gray-200" />
        </button>

        {/* Лента аккаунтов */}
        <div
          ref={wrapRef}
          className="outline-none overflow-x-auto flex [--slot-gap:0.75rem] px-[calc(var(--slot-gap)/2)] snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] flex-1 min-w-0"
        >
          <ul className="flex flex-nowrap items-stretch min-w-full w-full gap-3">
            {accounts.map((acc) => {
              const isActive = acc.telegram_id === activeTgAccount?.telegram_id;
              const key =
                acc.telegram_id ??
                acc.user_id ??
                acc.id ??
                acc.phone ??
                acc.username ??
                Math.random();

              return (
                <li
                  key={key}
                  data-snap="1"
                  className={[
                    "flex-none snap-start [scroll-snap-stop:always]",
                    "basis-full max-w-full",
                    "sm:basis-[calc((100%-1*var(--slot-gap))/2)] sm:max-w-[calc((100%-1*var(--slot-gap))/2)]",
                    "md:basis-[calc((100%-2*var(--slot-gap))/3)] md:max-w-[calc((100%-2*var(--slot-gap))/3)]",
                    "xl:basis-[calc((100%-3*var(--slot-gap))/4)] xl:max-w-[calc((100%-3*var(--slot-gap))/4)]",
                  ].join(" ")}
                >
                  <button
                    onClick={() => onSwitch(acc)}
                    className={[
                      "outline-none cursor-pointer w-full h-full flex items-center",
                      "gap-3 px-3 py-1.5",
                      "rounded-lg 2xl:rounded-xl border transition text-left select-none",
                      isActive
                        ? "border-[#2b5278] bg-[#17212b] text-[#18a3e6]"
                        : "border-[#1e2c3a] bg-[#121a24] hover:bg-[#17212b] text-white/90",
                    ].join(" ")}
                    title={acc?.username || acc?.phone}
                  >
                    <ImagePreload
                      width={22}
                      height={22}
                      src={acc?.avatar || defaultAvatar}
                      className="rounded-full shrink-0"
                    />

                    <div className="min-w-0 leading-5">
                      <div className="truncate font-medium text-sm md:text-[15px]">
                        {acc?.username || acc?.phone || "Аккаунт"}
                      </div>
                      <div className="hidden sm:block text-[11px] text-gray-400 truncate">
                        {acc?.title || ""}
                      </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      {linesText(acc) && (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] text-gray-300 whitespace-nowrap"
                          title="Линии"
                        >
                          <Spline className="w-4 h-4 opacity-80" />
                          <span>{linesText(acc)}</span>
                        </span>
                      )}
                      {isActive && (
                        <span className="inline-block w-2 h-2 rounded-full bg-[#18a3e6]" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Правая стрелка (не absolute) */}
        <button
          onClick={() => scrollByPage(1)}
          disabled={!canRight}
          className={[
            "outline-none p-1 rounded-lg border transition shadow cursor-pointer",
            "border-[#1e2c3a] bg-[#121a24] hover:bg-[#17212b] hover:border-[#2b5278]",
            !canRight ? "opacity-40 cursor-default hover:bg-[#121a24]" : "",
          ].join(" ")}
          aria-label="Вперёд"
          title="Вперёд"
        >
          <ChevronRight className="w-5 h-5 text-gray-200" />
        </button>
      </div>

      {/* Правая часть: статус + кнопки */}
      <div className="flex items-center gap-2 sm:gap-2 shrink-0">
        {accountRole && (
          <span className="hidden xs:inline px-2 py-1 text-xs rounded border border-[#364153] text-gray-300 bg-[#17212b]">
            Линия: {accountRole}
          </span>
        )}

        <Link
          to="/"
          className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
          title="Настройки"
        >
          <Settings size={16} />
        </Link>

        <Button
          onClick={handleLogout}
          className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
          title="Выйти из аккаунта"
        >
          <LogOut size={16} />
        </Button>

        <Button
          onClick={onEndWork}
          disabled={ending}
          variant="outline"
          className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
        >
          {ending ? "..." : "Закончить"}
        </Button>
      </div>
    </header>
  );
}
