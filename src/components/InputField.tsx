import type { InputHTMLAttributes } from "react";
import React from "react";
import { Search } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  animateFrom?: "left" | "right" | "center";
  activeColor?: string;
  /** Показать слева иконку поиска */
  withSearchIcon?: boolean;
}

const InputField: React.FC<InputProps> = ({
  className = "",
  animateFrom = "center",
  activeColor = "bg-xactive",
  withSearchIcon = false,
  ...rest
}) => {
  const positionClass =
    animateFrom === "left"
      ? "left-0"
      : animateFrom === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <div className="relative w-full">
      {withSearchIcon && (
        <Search
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-xinactive pointer-events-none"
        />
      )}

      <input
        {...rest}
        className={`peer w-full py-2 ${
          withSearchIcon ? "pl-9 pr-4" : "px-4"
        } placeholder:text-xinactive border-b border-xbor outline-none bg-transparent 
        focus:border-transparent transition-colors duration-300 ${className}`}
      />

      <span
        className={`absolute ${positionClass} bottom-0 h-[2px] w-0 opacity-0 ${activeColor} 
          transition-all duration-300 peer-focus:w-full peer-focus:opacity-100`}
      />
    </div>
  );
};

export default InputField;
