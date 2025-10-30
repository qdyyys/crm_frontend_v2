import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";

type ImageProps = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  enableViewer?: boolean;
};

const ImagePreload: React.FC<ImageProps> = ({
  src,
  alt = "image",
  width,
  height,
  className = "",
  style,
  enableViewer = false,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const hasCustomRounded =
    /(?:^|\s)rounded(?:-(?:sm|md|lg|xl|2xl|3xl|full))?/.test(className);
  const roundedClass = hasCustomRounded ? "" : "rounded-full";

  const canOpen = enableViewer && !!src;

  const openViewer = () => {
    if (!canOpen) return;
    setOpen(true);
  };
  const closeViewer = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const overlay = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md"
      style={{ zIndex: 2147483647 }}
      aria-modal="true"
      role="dialog"
      onClick={closeViewer}
    >
      <div
        className="relative max-w-[95vw] max-h-[95vh] rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-[95vw] max-h-[95vh] object-contain select-none"
          draggable={false}
        />
      </div>
      <button
        onClick={closeViewer}
        className="absolute top-0 right-0 cursor-pointer hover:bg-[#4a4a4ab8] py-2 px-4 hover:text-white text-[#d3cdcdb8] transition-all"
        style={{ zIndex: 2147483647 }}
      >
        <X strokeWidth={1.5} size={18} />
      </button>
    </div>
  );

  return (
    <>
      <div
        style={{ width, height, ...style }}
        className={clsx(
          "relative overflow-hidden shrink-0",
          roundedClass,
          canOpen && "cursor-pointer",
          className
        )}
        onClick={openViewer}
        role={canOpen ? "button" : undefined}
        aria-label={alt}
      >
        {!loaded && (
          <div className="absolute inset-0 animate-pulse bg-[#1f2c3a]" />
        )}
        <img
          src={`${src}`} // TODO delete this
          alt={""}
          width={width}
          height={height}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={clsx(
            "object-cover w-full h-full transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {open && enableViewer && createPortal(overlay, document.body)}
    </>
  );
};

export default ImagePreload;
