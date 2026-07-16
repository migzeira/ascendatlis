import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "text-xs uppercase tracking-[0.18em] text-muted-foreground",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </span>
  );
}
