import { useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

function starLabel(value: number) {
  return `${value} ${value === 1 ? "star" : "stars"}`;
}

export interface StarRatingInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
  invalid?: boolean;
  "aria-describedby"?: string;
}

/**
 * 1–5 star picker. A radio group under the hood, so it works with mouse, touch,
 * arrow keys and screen readers ("3 stars, radio button, 3 of 5").
 */
export function StarRatingInput({
  value,
  onChange,
  disabled,
  invalid,
  "aria-describedby": describedBy,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value ?? 0;

  return (
    <RadioGroupPrimitive.Root
      aria-label="Rating"
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      orientation="horizontal"
      value={value ? String(value) : ""}
      onValueChange={(next) => onChange(Number(next))}
      disabled={disabled}
      className="flex items-center gap-1"
      onMouseLeave={() => setHovered(null)}
    >
      {STARS.map((star) => (
        <RadioGroupPrimitive.Item
          key={star}
          value={String(star)}
          aria-label={starLabel(star)}
          onMouseEnter={() => setHovered(star)}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full",
            "transition-transform duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Star
            size={28}
            strokeWidth={1.75}
            aria-hidden="true"
            className={star <= shown ? "fill-amber-400 text-amber-400" : "text-zinc-300"}
          />
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

/** Read-only stars, announced as one image: "Rated 4 out of 5 stars". */
export function StarRatingDisplay({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span role="img" aria-label={`Rated ${value} out of 5 stars`} className={cn("inline-flex items-center gap-0.5", className)}>
      {STARS.map((star) => (
        <Star
          key={star}
          size={size}
          strokeWidth={1.75}
          aria-hidden="true"
          className={star <= value ? "fill-amber-400 text-amber-400" : "text-zinc-300"}
        />
      ))}
    </span>
  );
}
