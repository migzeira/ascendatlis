import { cn } from "@/lib/utils";

interface NumberDisplayProps {
  value: string | number;
  align?: "left" | "right";
  size?: "xl" | "lg";
  className?: string;
}

/**
 * Signature number for the ASCEND Index.
 * Default: left-aligned, foreground color, outside any card.
 * Never orange, never centered, never inside a card.
 */
export function NumberDisplay({
  value,
  align = "left",
  size = "xl",
  className,
}: NumberDisplayProps) {
  return (
    <div
      className={cn(
        "text-foreground leading-none tracking-tight",
        align === "left" ? "text-left" : "text-right",
        size === "xl"
          ? "text-[clamp(6rem,18vw,14rem)]"
          : "text-[clamp(4rem,10vw,8rem)]",
        className
      )}
      style={{
        fontFamily: "var(--font-display)",
        fontStretch: "125%",
        fontWeight: 600,
      }}
    >
      {value}
    </div>
  );
}
