import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
}

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Conexões", to: "/connect" },
  { label: "Ajustes", to: "/settings" },
];



/**
 * ASCEND shell:
 * - Desktop: fixed sidebar on the left.
 * - Mobile: fixed top header with a drawer.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-sidebar px-6 py-8 md:flex">
        <Wordmark />
        <nav className="mt-12 flex flex-col gap-1">
          {NAV.map((item) => (
            <SidebarLink key={item.label} {...item} />
          ))}
        </nav>
        <div
          className="mt-auto text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          v0.1 · alpha
        </div>
      </aside>

      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-4 md:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="text-foreground"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-x-0 top-[57px] z-30 border-b border-border bg-background px-4 py-6 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <SidebarLink
                key={item.label}
                {...item}
                onClick={() => setOpen(false)}
              />
            ))}
          </nav>
        </div>
      ) : null}

      <main className="pt-[73px] md:ml-56 md:pt-0">
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-12 md:py-16">
          {children}
        </div>
      </main>
    </div>
  );
}

function Wordmark() {
  return (
    <Link
      to="/"
      className="inline-flex items-baseline gap-2 text-foreground"
      style={{ fontFamily: "var(--font-display)", fontStretch: "125%" }}
    >
      <span className="text-lg font-semibold tracking-tight">ascend</span>
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
    </Link>
  );
}

function SidebarLink({
  label,
  to,
  onClick,
}: NavItem & { onClick?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "rounded px-3 py-2 text-sm text-muted-foreground transition-colors",
        "hover:bg-sidebar-accent hover:text-foreground"
      )}
      activeProps={{ className: "bg-sidebar-accent text-foreground" }}
    >
      {label}
    </Link>
  );
}
