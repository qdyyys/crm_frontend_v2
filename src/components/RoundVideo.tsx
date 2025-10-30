import React from "react";
import clsx from "clsx";

const AUDIO_EVENT = "round-video:activate-audio";

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
    : Math.random().toString(36).slice(2);

type Props = {
  src: string;
  size?: number;
  className?: string;
};

const RoundVideo: React.FC<Props> = ({ src, size = 240, className }) => {
  const vidRef = React.useRef<HTMLVideoElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const idRef = React.useRef<string>(genId());

  const [progress, setProgress] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const [, setAudible] = React.useState(false);

  const tick = React.useCallback(() => {
    const v = vidRef.current;
    if (!v) return;
    const dur = v.duration || 0;
    const cur = v.currentTime || 0;
    if (dur > 0) setProgress(Math.min(1, Math.max(0, cur / dur)));
    if (!v.paused && !v.ended) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  React.useEffect(() => {
    const v = vidRef.current;
    if (!v) return;

    const onPlay = () => {
      setIsPaused(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setIsPaused(true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    setAudible(false);
    setIsActive(false);
    v.play().catch(() => {});

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  React.useEffect(() => {
    const onActivate = (e: Event) => {
      const det = (e as CustomEvent<{ id: string }>).detail;
      if (det?.id !== idRef.current && vidRef.current) {
        const v = vidRef.current;
        setIsActive(false);
        setAudible(false);
        v.muted = true;
        if (v.paused) v.play().catch(() => {});
      }
    };
    window.addEventListener(AUDIO_EVENT, onActivate as EventListener);
    return () =>
      window.removeEventListener(AUDIO_EVENT, onActivate as EventListener);
  }, []);

  const handleClick = () => {
    const v = vidRef.current;
    if (!v) return;

    if (!isActive) {
      setIsActive(true);
      setAudible(true);
      v.muted = false;
      v.currentTime = 0;
      setProgress(0);
      v.play().catch(() => {});
      window.dispatchEvent(
        new CustomEvent(AUDIO_EVENT, { detail: { id: idRef.current } })
      );
      return;
    }

    if (v.paused) {
      v.muted = false;
      setAudible(true);
      v.play().catch(() => {});
      window.dispatchEvent(
        new CustomEvent(AUDIO_EVENT, { detail: { id: idRef.current } })
      );
    } else {
      v.pause();
    }
  };

  const stroke = 4;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - progress);

  const showProgressRing = isActive;

  return (
    <div
      className={clsx(
        "relative inline-block select-none",
        "rounded-full",
        className
      )}
      style={{ width: size, height: size }}
      onClick={handleClick}
      aria-pressed={isActive}
    >
      <video
        ref={vidRef}
        src={`${src}`} // TODO: remove this
        muted
        loop
        playsInline
        autoPlay
        className="absolute inset-0 w-full h-full object-cover rounded-full cursor-pointer"
      />

      <svg
        className="absolute inset-0 pointer-events-none"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {showProgressRing && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.95)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            style={{
              strokeDasharray: c,
              strokeDashoffset: dash,
              transform: "rotate(-90deg)",
              transformOrigin: "50% 50%",
              transition: "stroke-dashoffset 80ms linear",
            }}
          />
        )}
      </svg>

      {isActive && isPaused && (
        <div className="absolute inset-0 rounded-full bg-black/25 grid place-items-center pointer-events-none">
          <div className="w-0 h-0 border-l-[16px] border-l-white border-y-[10px] border-y-transparent opacity-80" />
        </div>
      )}
    </div>
  );
};

export default RoundVideo;
