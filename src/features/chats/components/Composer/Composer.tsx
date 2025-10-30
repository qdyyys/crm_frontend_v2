import { Instagram, Paperclip, RedoDot, Wallet, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AttachPreview from "./AttachPreview";
import ReplyPreview from "./ReplyPreview";
import type { AttachItem } from "../../types";
import { IoSend } from "react-icons/io5";
import { Button } from "@/components/ui/button";
import EmojiPicker, { Theme } from "emoji-picker-react";

type Mode = "typing" | "scripts" | "videos" | "channels";

export default function Composer({
  messageText,
  setMessageText,
  attachments,
  addFilesAsAttachments,
  removeAttachment,
  clearAttachments,
  replyTo,
  setReplyTo,
  onSend,
  userScripts,
  scriptState,
  setScriptState,
  onSendVideoNote,
  userVideos,
  showVideoPicker,
  setShowVideoPicker,
  onPickSavedVideo,
  autoFocusKey,

  selectedUserId,
  channels,
  channelsLoading,
  channelsError,
  onOpenChannels,
  onProcessDeposit,
  resetKey,
  canDeposit,
  showMoveToSecondLine,
  onMoveToSecondLine,
}: {
  messageText: string;
  setMessageText: React.Dispatch<React.SetStateAction<string>>;
  attachments: AttachItem[];
  addFilesAsAttachments: (files: FileList | File[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  replyTo: any | null;
  setReplyTo: (v: any | null) => void;
  onSend: (opts?: { pasted?: boolean }) => void;
  userScripts: any[] | undefined;
  scriptState: { show: boolean; filtered: any[]; activeIndex: number };
  setScriptState: (s: (prev: any) => any) => void;
  onSendVideoNote: (dataUrl: string) => void;
  userVideos: any[];
  showVideoPicker: boolean;
  setShowVideoPicker: (v: boolean | ((p: boolean) => boolean)) => void;
  onPickSavedVideo: (videoMongoId: string) => void;
  autoFocusKey?: string | number | null;

  selectedUserId?: number | null;
  channels: any[];
  channelsLoading: boolean;
  channelsError?: string | null;
  onOpenChannels: (userId: number) => void;
  onProcessDeposit: (payload: {
    user_id: number;
    amount: number;
    bot_id: string;
    channel_id: string;
  }) => void;
  resetKey?: number;
  canDeposit?: boolean;
  showMoveToSecondLine?: boolean;
  onMoveToSecondLine?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoNoteInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const pendingSendRef = useRef<null | { pasted: boolean }>(null);

  const autoResize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 160;
    const next = Math.min(max, el.scrollHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  };

  useEffect(() => {
    autoResize();
  }, [messageText]);

  useEffect(() => {
    const id = setTimeout(() => {
      inputRef.current?.focus();
      autoResize();
    }, 0);
    return () => clearTimeout(id);
  }, [autoFocusKey]);

  const [mode, setMode] = useState<Mode>("typing");
  const [amount, setAmount] = useState<string>("");

  const [videoPage, setVideoPage] = useState(0);
  const [wasPasted, setWasPasted] = useState(false);
  const perPage = 3;
  const totalVideos = userVideos?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalVideos / perPage));
  const pageSlice =
    userVideos?.slice(videoPage * perPage, videoPage * perPage + perPage) || [];

  const clearSlashMenu = () =>
    setScriptState((p: any) => ({
      ...p,
      show: false,
      filtered: [],
      activeIndex: 0,
    }));

  const clearInput = () => setMessageText("");

  const toggleChannels = () => {
    if (!canDeposit) return;

    setMode((m) => {
      if (m === "channels") {
        return "typing";
      }
      setShowEmoji(false);
      setConfirmSecondLine(false);
      clearSlashMenu();
      setShowVideoPicker(false);
      clearInput();
      clearAllAttachments();
      setReplyTo(null);
      setAmount("");
      if (selectedUserId) onOpenChannels(Number(selectedUserId));
      return "channels";
    });
  };

  const clearAllAttachments = () => {
    clearAttachments();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const enterTyping = () => {
    setMode("typing");
    clearSlashMenu();
    setShowVideoPicker(false);
  };

  const enterScripts = (query: string) => {
    setMode("scripts");
    setShowVideoPicker(false);
    const q = query.toLowerCase();
    const matched = (userScripts || []).filter((s: any) =>
      s.name.toLowerCase().includes(q)
    );
    setScriptState((p: any) => ({
      ...p,
      filtered: matched,
      show: matched.length > 0,
      activeIndex: 0,
    }));
  };

  const toggleVideos = () => {
    setMode((m) => {
      if (m === "videos") {
        setShowVideoPicker(false);
        return "typing";
      } else {
        setShowEmoji(false);
        setConfirmSecondLine(false);
        clearSlashMenu();
        clearInput();
        clearAllAttachments();
        setReplyTo(null);
        setShowVideoPicker(true);
        return "videos";
      }
    });
  };

  const applyScript = (how: "send" | "complete", forcedScript?: any) => {
    const script =
      forcedScript ?? scriptState.filtered[scriptState.activeIndex];
    if (!script) return;

    setShowVideoPicker(false);

    if (how === "send") {
      const textToSend = `/${script.name}`;
      setMessageText(textToSend);
      pendingSendRef.current = { pasted: wasPasted };
      setWasPasted(false);
      clearSlashMenu();
      setMode("typing");
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setMessageText(`/${script.name} `);
      clearSlashMenu();
      setMode("typing");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  useEffect(() => {
    if (pendingSendRef.current) {
      const opts = pendingSendRef.current;
      pendingSendRef.current = null;
      onSend(opts);
    }
  }, [messageText, onSend]);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [autoFocusKey]);

  useEffect(() => {
    if (channelsError === "User not found") {
      setMode("typing");
      setAmount("");
    }
  }, [channelsError]);

  useEffect(() => {
    setMode("typing");
    setAmount("");
    setShowVideoPicker(false);
    setReplyTo(null);
    clearAllAttachments();
    setShowEmoji(false);
    setConfirmSecondLine(false);

    setScriptState((p: any) => ({
      ...p,
      show: false,
      filtered: [],
      activeIndex: 0,
    }));

    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [resetKey]);

  useEffect(() => {
    if (mode === "channels" && canDeposit === false) {
      setMode("typing");
    }
  }, [canDeposit, mode]);

  const confirmRef = useRef<HTMLDivElement | null>(null);
  const [confirmSecondLine, setConfirmSecondLine] = useState(false);

  useEffect(() => {
    if (!confirmSecondLine) return;
    const onDocClick = (e: MouseEvent) => {
      if (!confirmRef.current) return;
      if (!confirmRef.current.contains(e.target as Node)) {
        setConfirmSecondLine(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmSecondLine(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [confirmSecondLine]);

  const closeAllMenus = () => {
    setShowEmoji(false);
    setConfirmSecondLine(false);
    clearSlashMenu();
    setShowVideoPicker(false);
    setMode("typing");
  };

  return (
    <div className="border-t border-[#101921] bg-[#17212b] flex flex-col">
      <ReplyPreview replyTo={replyTo} onClear={() => setReplyTo(null)} />
      <AttachPreview
        attachments={attachments}
        removeOne={(id) => removeAttachment(id)}
      />

      <div className="px-3 flex gap-1 items-end relative py-1">
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            enterTyping();
            if (files?.length) addFilesAsAttachments(files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        <input
          ref={videoNoteInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f || !f.type.startsWith("video/")) {
              if (videoNoteInputRef.current)
                videoNoteInputRef.current.value = "";
              return;
            }
            const dataUrl: string = await new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(String(fr.result || ""));
              fr.onerror = reject;
              fr.readAsDataURL(f);
            });
            onSendVideoNote(dataUrl);
            enterTyping();
            if (videoNoteInputRef.current) videoNoteInputRef.current.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => {
            closeAllMenus();
            enterTyping();
            fileInputRef.current?.click();
          }}
          className="relative z-0 p-2 rounded-full text-[#6a7580] hover:text-[#e2e2e2] active:text-[#e2e2e2] outline-none cursor-pointer overflow-hidden after:content-[''] after:absolute after:inset-0 after:rounded-full after:bg-[#6c6fa121] after:scale-0 after:transition-transform after:duration-300 active:after:scale-100"
          title="Прикрепить фото или видео (до 10)"
        >
          <Paperclip size={20} className="relative z-10" />
        </button>

        <button
          type="button"
          onClick={toggleVideos}
          className="relative z-0 p-2 rounded-full text-[#6a7580] hover:text-[#e2e2e2] active:text-[#e2e2e2] outline-none cursor-pointer"
          title="Отправить видео-кружок"
        >
          <Instagram size={20} />
        </button>

        {canDeposit && (
          <button
            type="button"
            onClick={toggleChannels}
            className="relative z-0 p-2 rounded-full text-[#6a7580] hover:text-[#e2e2e2] active:text-[#e2e2e2] outline-none cursor-pointer"
            title="Депозит в канал"
            aria-label="Депозит в канал"
          >
            <Wallet size={20} />
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            setShowEmoji((prev) => {
              const next = !prev;
              if (next) {
                setConfirmSecondLine(false);
                clearSlashMenu();
                setShowVideoPicker(false);
                setMode("typing");
              }
              return next;
            })
          }
          className="relative z-0 p-2 rounded-full text-[#6a7580] hover:text-[#e2e2e2] outline-none cursor-pointer"
          title="Эмодзи"
        >
          <Smile size={20} />
        </button>

        {showEmoji && (
          <div className="absolute bottom-full left-0 mb-2 z-50 w-full">
            <EmojiPicker
              onEmojiClick={(emoji) => {
                setMessageText((prev) => prev + emoji.emoji);
                setShowEmoji(false);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              theme={Theme.DARK}
              searchDisabled
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
              height={250}
            />
          </div>
        )}

        {showMoveToSecondLine && (
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setConfirmSecondLine((open) => {
                  const next = !open;
                  if (next) {
                    setShowEmoji(false);
                    clearSlashMenu();
                    setShowVideoPicker(false);
                    setMode("typing");
                  }
                  return next;
                })
              }
              className="relative z-0 p-2 rounded-full text-[#6a7580] hover:text-[#e2e2e2] active:text-[#e2e2e2] outline-none cursor-pointer text-red-400"
              title="Перевести на 2 линию"
              aria-label="Перевести на 2 линию"
            >
              <RedoDot size={20} />
            </button>

            {confirmSecondLine && (
              <div
                ref={confirmRef}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-[#17212b] border border-[#101921] rounded-lg shadow-xl px-3 py-2 text-sm text-white w-[220px]"
              >
                <div className="mb-2 text-[13px] text-white/90">
                  Перевести чат на 2 линию?
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmSecondLine(false)}
                    className="px-2 py-1 rounded bg-[#1f2c3a] hover:bg-[#213546] text-[13px] cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmSecondLine(false);
                      onMoveToSecondLine?.();
                    }}
                    className="px-2 py-1 rounded bg-[#2b5278] hover:bg-[#2f5f8a] text-[13px] cursor-pointer"
                  >
                    Да
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <textarea
          ref={inputRef}
          rows={1}
          value={messageText}
          wrap="soft"
          onChange={(e) => {
            const value = e.target.value;
            setMessageText(value);
            autoResize();

            if (value.startsWith("/")) {
              setShowEmoji(false);
              setConfirmSecondLine(false);
              setShowVideoPicker(false);
              enterScripts(value.slice(1));
            } else {
              if (mode !== "typing") enterTyping();
              setShowEmoji(false);
              setConfirmSecondLine(false);
            }
          }}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData?.items || []);
            const hasImage = items.some(
              (it) => it.kind === "file" && /^image\//i.test(it.type)
            );

            if (hasImage) {
              e.preventDefault();
              setWasPasted(true);
              return;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closeAllMenus();
              return;
            }

            if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.altKey)) {
              requestAnimationFrame(autoResize);
              return;
            }

            if (
              e.key !== "Enter" &&
              mode === "scripts" &&
              scriptState.show &&
              scriptState.filtered.length
            ) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setScriptState((p: any) => ({
                  ...p,
                  activeIndex:
                    p.activeIndex + 1 < scriptState.filtered.length
                      ? p.activeIndex + 1
                      : 0,
                }));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setScriptState((p: any) => ({
                  ...p,
                  activeIndex:
                    p.activeIndex - 1 >= 0
                      ? p.activeIndex - 1
                      : scriptState.filtered.length - 1,
                }));
                return;
              }
              if (e.key === "Tab") {
                e.preventDefault();
                applyScript("complete");
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                applyScript("send");
                return;
              }
            }

            if (e.key === "Enter") {
              e.preventDefault();
              onSend({ pasted: wasPasted });
              setWasPasted(false);
              enterTyping();
              requestAnimationFrame(() => {
                autoResize();
              });
            }
          }}
          className="flex-1 px-3 py-2 rounded bg-transparent placeholder:text-[#65707b] outline-none text-lg leading-[1.35] resize-none max-h-40 overflow-y-hidden text-white break-words"
          placeholder={
            attachments.length
              ? "Добавьте подпись или нажмите Enter для отправки…"
              : replyTo
              ? "Ответить на сообщение…"
              : "Сообщение…"
          }
        />

        <button
          type="button"
          onClick={() => {
            onSend({ pasted: wasPasted });
            setWasPasted(false);
            enterTyping();
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="text-white rounded cursor-pointer outline-none p-2"
          title="Отправить (Enter)"
        >
          <IoSend size={20} color="#5288c1" />
        </button>

        {mode === "scripts" &&
          scriptState.show &&
          scriptState.filtered.length > 0 && (
            <div
              role="listbox"
              aria-label="Скрипты"
              className="absolute bottom-full left-0 right-0 mx-3 mb-2 z-50 bg-[#17212b] border border-[#10131888] rounded-lg max-h-[240px] overflow-y-auto overflow-x-hidden"
            >
              {scriptState.filtered.map((script, idx) => (
                <button
                  type="button"
                  key={script.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyScript("send", script)}
                  className={`w-full text-left px-3 py-2 cursor-pointer text-sm ${
                    idx === scriptState.activeIndex
                      ? "bg-[#1f2c3a] text-white"
                      : "hover:bg-[#1f2c3a] text-white"
                  } flex items-start gap-2 min-w-0`}
                  role="option"
                  aria-selected={idx === scriptState.activeIndex}
                >
                  <span className="shrink-0 text-white/90">/{script.name}</span>
                  <span className="shrink-0 text-gray-400">—</span>
                  <span className="text-gray-400 flex-1 min-w-0 truncate sm:line-clamp-2">
                    {script.message}
                  </span>
                </button>
              ))}
            </div>
          )}

        {mode === "channels" && (
          <div className="absolute bottom-full left-0 right-0 mx-3 mb-2 z-50">
            <div className="bg-[#17212b] border border-[#101921] rounded-lg p-2">
              <div className="mb-2">
                <label className="block text-[12px] text-gray-400 mb-1">
                  Сумма депозита
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) {
                        setAmount(v);
                      }
                    }}
                    className="flex-1 bg-[#0e1621] border border-[#101921] rounded-md  px-3 py-2 text-sm outline-none text-white"
                    placeholder="00.00"
                  />

                  <Button
                    type="button"
                    onClick={() => setAmount("")}
                    className="outline-none cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border transition text-left select-none border-[#1e2c3a] bg-[#121a24] text-white/90 hover:border-[#2b5278] hover:bg-[#17212b] hover:text-[#18a3e6]"
                    title="Сбросить"
                  >
                    Сброс
                  </Button>
                </div>
                <div className="mt-1 text-[12px] text-gray-400">
                  {Number.isFinite(Number(String(amount).replace(",", "."))) &&
                  Number(String(amount).replace(",", ".")) > 0
                    ? "Выберитете канал ниже"
                    : "Введите сумму, чтобы активировать выбор канала"}
                </div>
              </div>

              {channelsLoading ? (
                <div className="text-sm text-gray-400 px-2 py-1">
                  Загрузка каналов…
                </div>
              ) : channels?.length ? (
                <div className="max-h-60 overflow-y-auto divide-y divide-[#101921]">
                  {channels.map((ch: any) => {
                    const channelId = String(
                      ch.channel_id ?? ch.id ?? ch.channelId ?? ""
                    );
                    const botId = String(
                      ch.bot_id ??
                        ch.botId ??
                        ch.bot ??
                        ch.channel_token ??
                        ch.token ??
                        ""
                    );
                    const channelName =
                      ch.title ||
                      ch.name ||
                      ch.username ||
                      channelId ||
                      "Канал";

                    const parsedAmount = Number(
                      String(amount).replace(",", ".")
                    );
                    const canDeposit =
                      Number.isFinite(parsedAmount) && parsedAmount > 0;

                    return (
                      <button
                        type="button"
                        key={`${botId}_${channelId}_${channelName}`}
                        disabled={
                          !canDeposit || !selectedUserId || !channelId || !botId
                        }
                        onClick={() => {
                          if (
                            !canDeposit ||
                            !selectedUserId ||
                            !channelId ||
                            !botId
                          )
                            return;

                          onProcessDeposit({
                            user_id: Number(selectedUserId),
                            amount: parsedAmount,
                            bot_id: botId,
                            channel_id: channelId,
                          });

                          setMode("typing");
                          setAmount("");
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-[#1f2c3a] rounded ${
                          !canDeposit
                            ? "opacity-60 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                        title={channelName}
                      >
                        <div className="text-sm text-white truncate">
                          {channelName}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate">
                          bot: {botId || "—"} · channel: {channelId || "—"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-400 px-2 py-1">
                  Каналы не найдены
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "videos" && showVideoPicker && (
          <div className="absolute bottom-full left-0 right-0 mx-3 mb-2 z-50">
            <div className="bg-[#17212b] border border-[#101921] rounded-lg p-2">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  className="px-2 py-1 cursor-pointer"
                  onClick={() => setVideoPage((p) => Math.max(0, p - 1))}
                  disabled={videoPage <= 0}
                >
                  ←
                </button>
                <div className="text-xs text-gray-300">
                  {totalPages > 0 ? `${videoPage + 1}/${totalPages}` : "0/0"}
                </div>
                <button
                  type="button"
                  className="px-2 py-1 cursor-pointer"
                  onClick={() =>
                    setVideoPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={videoPage >= totalPages - 1}
                >
                  →
                </button>
              </div>

              {totalVideos === 0 ? (
                <div className="text-sm text-gray-400 px-2 py-1">
                  Сохранённых видео нет
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {pageSlice.map((v: any) => (
                    <button
                      type="button"
                      key={v.id || v.video_id || v._id}
                      onClick={() =>
                        onPickSavedVideo(v.id || v._id || v.video_id)
                      }
                      className="px-3 py-2 rounded bg-[#1f2c3a] text-white text-sm truncate hover:bg-[#2a3a4a]"
                      title={v.button_name || "Видео"}
                    >
                      {v.button_name || "Видео"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
