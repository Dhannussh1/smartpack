"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Session } from "@supabase/supabase-js";
import { Bot, FileHeart, HeartPulse, History, Home, LogOut, Mail, Menu, ScanLine, X, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile } from "@/lib/useAuth";
import { FullPageSpinner, Logo, cn } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon };
const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Everyday",
    items: [
      { href: "/home", label: "Overview", icon: Home },
      { href: "/scan", label: "Scan a label", icon: ScanLine },
      { href: "/assistant", label: "Assistant", icon: Bot },
      { href: "/history", label: "Scan history", icon: History },
    ],
  },
  {
    title: "My health",
    items: [
      { href: "/onboarding", label: "Health profile", icon: HeartPulse },
      { href: "/documents", label: "Documents", icon: FileHeart },
    ],
  },
  { title: "Support", items: [{ href: "/contact", label: "Contact", icon: Mail }] },
];
const TABS: NavItem[] = [
  { href: "/home", label: "Overview", icon: Home },
  { href: "/assistant", label: "Assistant", icon: Bot },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/history", label: "History", icon: History },
  { href: "/documents", label: "Docs", icon: FileHeart },
];

export type SignedIn = { session: Session; profile: Profile | null };

function useActive() {
  const path = usePathname()?.replace(/\/$/, "") ?? "";
  return (href: string) => path.endsWith(href);
}

/** Application frame: desktop sidebar, mobile top bar + drawer + bottom tabs. Redirects signed-out users. */
export function AppShell({
  children,
  requireProfile = true,
}: {
  children: (auth: SignedIn) => ReactNode;
  requireProfile?: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();
  const isActive = useActive();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
    if (requireProfile && auth.status === "signed_in" && !auth.profile) router.replace("/onboarding");
  }, [auth, router, requireProfile]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (auth.status !== "signed_in" || (requireProfile && !auth.profile)) return <FullPageSpinner />;
  const name = auth.profile?.full_name ?? auth.session.user.email ?? "";
  const email = auth.session.user.email ?? "";

  async function signOut() {
    setOpen(false);
    await supabase().auth.signOut();
    router.replace("/login");
  }

  const nav = (onNavigate?: () => void) => (
    <nav className="space-y-7">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-[11px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{g.title}</p>
          <ul className="mt-2 space-y-0.5">
            {g.items.map((l) => {
              const active = isActive(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors",
                      active ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-line" : "text-ink-soft hover:bg-white/60 hover:text-ink",
                    )}
                  >
                    {/* plain marker: a shared layoutId here (rendered in both sidebar and drawer) kept the closing drawer alive */}
                    {active && <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-brand" />}
                    <l.icon className={cn("h-[18px] w-[18px]", active ? "text-brand" : "text-ink-faint group-hover:text-ink-soft")} strokeWidth={1.8} />
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const userCard = (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block truncate text-xs text-ink-faint">{email}</span>
        </span>
      </div>
      <button
        onClick={signOut}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-bad/40 hover:text-bad"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-page">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-muted/50 px-4 py-6 lg:flex">
        <Link href="/home" className="px-3">
          <Logo />
        </Link>
        <div className="mt-10 flex-1 overflow-y-auto">{nav()}</div>
        {userCard}
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/home">
            <Logo />
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="h-4 w-4" /> Menu
          </button>
        </div>
      </header>

      {/* mobile drawer */}
      {/* Scrim and drawer are separate direct children: AnimatePresence cannot track exits through a
          Fragment, which left an invisible drawer on screen that swallowed taps after closing. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
        {open && (
            <motion.div
              key="drawer"
              className="fixed inset-y-0 right-0 z-50 flex w-[84%] max-w-xs flex-col bg-page px-4 py-5 shadow-2xl lg:hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <div className="flex items-center justify-between px-3">
                <Logo />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-soft hover:bg-muted" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-8 flex-1 overflow-y-auto">{nav(() => setOpen(false))}</div>
              {userCard}
            </motion.div>
        )}
      </AnimatePresence>

      {/* content */}
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-5xl px-5 pt-8 pb-32 sm:px-8 lg:px-12 lg:pt-12 lg:pb-16">
          {children({ session: auth.session, profile: auth.profile })}
        </main>
      </div>

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Primary">
        <ul className="grid grid-cols-5">
          {TABS.map((t) => {
            const active = isActive(t.href);
            const primary = t.href === "/scan";
            return (
              <li key={t.href}>
                <Link href={t.href} className="flex flex-col items-center gap-1 pt-2 pb-2.5 text-[11px] font-medium">
                  {primary ? (
                    <span className="-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-brand text-white shadow-[0_8px_20px_-8px_rgb(31_111_74/0.9)] ring-4 ring-white">
                      <t.icon className="h-5 w-5" />
                    </span>
                  ) : (
                    <t.icon className={cn("h-5 w-5", active ? "text-brand" : "text-ink-faint")} strokeWidth={1.8} />
                  )}
                  <span className={cn(active ? "text-ink" : "text-ink-faint")}>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Consistent page heading used on every app page. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">{eyebrow}</p>}
        <h1 className="mt-2 font-display text-4xl leading-[1.05] tracking-tight text-ink sm:text-[44px]">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

/** Section block with a small heading and optional action. */
export function Section({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-12", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-end justify-between gap-4">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
