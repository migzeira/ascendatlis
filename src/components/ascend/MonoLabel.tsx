import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function MonoLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </span>
  );
}
