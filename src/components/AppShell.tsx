"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileHeart, HeartPulse, Home, LogIn, LogOut, Mail, Menu, ScanLine, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile } from "@/lib/useAuth";
import { FullPageSpinner, Logo, cn } from "./ui";

const LINKS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/scan", label: "Scan a label", icon: ScanLine },
  { href: "/onboarding", label: "Health profile", icon: HeartPulse },
  { href: "/documents", label: "My documents", icon: FileHeart },
  { href: "/contact", label: "Contact", icon: Mail },
];

export type SignedIn = { session: Session; profile: Profile | null };

/** Signed-in page frame: sticky header with logo + Menu drawer. Redirects signed-out users to /login. */
export function AppShell({
  children,
  requireProfile = true,
}: {
  children: (auth: SignedIn) => ReactNode;
  requireProfile?: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (auth.status === "signed_out") router.replace("/login");
    if (requireProfile && auth.status === "signed_in" && !auth.profile) router.replace("/onboarding");
  }, [auth, router, requireProfile]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (auth.status !== "signed_in" || (requireProfile && !auth.profile)) return <FullPageSpinner />;
  const name = auth.profile?.full_name ?? auth.session.user.email ?? "";
  const email = auth.session.user.email ?? "";

  async function signOut() {
    setOpen(false);
    await supabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/home" aria-label="SmartPack home">
            <Logo />
          </Link>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-medium text-ink shadow-sm hover:bg-muted"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="h-4 w-4" /> Menu
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              key="drawer"
              className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-sm flex-col bg-white shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              aria-label="Main menu"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <Logo />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-ink" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mx-5 mt-5 flex items-center gap-3 rounded-2xl bg-brand-soft p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-lg font-semibold text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{name}</span>
                  <span className="block truncate text-xs text-ink-soft">{email}</span>
                </span>
              </div>

              <motion.ul
                className="mt-4 flex-1 space-y-1 px-3"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } } }}
              >
                {LINKS.map((l) => {
                  const active = path?.replace(/\/$/, "").endsWith(l.href);
                  return (
                    <motion.li key={l.href} variants={{ hidden: { opacity: 0, x: 16 }, show: { opacity: 1, x: 0 } }}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors",
                          active ? "bg-brand text-white" : "text-ink hover:bg-muted",
                        )}
                      >
                        <l.icon className={cn("h-5 w-5", active ? "text-white" : "text-brand")} />
                        {l.label}
                      </Link>
                    </motion.li>
                  );
                })}
              </motion.ul>

              <div className="border-t border-line p-4">
                <button
                  onClick={signOut}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-bad/30 px-3 py-3 text-sm font-semibold text-bad hover:bg-bad/5"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
                <Link
                  href="/login"
                  onClick={signOut}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-ink-soft hover:bg-muted"
                >
                  <LogIn className="h-3.5 w-3.5" /> Sign in with another account
                </Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-3xl px-5 pt-6 pb-20">{children({ session: auth.session, profile: auth.profile })}</main>
    </div>
  );
}
