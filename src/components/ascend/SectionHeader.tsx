import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  number: string;
  title: string;
  className?: string;
}

/**
 * Section marker: "NN / TÍTULO" in mono, uppercase.
 */
export function SectionHeader({ number, title, className }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground",
        className
      )}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <span className="text-foreground">{number.padStart(2, "0")}</span>
      <span aria-hidden="true">/</span>
      <span className="text-foreground">{title}</span>
    </div>
  );
}
