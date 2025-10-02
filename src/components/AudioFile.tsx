import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { MediaAudio } from "./VoiceNote";
import { FaPause, FaPlay } from "react-icons/fa";

const fmtTime = (sec?: number) => {
  if (!sec || !isFinite(sec)) return "00:00";
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

type Props = {
  item: MediaAudio;
  isSender: boolean;
  date: string;
};

const BUS_EVENT = "chat-audio-play";

export default function AudioFileBubble({ item, isSender, date }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dur, setDur] = useState<number>(item.duration || 0);
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const isScrubbingRef = useRef(false);

  const id = useMemo(
    () => `${item.url}::${item.file_name || ""}`,
    [item.url, item.file_name]
  );

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => setDur(a.duration || item.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      if (!isScrubbingRef.current) setT(a.currentTime || 0);
    };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTimeUpdate);

    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      if (!a.paused && !isScrubbingRef.current) setT(a.currentTime || 0);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const onBus = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail?.id !== id && !a.paused) a.pause();
    };
    window.addEventListener(BUS_EVENT, onBus as EventListener);

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTimeUpdate);
      window.removeEventListener(BUS_EVENT, onBus as EventListener);
    };
  }, [id, item.duration]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      window.dispatchEvent(new CustomEvent(BUS_EVENT, { detail: { id } }));
      a.play().catch(() => {
        /* ignore play error */
      });
    } else {
      a.pause();
    }
  };

  const seekToClientX = (clientX: number) => {
    const a = audioRef.current;
    const bar = barRef.current;
    if (!a || !bar || !dur) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = ratio * dur;
    setT(a.currentTime);
  };

  const onBarPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    isScrubbingRef.current = true;
    seekToClientX(e.clientX);
  };
  const onBarPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!isScrubbingRef.current) return;
    seekToClientX(e.clientX);
  };
  const onBarPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore releasePointerCapture error */
    }
    isScrubbingRef.current = false;
  };
  const onBarClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    seekToClientX(e.clientX);
  };

  const progress = dur ? Math.min(1, Math.max(0, t / dur)) : 0;
  const title = item.title || item.file_name || "Аудио";

  return (
    <div
      className={clsx(
        "w-fit rounded-lg px-3 py-2 text-sm relative z-10 text-white mb-1",
        isSender ? "bg-[#2b5278]" : "bg-[#182533]",
        "after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0 after:border-[6px] after:border-transparent after:z-20",
        isSender
          ? "after:border-l-[#2b5278] after:border-b-[#2b5278]"
          : "after:border-l-[#182533] after:border-b-[#182533]"
      )}
    >
      <div className="flex items-center gap-3 min-w-[240px] max-w-[480px]">
        <button
          onClick={toggle}
          className="grid place-items-center rounded-full w-10 h-10 bg-[#3f96d0] text-white active:scale-[0.98] cursor-pointer"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{title}</div>

          <div className="text-[11px] text-[#6c7e8e] mt-0.5 opacity-80 flex items-center justify-between">
            <span>{fmtTime(dur || t)}</span>
            <span
              className={clsx(
                "ml-3",
                isSender ? "text-[#bcd4f0]" : "text-[#9bb1c9]"
              )}
            >
              {date}
            </span>
          </div>

          <div
            ref={barRef}
            className="mt-2 h-1.5 rounded bg-white/20 overflow-hidden cursor-pointer select-none"
            role="slider"
            aria-label="Позиция воспроизведения"
            aria-valuemin={0}
            aria-valuemax={dur || 0}
            aria-valuenow={t}
            onPointerDown={onBarPointerDown}
            onPointerMove={onBarPointerMove}
            onPointerUp={onBarPointerUp}
            onClick={onBarClick}
          >
            <div
              className="h-full bg-white/70"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={item.url} preload="metadata" />
    </div>
  );
}
