import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  MonitorDown,
  Settings,
} from "lucide-react";

type Props = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  fit?: "cover" | "contain";
};

const formatTime = (sec: number) => {
  if (!isFinite(sec)) return "00:00";
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((sec / 60) % 60)
    .toString()
    .padStart(2, "0");
  const h = Math.floor(sec / 3600);
  return h ? `${h.toString().padStart(2, "0")}:${m}:${s}` : `${m}:${s}`;
};

function Slider({
  value,
  onScrubStart,
  onScrub,
  onScrubEnd,
  className,
  active,
}: {
  value: number;
  onScrubStart?: () => void;
  onScrub?: (v: number) => void;
  onScrubEnd?: (v: number) => void;
  className?: string;
  active?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);

  const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const posToVal = (clientX: number) => {
    const el = trackRef.current!;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width);
  };

  return (
    <div
      ref={trackRef}
      className={clsx("relative h-1 rounded bg-white/20", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={clsx(
          "absolute left-0 top-0 h-1 rounded",
          hover || focus || active ? "bg-white" : "bg-white/80",
          "transition-colors duration-150"
        )}
        style={{ width: `${value * 100}%` }}
      />

      <div
        className={clsx(
          "absolute top-1/2 -translate-y-1/2 size-3 rounded-full bg-white shadow",
          "transition-transform duration-150 origin-center",
          hover || focus || active ? "scale-100" : "scale-0"
        )}
        style={{ left: `calc(${value * 100}% - 6px)` }}
      />

      <input
        ref={inputRef}
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(value * 1000)}
        onChange={(e) => {
          const v = Number(e.target.value) / 1000;
          onScrub?.(v);
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          onScrubStart?.();
          const startV = posToVal(e.clientX);
          onScrub?.(startV);

          const move = (ev: PointerEvent) => onScrub?.(posToVal(ev.clientX));
          const finish = (ev: PointerEvent) => {
            const endV = posToVal(ev.clientX);
            onScrubEnd?.(endV);
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", finish);
            window.removeEventListener("pointercancel", finish);
            inputRef.current?.releasePointerCapture?.(e.pointerId);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", finish, { once: true });
          window.addEventListener("pointercancel", finish, { once: true });
        }}
        className="absolute inset-0 w-full h-4 opacity-0 cursor-pointer"
      />
    </div>
  );
}

export default function VideoTG({
  src,
  poster,
  autoPlay = true,
  muted = true,
  loop,
  className,
  fit = "cover",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState<number>(muted ? 0 : 0.5);
  const prevVolumeRef = useRef<number>(0.5);

  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);

  const [scrubbing, setScrubbing] = useState(false);
  const [scrubVal, setScrubVal] = useState(0);

  const [showUi, setShowUi] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafId = useRef<number | null>(null);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const p = v.play();
      if (p && typeof p.then === "function") await p;
      setIsPlaying(!v.paused);
      setAutoplayBlocked(false);
    } catch {
      setAutoplayBlocked(true);
      setIsPlaying(false);
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current!;
    if (!document.fullscreenElement) await el.requestFullscreen?.();
  }, []);
  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = isMuted;
    v.volume = volume;
    if (autoPlay) tryPlay();
  }, [autoPlay, isMuted, volume, tryPlay]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => setDuration(v.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const vv = videoRef.current;
      if (vv && !scrubbing && !vv.paused && !vv.ended) {
        setTime(vv.currentTime || 0);
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, [scrubbing]);

  useEffect(() => {
    const onFs = () => {
      const fsEl = document.fullscreenElement;
      const isOwner = fsEl === containerRef.current;

      setIsFullscreen(isOwner);

      const v = videoRef.current;
      if (!v) return;

      if (isOwner) {
        const restore = prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.5;
        v.muted = false;
        v.volume = restore;
        setIsMuted(false);
        setVolume(restore);
        if (v.paused && !autoplayBlocked) v.play().catch(() => {});
      } else {
        v.muted = true;
        setIsMuted(true);
      }
    };

    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [autoplayBlocked]);

  const pokeUi = useCallback(() => {
    if (!isFullscreen) return;
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUi(false), 2200);
  }, [isFullscreen]);
  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const handleVideoClick = async () => {
    if (!isFullscreen) {
      await enterFullscreen();
      pokeUi();
      return;
    }
    togglePlay();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isMuted || volume === 0) {
      const restore = prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.5;
      v.muted = false;
      v.volume = restore;
      setIsMuted(false);
      setVolume(restore);
    } else {
      prevVolumeRef.current = volume > 0 ? volume : prevVolumeRef.current;
      v.muted = true;
      v.volume = 0;
      setIsMuted(true);
      setVolume(0);
    }
    pokeUi();
  };
  const handleVolumeChange = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    setVolume(val);
    v.volume = val;
    if (val <= 0.0001) {
      v.muted = true;
      setIsMuted(true);
    } else {
      prevVolumeRef.current = val;
      v.muted = false;
      setIsMuted(false);
    }
  };

  const progressVal = duration ? Math.min(1, Math.max(0, time / duration)) : 0;
  const displayProgress = scrubbing ? scrubVal : progressVal;

  const startScrub = () => {
    if (!duration) return;
    setScrubbing(true);
    setScrubVal(progressVal);
  };
  const doScrub = (val: number) => {
    if (!duration) return;
    setScrubVal(val);
    setTime(val * duration);
  };
  const endScrub = (val: number) => {
    const v = videoRef.current;
    if (!v || !duration) {
      setScrubbing(false);
      return;
    }
    const t = val * duration;
    v.currentTime = t;
    setTime(t);
    setScrubbing(false);
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      await enterFullscreen();
    } else {
      await exitFullscreen();
    }
    pokeUi();
  };

  const handleDoubleClick = async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
      pokeUi();
    }
  };

  const requestPiP = async () => {
    const v = videoRef.current as any;
    if (v?.requestPictureInPicture) {
      try {
        await v.requestPictureInPicture();
      } catch {
        /* ignore PiP error */
      }
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const log: (msg: string) => void = () => {
      /* noop for production */
    };

    const onPlay = () => log("onPlay");
    const onPause = () => log("onPause");
    const onVolume = () => log("onVolumeChange");
    const onLoaded = () => log("onLoadedMetadata");

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("loadedmetadata", onLoaded);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("loadedmetadata", onLoaded);
    };
  }, []);

  useEffect(() => {
    const onFs = () => {
      const fsEl = document.fullscreenElement;
      const isOwner = fsEl === containerRef.current;
      setIsFullscreen(isOwner);

      const v = videoRef.current;
      if (!v) return;

      if (isOwner) {
        const restore = prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.5;
        v.muted = false;
        v.volume = restore;
        setIsMuted(false);
        setVolume(restore);
        if (v.paused && !autoplayBlocked) v.play().catch(() => {});
      } else {
        v.muted = true;
        setIsMuted(true);
      }
    };

    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [autoplayBlocked]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "group relative bg-black overflow-hidden select-none",
        "touch-manipulation",
        className
      )}
      onMouseMove={() => isFullscreen && setShowUi(true)}
      onMouseLeave={() => isFullscreen && setShowUi(false)}
      onTouchStart={pokeUi}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        muted={isMuted}
        playsInline
        autoPlay={autoPlay}
        className={clsx(
          "w-full h-full",
          fit === "cover" ? "" : "",
          isFullscreen ? "object-contain" : "object-cover",
          !isFullscreen && "cursor-pointer "
        )}
        onClick={handleVideoClick}
        onDoubleClick={handleDoubleClick}
        onLoadedMetadata={(e) =>
          setDuration((e.currentTarget as HTMLVideoElement).duration || 0)
        }
      />

      <div className="absolute left-2 top-2 flex items-center gap-1">
        <span className="px-1.5 py-0.5 rounded text-[11px] leading-none text-white bg-black/60 backdrop-blur-sm">
          {formatTime(time || duration || 0)}
        </span>
        <button
          aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
          onClick={toggleMute}
          className="p-1 rounded bg-black/60 text-white hover:bg-black/70 active:scale-[0.98]"
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={16} />
          ) : (
            <Volume2 size={16} />
          )}
        </button>
      </div>

      {autoplayBlocked && (
        <button
          onClick={tryPlay}
          className="absolute inset-0 m-auto grid place-items-center text-white/90"
        >
          <span className="p-4 rounded-full bg-black/50">
            <Play size={28} />
          </span>
        </button>
      )}

      {isFullscreen && (
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 bottom-0 p-2 md:p-3 transition-opacity",
            showUi ? "opacity-100" : "opacity-0",
            "group-hover:opacity-100"
          )}
        >
          <div className="pointer-events-auto rounded-xl bg-black/70 px-3 py-2 text-white shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-44">
                <button
                  onClick={toggleMute}
                  className="p-1 rounded hover:bg-white/10"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={16} />
                  ) : (
                    <Volume2 size={16} />
                  )}
                </button>
                <Slider
                  value={volume}
                  onScrub={(v) => handleVolumeChange(v)}
                  onScrubEnd={(v) => handleVolumeChange(v)}
                  className="w-full"
                  active={false}
                />
              </div>

              <button
                onClick={togglePlay}
                className="p-1.5 rounded hover:bg-white/10"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleFullscreen}
                  className="p-1 rounded hover:bg-white/10"
                >
                  {isFullscreen ? (
                    <Minimize2 size={18} />
                  ) : (
                    <Maximize2 size={18} />
                  )}
                </button>
                <button
                  onClick={requestPiP}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <MonitorDown size={18} />
                </button>
                <button className="p-1 rounded hover:bg-white/10">
                  <Settings size={18} />
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <span className="text-[12px] tabular-nums">00:00</span>
              <Slider
                value={displayProgress}
                onScrubStart={startScrub}
                onScrub={doScrub}
                onScrubEnd={endScrub}
                className="flex-1"
                active={scrubbing}
              />
              <span className="text-[12px] tabular-nums">
                -{formatTime(Math.max(0, duration - time) || 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
