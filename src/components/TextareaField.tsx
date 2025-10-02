import React, {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";
import clsx from "clsx";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  maxRows?: number;
  animateFrom?: "left" | "right" | "center";
  activeColor?: string;
  focusBorderClass?: string;
};

const TextareaField = forwardRef<HTMLTextAreaElement, Props>(
  function TextareaField(
    {
      className = "",
      maxRows,
      animateFrom = "center",
      activeColor = "bg-xactive",
      focusBorderClass = "focus:border-transparent",
      onChange,
      ...rest
    },
    ref
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref)
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
            el;
      },
      [ref]
    );

    const autoGrow = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;

      el.style.height = "0px";
      const cs = window.getComputedStyle(el);

      const lineH = parseFloat(cs.lineHeight || "20");
      const padY =
        parseFloat(cs.paddingTop || "0") +
        parseFloat(cs.paddingBottom || "0") +
        parseFloat(cs.borderTopWidth || "0") +
        parseFloat(cs.borderBottomWidth || "0");

      const fullScrollH = el.scrollHeight;

      if (maxRows && maxRows > 0) {
        const maxPx = Math.ceil(lineH * maxRows + padY);
        el.style.height = Math.min(fullScrollH, maxPx) + "px";
      } else {
        el.style.height = fullScrollH + "px";
      }
    }, [maxRows]);

    useLayoutEffect(() => {
      autoGrow();
    }, [autoGrow, (rest as any).value]);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      autoGrow();
      onChange?.(e);
    };

    const positionClass =
      animateFrom === "left"
        ? "left-0"
        : animateFrom === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

    return (
      <div className="relative w-full">
        <textarea
          {...rest}
          ref={setRef}
          rows={1}
          onChange={handleChange}
          className={clsx(
            "peer w-full py-2 px-4",
            "placeholder:text-xinactive",
            "border-b border-xbor outline-none bg-transparent",
            "transition-colors duration-300",
            focusBorderClass,
            "resize-none overflow-hidden",
            "leading-[1.25]",
            className
          )}
          style={{ height: "auto" }}
        />

        <span
          className={`pointer-events-none absolute ${positionClass} bottom-0 h-[2px] w-0 opacity-0 ${activeColor}
          transition-all duration-300 peer-focus:w-full peer-focus:opacity-100`}
        />
      </div>
    );
  }
);

export default TextareaField;
