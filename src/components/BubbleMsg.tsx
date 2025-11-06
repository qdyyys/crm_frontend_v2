import React from "react";
import clsx from "clsx";
import ImagePreload from "@/components/ImagePreload";
import { TgsSticker } from "@/components/TgsSticker";
import VideoTG from "./VideoTG";
import VoiceNoteBubble, { type MediaAudio } from "./VoiceNote";
import AudioFileBubble from "./AudioFile";
import RoundVideo from "./RoundVideo";
import { BsPinAngleFill } from "react-icons/bs";
import { Check, CheckCheck, Languages, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

type MediaItem = {
  type:
    | "photo"
    | "video"
    | "round_video"
    | "sticker"
    | "document"
    | "animation"
    | "audio"
    | string;
  url: string;
  width?: number;
  height?: number;
  file_name?: string;
  mime_type?: string;
  duration?: number;
  file_size?: number;
  title?: string;

  id?: number | string;
  file_id?: number | string;
  _key?: string;
};

const hasExt = (nameOrUrl: string | undefined, exts: string[]) =>
  !!nameOrUrl && new RegExp(`\\.(${exts.join("|")})$`, "i").test(nameOrUrl);

const isVideoMime = (m?: string) => !!m && m.startsWith("video/");
const isImageMime = (m?: string) => !!m && m.startsWith("image/");

const isStickerTgs = (m: MediaItem) =>
  m.type === "sticker" &&
  (m.mime_type === "application/x-tgsticker" ||
    hasExt(m.file_name, ["tgs"]) ||
    hasExt(m.url, ["tgs"]));

const isStickerVideo = (m: MediaItem) =>
  m.type === "sticker" &&
  (m.mime_type === "video/webm" ||
    isVideoMime(m.mime_type) ||
    hasExt(m.file_name, ["webm"]) ||
    hasExt(m.url, ["webm"]));

const isStickerStatic = (m: MediaItem) =>
  m.type === "sticker" &&
  (isImageMime(m.mime_type) ||
    hasExt(m.file_name, ["webp", "png", "jpg", "jpeg"]) ||
    hasExt(m.url, ["webp", "png", "jpg", "jpeg"]));

const isAnimationGif = (m: MediaItem) =>
  m.type === "animation" &&
  (isVideoMime(m.mime_type) ||
    hasExt(m.file_name, ["mp4", "webm", "mov", "m4v"]) ||
    hasExt(m.url, ["mp4", "webm", "mov", "m4v"]));

const isRoundVideo = (m: MediaItem) => m.type === "round_video";

const isDocAnimationGif = (m: MediaItem) =>
  m.type === "document" &&
  (isVideoMime(m.mime_type) ||
    hasExt(m.file_name, ["mp4", "webm"]) ||
    hasExt(m.url, ["mp4", "webm"])) &&
  (m.file_name === "document" || !m.file_name) &&
  (m.file_size === undefined || m.file_size <= 1_500_000);

const isNormalVideo = (m: MediaItem) =>
  (m.type === "video" ||
    (m.type === "document" &&
      (isVideoMime(m.mime_type) ||
        hasExt(m.file_name, ["mp4", "webm", "mov", "m4v"]) ||
        hasExt(m.url, ["mp4", "webm", "mov", "m4v"])) &&
      !isDocAnimationGif(m))) &&
  !isRoundVideo(m);

const isVoiceNote = (m: MediaItem) =>
  m.type === "audio" && /^audio\/ogg/i.test(m.mime_type || "") && !m.title;

const isAudioFile = (m: MediaItem) => m.type === "audio" && !isVoiceNote(m);

const isSpecialMedia = (m: MediaItem) =>
  isRoundVideo(m) ||
  isVoiceNote(m) ||
  isAudioFile(m) ||
  isStickerTgs(m) ||
  isStickerStatic(m) ||
  isStickerVideo(m) ||
  isDocAnimationGif(m) ||
  isAnimationGif(m);

const isGridMedia = (m: MediaItem) => m.type === "photo" || isNormalVideo(m);

type Row = { items: number[]; height: number; widths: number[] };

function buildRows(
  items: { width?: number; height?: number }[],
  containerWidth: number,
  targetRowH = 242,
  minH = 176,
  maxH = 286,
  minPerRow = 1,
  maxPerRow = 3,
  gapPx = 5
): Row[] {
  const ars = items.map((m) => {
    const ar = m.width && m.height ? m.width / m.height : 1;
    return Math.max(0.333, Math.min(3, ar));
  });

  const rows: Row[] = [];
  let i = 0;

  while (i < ars.length) {
    let rowArSum = 0;
    let j = i;

    while (j < ars.length && j - i < maxPerRow) {
      rowArSum += ars[j];
      const count = j - i + 1;
      const available = containerWidth - gapPx * (count - 1);
      const h = available / rowArSum;
      if (h <= targetRowH && count >= minPerRow) break;
      j++;
    }

    if (j >= ars.length) j = ars.length - 1;
    j = Math.max(i + minPerRow - 1, j);

    const slice = ars.slice(i, j + 1);
    const count = slice.length;
    const available = containerWidth - gapPx * (count - 1);
    const rawH = available / slice.reduce((a, b) => a + b, 0);
    const height = Math.max(minH, Math.min(maxH, rawH));

    const widths = slice.map((ar) => Math.round(ar * height));
    const sum = widths.reduce((a, b) => a + b, 0);
    if (sum !== available && widths.length > 0) {
      widths[widths.length - 1] += available - sum;
    }

    rows.push({
      items: Array.from({ length: count }, (_, k) => i + k),
      height,
      widths,
    });
    i = j + 1;
  }

  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last.items.length === 1 && prev.items.length > 1) {
      const moved = prev.items.pop()!;
      last.items.unshift(moved);
      const availablePrev = containerWidth - gapPx * (prev.items.length - 1);
      const sumPrevAr = prev.items
        .map((idx) => {
          const m = items[idx];
          const ar = m.width && m.height ? m.width / m.height : 1;
          return Math.max(0.333, Math.min(3, ar));
        })
        .reduce((a, b) => a + b, 0);
      prev.height = Math.max(minH, Math.min(maxH, availablePrev / sumPrevAr));
      prev.widths = prev.items.map((idx) => {
        const m = items[idx];
        const ar = m.width && m.height ? m.width / m.height : 1;
        const clamped = Math.max(0.333, Math.min(3, ar));
        return Math.round(clamped * prev.height);
      });
      const fixPrevSum = prev.widths.reduce((a, b) => a + b, 0);
      if (fixPrevSum !== availablePrev && prev.widths.length > 0) {
        prev.widths[prev.widths.length - 1] += availablePrev - fixPrevSum;
      }
    }
  }

  return rows;
}

function MediaGroup({
  items,
  renderTile,
  containerClassName,
}: {
  items: (MediaItem & { width?: number; height?: number })[];
  renderTile: (idx: number) => React.ReactNode;
  containerClassName?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [rows, setRows] = React.useState<Row[]>([]);

  const [freezeLayout, setFreezeLayout] = React.useState<boolean>(false);

  React.useEffect(() => {
    const onFs = () => {
      const fsEl = document.fullscreenElement;
      setFreezeLayout(!!fsEl);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const recalc = React.useCallback(() => {
    if (freezeLayout) return;
    const w = ref.current?.clientWidth || 0;
    if (!w) return;
    setRows(buildRows(items, w, 242, 176, 286, 1, 3, 5));
  }, [items, freezeLayout]);

  React.useEffect(() => {
    recalc();
    if (!ref.current) return;

    const ro = new ResizeObserver(() => {
      if (!freezeLayout) recalc();
    });
    ro.observe(ref.current);

    return () => ro.disconnect();
  }, [recalc, freezeLayout]);

  return (
    <div
      ref={ref}
      className={clsx(
        "w-full overflow-hidden relative z-0",
        containerClassName ?? "rounded-lg"
      )}
    >
      <div className="flex flex-col gap-[5px]">
        {rows.map((row, r) => (
          <div
            key={r}
            className="flex gap-[5px]"
            style={{ height: row.height }}
          >
            {row.items.map((idx, k) => {
              const it = items[idx];
              const key = it?._key ?? `${it?.url ?? "no-url"}-${idx}`;

              return (
                <div
                  key={key}
                  style={{ width: row.widths[k], height: row.height }}
                  className="relative overflow-hidden"
                >
                  {renderTile(idx)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

type ForwardedFrom = {
  id?: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
};

type Props = {
  text?: string;
  date: string;
  isSender: boolean;
  media?: MediaItem[] | MediaItem | null;
  forwardedFrom?: ForwardedFrom;
  showTail?: boolean;
  seriesHasNext?: boolean;
  avatar?: string;
  isPinned?: boolean;

  isRead?: boolean;
  messageId?: number | string;
  transcribing?: boolean;
  transcription?: string;
  onRequestTranscription?: (messageId: number | string) => void;
  allowTranscription?: boolean;
  edited?: boolean;

  translating?: boolean;
  hasTranslated?: boolean;
  showingOriginal?: boolean;
  onTranslateClick?: (messageId: number | string, text?: string) => void;
  onToggleTranslateClick?: (messageId: number | string) => void;
};

const fwdName = (f?: ForwardedFrom) =>
  (f?.title && f.title.trim()) ||
  [f?.first_name, f?.last_name].filter(Boolean).join(" ").trim() ||
  (f?.username ? `@${f.username}` : "") ||
  (f?.id ? `ID ${f.id}` : "");

const ChatBubble: React.FC<Props> = ({
  text,
  date,
  isSender,
  media,
  forwardedFrom,
  showTail = true,
  seriesHasNext = false,
  avatar,
  isPinned = false,
  isRead,
  messageId,
  transcribing,
  transcription,
  onRequestTranscription,
  allowTranscription,

  translating,
  hasTranslated,
  showingOriginal,
  onTranslateClick,
  onToggleTranslateClick,

  edited,
}) => {
  const footerRef = React.useRef<HTMLDivElement | null>(null);
  const bubbleRef = React.useRef<HTMLDivElement | null>(null);

  const forwardRef = React.useRef<HTMLDivElement | null>(null);
  const [forwardWidth, setForwardWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    const update = () => {
      const w = footerRef.current?.offsetWidth ?? 37;
      bubbleRef.current?.style.setProperty("--footer-wpx", `${w + 8}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    if (footerRef.current) ro.observe(footerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [date, text, isPinned]);

  const mediaArray: MediaItem[] = Array.isArray(media)
    ? media
    : media
    ? [media]
    : [];

  React.useEffect(() => {
    const update = () => {
      const w = footerRef.current?.offsetWidth ?? 0;
      if (bubbleRef.current) {
        bubbleRef.current.style.setProperty("--time-wpx", `${w}px`);
      }
    };
    update();

    const ro = new ResizeObserver(update);
    if (footerRef.current) ro.observe(footerRef.current);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [date, text, isPinned]);

  const hasText = !!text && text.trim().length > 0;
  const hasMedia = mediaArray.length > 0;
  const attachToMedia = hasText && hasMedia;

  const specials = mediaArray.filter(isSpecialMedia);
  const gridItems = mediaArray.filter(isGridMedia);

  const hasForward = !!forwardedFrom;
  const forwardedTitle = hasForward ? fwdName(forwardedFrom) : "";

  const hasRound = mediaArray.some(isRoundVideo);
  const hasSticker = mediaArray.some(
    (m) => isStickerTgs(m) || isStickerStatic(m) || isStickerVideo(m)
  );
  const hasGif = mediaArray.some(
    (m) => isDocAnimationGif(m) || isAnimationGif(m)
  );
  const hasVoice = mediaArray.some(isVoiceNote);
  const hasAudio = mediaArray.some(isAudioFile);

  const suppressForward = hasSticker || hasGif || hasVoice || hasAudio;

  const showForwardTopBar = hasForward && !hasRound && !suppressForward;

  React.useEffect(() => {
    if (!hasForward) {
      setForwardWidth(null);
      return;
    }
    const calc = () => {
      const w = forwardRef.current?.offsetWidth ?? null;
      setForwardWidth(w);
    };
    const ro = new ResizeObserver(calc);
    if (forwardRef.current) ro.observe(forwardRef.current);
    window.addEventListener("resize", calc);
    const t = setTimeout(calc, 0);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", calc);
      clearTimeout(t);
    };
  }, [hasForward, forwardedTitle]);

  const translateTitle = translating
    ? "Перевод..."
    : hasTranslated
    ? showingOriginal
      ? "Перевести"
      : "Показать оригинал"
    : "Перевести";

  const onTranslateBtnClick = () => {
    if (!messageId || translating) return;
    if (hasTranslated && !showingOriginal) {
      onToggleTranslateClick?.(messageId);
    } else {
      onTranslateClick?.(messageId, text);
    }
  };

  const showTranslateBtn = !isSender && hasText;

  function splitToTokens(input: string) {
    const tokens: Array<
      | { type: "copy"; text: string }
      | { type: "link"; href: string; text: string }
      | { type: "text"; text: string }
    > = [];

    const codeRe = /`([^`]+)`/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;

    const pushLinksInside = (chunk: string) => {
      const linkRe =
        /\b((?:https?:\/\/|www\.)[^\s<]+|(?:t\.me\/)[^\s<]+)(?![^<]*>)/gi;
      let li = 0;
      let lm: RegExpExecArray | null;
      while ((lm = linkRe.exec(chunk))) {
        if (lm.index > li) {
          tokens.push({ type: "text", text: chunk.slice(li, lm.index) });
        }
        let raw = lm[0];
        const trimmed = raw.replace(/[),.!?:;]+$/g, (p) => {
          raw = raw.slice(0, raw.length - p.length);
          return "";
        });
        const href = raw.startsWith("www.") ? "https://" + raw : raw;
        tokens.push({ type: "link", href, text: raw });
        li = lm.index + trimmed.length;
      }
      if (li < chunk.length) {
        tokens.push({ type: "text", text: chunk.slice(li) });
      }
    };

    while ((m = codeRe.exec(input))) {
      if (m.index > lastIndex) {
        pushLinksInside(input.slice(lastIndex, m.index));
      }
      tokens.push({ type: "copy", text: m[1] });
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < input.length) {
      pushLinksInside(input.slice(lastIndex));
    }

    return tokens;
  }

  function RichText({
    text,
    onCopied,
  }: {
    text: string;
    onCopied?: (s: string) => void;
  }) {
    const tokens = splitToTokens(text);

    const handleCopy = async (s: string) => {
      try {
        await navigator.clipboard.writeText(s);
        onCopied?.(s);
      } catch {}
    };

    return (
      <>
        {tokens.map((t, i) => {
          if (t.type === "text") {
            return <React.Fragment key={i}>{t.text}</React.Fragment>;
          }
          if (t.type === "link") {
            return (
              <a
                key={i}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="align-baseline inline text-[#6cb4ec] hover:underline break-words"
              >
                {t.text}
              </a>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleCopy(t.text)}
              className={`inline px-[2px] font-[400] cursor-pointer ${
                isSender
                  ? "text-[#9ec2e4] active:bg-[#316fa2] active:text-[#98cdfa]"
                  : "text-[#4c769b] active:bg-[#2e6fa4] active:text-[#8dc8f9]"
              }`}
            >
              {t.text}
            </button>
          );
        })}
      </>
    );
  }

  return (
    <div
      className={clsx(
        "flex items-end gap-[13px] relative",
        isSender ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className="w-[30px] h-[30px] shrink-0 flex-none">
        {showTail ? (
          <ImagePreload
            src={avatar || "/images/df_avatar.jpg"}
            width={30}
            height={30}
            className="rounded-full object-cover block"
          />
        ) : (
          <div className="w-[30px] h-[30px] rounded-full" />
        )}
      </div>

      <div
        className={clsx(
          "flex items-center gap-2 max-w-[473px]",
          hasMedia ? "w-full" : "w-auto"
        )}
      >
        <div
          className={`flex-1 min-w-0 w-full max-w-[473px] ${
            isSender ? "flex-col flex justify-end items-end" : ""
          }`}
        >
          {showForwardTopBar && (
            <div
              ref={forwardRef}
              className={clsx(
                "inline-flex items-center gap-2 px-3 py-2 text-[13px] leading-none text-white",
                "rounded-t-xl rounded-b-none",
                `${hasMedia ? "w-full" : "w-"}`,
                isSender ? "self-end bg-[#2b5278]" : "self-start bg-[#182533]"
              )}
            >
              <span className="text-[#90caff] font-[500]">
                Переслано от {forwardedTitle}
              </span>
            </div>
          )}

          {specials.map((m, i) => {
            if (isRoundVideo(m)) {
              return (
                <div key={`round-${i}`} className="mb-1 relative inline-block">
                  <RoundVideo src={m.url} size={264} />
                </div>
              );
            }

            if (isVoiceNote(m)) {
              return (
                <div key={`vnote-${i}`} className="mb-1">
                  <VoiceNoteBubble
                    item={m as unknown as MediaAudio}
                    isSender={isSender}
                    date={date}
                    messageId={messageId}
                    transcribing={transcribing}
                    transcription={transcription}
                    onRequestTranscription={onRequestTranscription}
                    allowTranscription={allowTranscription}
                  />
                </div>
              );
            }

            if (isAudioFile(m)) {
              return (
                <div key={`audio-${i}`} className="mb-1">
                  <AudioFileBubble
                    item={m as unknown as MediaAudio}
                    isSender={isSender}
                    date={date}
                  />
                </div>
              );
            }

            if (isStickerTgs(m)) {
              return (
                <div key={`tgs-${i}`} className="mb-1">
                  <TgsSticker url={m.url} width={198} height={198} />
                </div>
              );
            }

            if (isStickerStatic(m)) {
              return (
                <div key={`sticker-${i}`} className="mb-1 max-w-[198px]">
                  <ImagePreload
                    src={m.url}
                    className="rounded-lg max-w-full h-auto"
                  />
                </div>
              );
            }

            if (isStickerVideo(m)) {
              return (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="max-h-[220px] rounded"
                >
                  <source src={m.url} type="video/webm; codecs=vp9" />
                  <source src={m.url} type="video/webm" />
                </video>
              );
            }

            if (isDocAnimationGif(m) || isAnimationGif(m)) {
              return (
                <div className="relative h-full group">
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[13px] px-1 py-[1px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    GIF
                  </span>
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="rounded-l-xl cursor-pointer"
                  >
                    <source src={m.url} type="video/mp4" />
                    <source src={m.url} type="video/webm; codecs=vp9" />
                    <source src={m.url} type="video/webm" />
                  </video>
                </div>
              );
            }

            return null;
          })}

          {gridItems.length > 0 && (
            <MediaGroup
              items={gridItems}
              containerClassName={
                attachToMedia || hasForward
                  ? "rounded-2xl rounded-b-none"
                  : "rounded-2xl"
              }
              renderTile={(idx) => {
                const m = gridItems[idx];
                if (!m) return null;

                if (m.type === "photo") {
                  return (
                    <ImagePreload
                      src={m.url}
                      enableViewer={true}
                      className="absolute inset-0 w-full h-full object-cover rounded-none"
                    />
                  );
                }
                if (isNormalVideo(m)) {
                  return (
                    <VideoTG
                      src={m.url}
                      autoPlay
                      muted
                      className="absolute inset-0 w-full h-full"
                      fit="cover"
                    />
                  );
                }
                return null;
              }}
            />
          )}

          {hasText && (
            <div className={clsx("relative inline-block max-w-full w-full")}>
              <div
                ref={bubbleRef}
                className={clsx(
                  "relative px-[13px] py-[7px] text-[15px] leading-[1.25] text-white z-10",
                  attachToMedia
                    ? "w-full rounded-b-2xl rounded-t-none"
                    : hasForward
                    ? "rounded-b-2xl rounded-t-none"
                    : "min-w-[55px] w-fit max-w-full rounded-2xl",
                  isSender ? "bg-[#2b5278]" : "bg-[#182533]",
                  showTail &&
                    clsx(
                      "after:content-[''] after:absolute after:bottom-0 after:w-0 after:h-0 after:border-[7px] after:border-transparent after:z-20",
                      isSender
                        ? "after:right-0 after:left-auto after:border-r-[#2b5278] after:border-b-[#2b5278]"
                        : "after:left-0 after:border-l-[#182533] after:border-b-[#182533]"
                    ),
                  seriesHasNext ? "rounded-b-2xl" : undefined
                )}
                style={
                  !attachToMedia && hasForward && forwardWidth
                    ? { width: `${forwardWidth}px` }
                    : undefined
                }
              >
                <div className="whitespace-pre-wrap break-words">
                  <RichText
                    text={text!}
                    onCopied={() => {
                      toast.success("Текст скопирован в буфер обмена.");
                    }}
                  />
                  <span
                    aria-hidden
                    className="inline-block align-baseline"
                    style={{ width: "var(--footer-wpx, 46px)", height: 0 }}
                  />
                </div>

                <div
                  ref={footerRef}
                  className={clsx(
                    "absolute bottom-[5px] right-[9px] flex items-center gap-[5px] text-[11px] select-none",
                    isSender ? "text-[#75a1cb]" : "text-[#627588]"
                  )}
                >
                  {isPinned && (
                    <BsPinAngleFill
                      size={13}
                      color={isSender ? "#6bbfff" : "#6d7f8f"}
                    />
                  )}

                  {edited && <span className="opacity-80">изменено</span>}

                  <span>{date}</span>

                  <span
                    className="inline-flex items-center gap-[2px]"
                    title={
                      typeof isRead === "boolean"
                        ? isRead
                          ? "Прочитано"
                          : "Доставлено"
                        : "Отправка..."
                    }
                  >
                    {isRead ? (
                      <CheckCheck className="w-[13px] h-[13px]" />
                    ) : (
                      <Check className="w-[13px] h-[13px]" />
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {showTranslateBtn && (
          <button
            type="button"
            onClick={onTranslateBtnClick}
            disabled={!!translating}
            aria-label={translateTitle}
            title={translateTitle}
            className={clsx(
              "",
              isSender ? "left-[6px]" : "right-[6px]",
              "flex h-[28px] min-w-[28px] items-center justify-center px-2",
              "rounded-md bg-[#315f8b] text-[#4c9ce2]",
              "hover:brightness-110 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            )}
          >
            {translating ? (
              <Loader2 className="animate-spin" size={15} />
            ) : hasTranslated ? (
              showingOriginal ? (
                <Languages size={15} />
              ) : (
                <Undo2 size={15} />
              )
            ) : (
              <Languages size={15} />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
