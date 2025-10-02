import { X } from "lucide-react";
import type { AttachItem } from "../../types";

export default function AttachPreview({
  attachments,
  removeOne,
}: {
  attachments: AttachItem[];
  removeOne: (id: string) => void;
}) {
  if (!attachments.length) return null;
  return (
    <div className="w-full px-3 pt-2 pb-1 border-b border-[#101921] bg-[#17212b]">
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <div
            key={a.id}
            className="relative rounded-lg overflow-hidden border border-[#223243] max-w-[120px] max-h-[120px]"
            title={a.file.name}
          >
            {a.kind === "image" ? (
              <img
                src={a.url}
                className="block w-[120px] h-[120px] object-cover"
              />
            ) : (
              <video
                src={a.url}
                className="block w-[120px] h-[120px] object-cover"
                muted
                loop
                playsInline
                controls={false}
                onMouseEnter={(e) =>
                  (e.currentTarget as HTMLVideoElement).play()
                }
                onMouseLeave={(e) =>
                  (e.currentTarget as HTMLVideoElement).pause()
                }
              />
            )}

            <button
              onClick={() => removeOne(a.id)}
              className="absolute top-1 right-1 p-1 bg-black/60 rounded-full"
              aria-label="Удалить вложение"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
