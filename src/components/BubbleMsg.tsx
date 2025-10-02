// ChatBubble.tsx
import React from "react";
import clsx from "clsx";
import ImagePreload from "@/components/ImagePreload";
import { TgsSticker } from "@/components/TgsSticker";
import VideoTG from "./VideoTG";
import VoiceNoteBubble, { type MediaAudio } from "./VoiceNote";
import AudioFileBubble from "./AudioFile";
import RoundVideo from "./RoundVideo";
import { BsPinAngleFill } from "react-icons/bs";
import {
  Check,
  CheckCheck,
  Clock3,
  Languages,
  Loader2,
  Undo2,
} from "lucide-react";

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
  // scaled by 1.1 from 220/160/260 and gap 4 → 5
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

const ChatBubble: React.FC<Props> = ({
  text,
  date,
  isSender,
  media,
  // forwardedFrom,
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

  React.useEffect(() => {
    const update = () => {
      const w = footerRef.current?.offsetWidth ?? 37; // scaled from 34
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

  // const forwardedName = React.useMemo(() => {
  //   if (!forwardedFrom) return null;
  //   if (forwardedFrom.username && forwardedFrom.username.trim())
  //     return forwardedFrom.username;
  //   const full = [forwardedFrom.first_name, forwardedFrom.last_name]
  //     .filter(Boolean)
  //     .join(" ")
  //     .trim();
  //   if (full) return full;
  //   if (forwardedFrom.title && forwardedFrom.title.trim())
  //     return forwardedFrom.title;
  //   return forwardedFrom.id ? `ID ${forwardedFrom.id}` : "неизвестно";
  // }, [forwardedFrom]);

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
      // сейчас показываем перевод → переключаемся на оригинал
      onToggleTranslateClick?.(messageId);
    } else {
      // показываем оригинал ИЛИ перевода ещё не было → шлём новый запрос
      onTranslateClick?.(messageId, text);
    }
  };

  const showTranslateBtn = !isSender && hasText;

  return (
    <div
      className={clsx(
        "flex items-end gap-[13px] relative",
        isSender ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className="w-[35px] h-[35px] shrink-0 flex-none">
        {showTail ? (
          <ImagePreload
            src={avatar || "/images/df_avatar.jpg"}
            width={35}
            height={35}
            className="w-[35px] h-[35px] rounded-full object-cover block"
          />
        ) : (
          <div className="w-[35px] h-[35px] rounded-full" />
        )}
      </div>

      <div
        className={`flex-1 min-w-0 w-full max-w-[473px] ${
          isSender && "flex-col flex justify-end items-end"
        }`}
      >
        {/* {forwardedName && (
          <div
            className={clsx(
              "px-[13px] py-[5px] mb-[5px] text-[13px] rounded-lg self-start",
              isSender
                ? "bg-[#2b5278] text-white/90"
                : "bg-[#182533] text-white/90"
            )}
          >
            <span className="opacity-80">Переслано от </span>
            <span className="font-medium">{forwardedName}</span>
          </div>
        )} */}

        {specials.map((m, i) => {
          if (isRoundVideo(m)) {
            return (
              <div key={`round-${i}`} className="mb-1">
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
              <div className="relative w-full h-full group">
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
              attachToMedia ? "rounded-lg rounded-b-none" : "rounded-lg"
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
          <div
            className={clsx(
              "relative inline-block max-w-full", // <= не вылезаем шире экрана
              isSender ? "pl-[38px]" : "pr-[38px]" // <= резерв под кнопку
            )}
          >
            {/* пузырь */}
            <div
              ref={bubbleRef}
              className={clsx(
                "relative px-[13px] py-[9px] text-[15px] leading-[1.25] text-white z-10",
                attachToMedia
                  ? "w-full rounded-b-lg rounded-t-none"
                  : // важно: пусть ширина ограничивается шириной обёртки
                    "min-w-[55px] w-fit max-w-full rounded-lg",
                isSender ? "bg-[#2b5278]" : "bg-[#182533]",
                showTail &&
                  clsx(
                    "after:content-[''] after:absolute after:bottom-0 after:w-0 after:h-0 after:border-[7px] after:border-transparent after:z-20",
                    isSender
                      ? "after:right-0 after:left-auto after:border-r-[#2b5278] after:border-b-[#2b5278]"
                      : "after:left-0 after:border-l-[#182533] after:border-b-[#182533]"
                  ),
                seriesHasNext ? "rounded-b-md" : undefined
              )}
            >
              <div className="whitespace-pre-wrap break-words">
                {text}
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

                {/* <-- ДОБАВЛЕНО: лейбл 'изменено' */}
                {edited && <span className="opacity-80">изменено</span>}

                <span>{date}</span>

                {isSender && (
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
                    {typeof isRead === "undefined" ? (
                      <Clock3 className="w-[13px] h-[13px] opacity-80" />
                    ) : isRead ? (
                      <CheckCheck className="w-[13px] h-[13px]" />
                    ) : (
                      <Check className="w-[13px] h-[13px]" />
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* кнопка перевода — в пределах обёртки (не вылезает за экран) */}
            {showTranslateBtn && (
              <button
                type="button"
                onClick={onTranslateBtnClick}
                disabled={!!translating}
                aria-label={translateTitle}
                title={translateTitle}
                className={clsx(
                  "absolute top-1/2 -translate-y-1/2 z-20 cursor-pointer",
                  // теперь без отрицательных значений
                  isSender ? "left-[6px]" : "right-[6px]",
                  "flex h-[28px] min-w-[28px] items-center justify-center px-2",
                  "rounded-md bg-[#315f8b] text-[#4c9ce2]",
                  "hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
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
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
