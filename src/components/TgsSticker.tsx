import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import pako from "pako";

interface TgsStickerProps {
  url: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  fit?: "contain" | "cover";
}

export const TgsSticker: React.FC<TgsStickerProps> = ({
  url,
  width = "100%",
  height = "100%",
  className,
  fit = "contain",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let anim: any;

    const loadTgs = async () => {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        let jsonStr: string;

        try {
          jsonStr = pako.inflate(new Uint8Array(buf), {
            to: "string",
          }) as string;
        } catch {
          jsonStr = pako.inflateRaw(new Uint8Array(buf), {
            to: "string",
          }) as string;
        }

        const animationData = JSON.parse(jsonStr);

        if (containerRef.current) {
          anim = lottie.loadAnimation({
            container: containerRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData,
            rendererSettings: {
              preserveAspectRatio:
                fit === "cover" ? "xMidYMid slice" : "xMidYMid meet",
              progressiveLoad: true,
              hideOnTransparent: false,
            } as any,
          });

          const ensureSizing = () => {
            const svg = containerRef.current?.querySelector(
              "svg"
            ) as SVGElement | null;
            if (svg) {
              svg.removeAttribute("width");
              svg.removeAttribute("height");
              (svg.style as any).width = "100%";
              (svg.style as any).height = "100%";
              (svg.style as any).display = "block";
            }
          };

          ensureSizing();
          setTimeout(ensureSizing, 0);
        }
      } catch (e) {
        console.error("Failed to load TGS:", e);
      }
    };

    loadTgs();

    return () => {
      if (anim) anim.destroy();
    };
  }, [url, fit]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        display: "block",
      }}
    />
  );
};
