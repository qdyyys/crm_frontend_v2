type Size = "sm" | "md" | "lg";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  size?: Size;
  className?: string;
};

const SIZES: Record<
  Size,
  {
    trackW: string;
    trackH: string;
    knobWH: string;
    knobInset: string;
    translateX: string;
    gap: string;
    labelText: string;
  }
> = {
  sm: {
    trackW: "w-[36px]",
    trackH: "h-[20px]",
    knobWH: "after:w-[16px] after:h-[16px]",
    knobInset: "after:top-[2px] after:left-[2px]",
    translateX: "peer-checked:after:translate-x-[16px]",
    gap: "gap-2",
    labelText: "text-xs",
  },
  md: {
    trackW: "w-[46px]",
    trackH: "h-[26px]",
    knobWH: "after:w-[20px] after:h-[20px]",
    knobInset: "after:top-[3px] after:left-[3px]",
    translateX: "peer-checked:after:translate-x-[20px]",
    gap: "gap-3",
    labelText: "text-sm",
  },
  lg: {
    trackW: "w-[56px]",
    trackH: "h-[32px]",
    knobWH: "after:w-[26px] after:h-[26px]",
    knobInset: "after:top-[3px] after:left-[3px]",
    translateX: "peer-checked:after:translate-x-[24px]",
    gap: "gap-3.5",
    labelText: "text-base",
  },
};

export default function IosSwitch({
  checked,
  disabled,
  onChange,
  label,
  size = "sm",
  className = "",
}: Props) {
  const s = SIZES[size];

  return (
    <label
      className={`inline-flex items-center ${s.gap} select-none ${className} ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      {label ? (
        <span className={`${s.labelText} text-white/90`}>{label}</span>
      ) : null}

      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />

      <span
        className={`
          relative inline-block ${s.trackW} ${
          s.trackH
        } rounded-full transition-colors duration-300
          ${checked ? "bg-[#2b5278]" : "bg-[#33404f]"}
          after:content-[''] after:absolute ${s.knobInset}
          ${s.knobWH} after:bg-white after:rounded-full after:shadow
          after:transition-transform after:duration-300 ${s.translateX}
        `}
      />
    </label>
  );
}
