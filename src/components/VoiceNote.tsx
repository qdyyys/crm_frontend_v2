import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { FaPause, FaPlay } from "react-icons/fa";
import { Loader2, ChevronDown, AArrowUp } from "lucide-react";

const BAR_COUNT = 48;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_MIN = 3;
const BAR_MAX = 28;
const COLOR_FILL = "#549cd7";
const COLOR_BG = "#3a4d61";

export type MediaAudio = {
  type: "audio" | string;
  url: string;
  mime_type?: string;
  duration?: number;
  file_size?: number;
  file_name?: string;
  title?: string | null;
};

type Props = {
  item: MediaAudio;
  isSender: boolean;
  date: string;
  messageId?: number | string;
  onRequestTranscription?: (messageId: number | string) => void;
  transcribing?: boolean;
  transcription?: string;
  allowTranscription?: boolean;
};

const fmtTime = (sec?: number) => {
  if (!sec || !isFinite(sec)) return "00:00";
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

const fmtBytes = (n?: number) => {
  if (typeof n !== "number") return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

function usePeaksFromAudio(url: string, barCount = BAR_COUNT) {
  const [peaks, setPeaks] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 0.1)
  );

  useEffect(() => {
    let aborted = false;
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        const buf = await res.arrayBuffer();

        const AudioCtx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AudioCtx();
        const audio = await ctx.decodeAudioData(buf.slice(0));

        const { numberOfChannels, length } = audio;
        const data = new Float32Array(length);
        for (let ch = 0; ch < numberOfChannels; ch++) {
          const channel = audio.getChannelData(ch);
          for (let i = 0; i < length; i++)
            data[i] += channel[i] / numberOfChannels;
        }

        const win = Math.floor(length / barCount) || 1;
        const out: number[] = new Array(barCount).fill(0);
        let globalMax = 1e-6;

        for (let b = 0; b < barCount; b++) {
          const start = b * win;
          const end = b === barCount - 1 ? length : start + win;

          let peak = 0;
          let rmsAcc = 0;
          for (let i = start; i < end; i++) {
            const v = Math.abs(data[i]);
            if (v > peak) peak = v;
            rmsAcc += v * v;
          }
          const n = end - start;
          const rms = Math.sqrt(rmsAcc / Math.max(1, n));

          const val = 0.7 * rms + 0.3 * peak;
          const compressed = Math.log1p(val * 20) / Math.log1p(20);

          out[b] = compressed;
          if (compressed > globalMax) globalMax = compressed;
        }

        for (let b = 0; b < out.length; b++) {
          let v = out[b] / globalMax;
          if (b > 0 && b < out.length - 1) {
            v = (out[b - 1] * 0.15 + out[b] * 0.7 + out[b + 1] * 0.15) / 1.0;
          }
          out[b] = Math.min(1, Math.max(0, v));
        }

        if (!aborted) setPeaks(out);
        ctx.close();
      } catch {
        /* ignore waveform extraction errors */
      }
    })();

    return () => {
      aborted = true;
      ctrl.abort();
    };
  }, [url, barCount]);

  return peaks;
}

export default function VoiceNoteBubble({
  item,
  isSender,
  date,
  messageId,
  onRequestTranscription,
  transcribing,
  transcription,
  allowTranscription,
}: Props) {
  const canTranscribe = !!allowTranscription;

  const hasTranscriptValue = typeof transcription === "string";
  const hasTranscriptText = Boolean(transcription && transcription.trim());

  useEffect(() => {
    setShowTranscript(hasTranscriptText);
  }, [hasTranscriptText]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [dur, setDur] = useState<number>(item.duration || 0);

  const [tUI, setTUI] = useState(0);
  const anchorTRef = useRef(0);
  const anchorMsRef = useRef(0);
  const playingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);

  useEffect(() => {
    setShowTranscript(Boolean(transcription && transcription.trim()));
  }, [transcription]);

  const bars = usePeaksFromAudio(item.url, BAR_COUNT);

  const progress = dur > 0 ? Math.min(1, Math.max(0, tUI / dur)) : 0;
  const clipRightPercent = (1 - progress) * 100;

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      if (playingRef.current && dur > 0) {
        const now = performance.now();
        const dt = (now - anchorMsRef.current) / 1000;
        const next = Math.min(dur, anchorTRef.current + dt);
        setTUI((prev) => (Math.abs(prev - next) > 0.0005 ? next : prev));
        if (next >= dur - 1e-6) {
          playingRef.current = false;
          setIsPlaying(false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dur]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const syncAnchorsFrom = (t: number) => {
      anchorTRef.current = t;
      anchorMsRef.current = performance.now();
      setTUI(t);
    };

    const onLoaded = () => {
      const md = a.duration;
      setDur(isFinite(md) && md > 0 ? md : item.duration || 0);
      syncAnchorsFrom(a.currentTime || 0);
    };

    const onDurationChange = () => {
      const md = a.duration;
      if (isFinite(md) && md > 0) setDur(md);
    };

    const onPlay = () => {
      syncAnchorsFrom(a.currentTime || 0);
      playingRef.current = true;
      setIsPlaying(true);
    };

    const onPause = () => {
      syncAnchorsFrom(tUI);
      playingRef.current = false;
      setIsPlaying(false);
    };

    const onSeeking = () => {
      syncAnchorsFrom(a.currentTime || 0);
    };

    const onEnded = () => {
      playingRef.current = false;
      setIsPlaying(false);
      syncAnchorsFrom(dur);
    };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onDurationChange);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("seeking", onSeeking);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onDurationChange);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("seeking", onSeeking);
      a.removeEventListener("ended", onEnded);
    };
  }, [dur, tUI, item.duration]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const v = (e.clientX - rect.left) / rect.width;
    const ratio = Math.min(1, Math.max(0, v));
    const newTime = ratio * dur;
    a.currentTime = newTime;
    anchorTRef.current = newTime;
    anchorMsRef.current = performance.now();
    setTUI(newTime);
  };

  useEffect(() => {
    if (canTranscribe) setShowTranscript(hasTranscriptText);
    else setShowTranscript(false);
  }, [canTranscribe, hasTranscriptText]);

  return (
    <div
      className={clsx(
        "relative w-fit rounded-lg px-3 py-2 text-sm z-10 text-white max-w-[260px]",
        isSender ? "bg-[#2b5278]" : "bg-[#182533]",
        "after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0 after:border-[6px] after:border-transparent after:z-20",
        isSender
          ? "after:border-l-[#2b5278] after:border-b-[#2b5278]"
          : "after:border-l-[#182533] after:border-b-[#182533]"
      )}
    >
      <div className="relative min-w-[220px] max-w-[420px] w-full">
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={toggle}
            className="grid place-items-center rounded-full py-3 px-3 bg-[#3f96d0] text-white active:scale-[0.98] cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <FaPause /> : <FaPlay />}
          </button>

          <div className="flex-1 min-w-0">
            {/* waveform */}
            <div
              className="relative cursor-pointer select-none"
              style={{ height: BAR_MAX }}
              onClick={onSeek}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={dur || 0}
              aria-valuenow={tUI}
              title={item.file_name || item.title || ""}
            >
              <div
                className="absolute inset-0 flex items-center"
                style={{ gap: BAR_GAP }}
              >
                {bars.map((k, i) => (
                  <div
                    key={i}
                    className="rounded-[2px]"
                    style={{
                      width: BAR_WIDTH,
                      height: Math.max(
                        BAR_MIN,
                        Math.round(BAR_MIN + (BAR_MAX - BAR_MIN) * k)
                      ),
                      background: COLOR_BG,
                    }}
                  />
                ))}
              </div>

              <div
                className="absolute inset-0 flex items-center overflow-hidden"
                style={{
                  gap: BAR_GAP,
                  clipPath: `inset(0 ${clipRightPercent}% 0 0)`,
                }}
              >
                {bars.map((k, i) => (
                  <div
                    key={i}
                    className="rounded-[2px]"
                    style={{
                      width: BAR_WIDTH,
                      height: Math.max(
                        BAR_MIN,
                        Math.round(BAR_MIN + (BAR_MAX - BAR_MIN) * k)
                      ),
                      background: COLOR_FILL,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-1 text-[11px] tabular-nums flex items-center justify-between gap-5">
              <span className="text-[#6c7e8e] text-nowrap">
                {fmtTime(tUI)} / {fmtTime(dur)}
                {typeof item.file_size === "number" && (
                  <span> · {fmtBytes(item.file_size)}</span>
                )}
              </span>
              <span className={isSender ? "text-[#75a1cb]" : "text-[#627588]"}>
                {date}
              </span>
            </div>
          </div>

          {canTranscribe && (
            <button
              onClick={() => {
                if (transcribing) return;
                if (hasTranscriptValue) {
                  setShowTranscript((v) => !v);
                } else if (typeof messageId !== "undefined") {
                  onRequestTranscription?.(messageId);
                }
              }}
              disabled={!!transcribing}
              className="flex items-center py-1 px-2 bg-[#315f8b] text-[#4c9ce2] rounded-md mb-auto cursor-pointer"
              aria-label={
                transcribing
                  ? "Идёт расшифровка"
                  : hasTranscriptValue
                  ? showTranscript
                    ? "Скрыть транскрипцию"
                    : "Показать транскрипцию"
                  : "Запросить транскрипцию"
              }
              title={
                transcribing
                  ? "Идёт расшифровка"
                  : hasTranscriptValue
                  ? showTranscript
                    ? "Скрыть транскрипцию"
                    : "Показать транскрипцию"
                  : "Запросить транскрипцию"
              }
            >
              {transcribing ? (
                <Loader2 className="animate-spin" size={15} />
              ) : hasTranscriptValue ? (
                <ChevronDown
                  size={15}
                  className={clsx(
                    "transition-transform",
                    showTranscript ? "rotate-180" : ""
                  )}
                />
              ) : (
                <AArrowUp size={15} />
              )}
            </button>
          )}
        </div>

        {!transcribing && showTranscript && transcription && (
          <div className="mt-2 px-1 text-[13px] leading-snug whitespace-pre-wrap break-words">
            {transcription.trim() || (
              <span className="opacity-60 italic">(пустая транскрипция)</span>
            )}
          </div>
        )}
      </div>

      <audio ref={audioRef} src={item.url} preload="metadata" />
    </div>
  );
}
