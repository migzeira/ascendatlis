import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

interface LockedCardProps {
  title: string;
  source: string;
  className?: string;
}

/**
 * Blocked pillar card: dashed border, transparent bg, no opacity, no blur, no "em breve".
 * Renders title + future source, per AGENTS §6/§11.
 */
export function LockedCard({ title, source, className }: LockedCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-dashed border-border bg-transparent p-5",
        className
      )}
    >
      <Eyebrow>Bloqueado</Eyebrow>
      <div className="text-lg text-foreground">{title}</div>
      <div
        className="text-xs text-muted-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Fonte: {source}
      </div>
    </div>
  );
}
