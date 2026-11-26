"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { FullPageSpinner } from "@/components/ui";

const noSubscribe = () => () => {};
function readUrlError(): string | null {
  return (
    new URLSearchParams(window.location.search).get("error_description") ??
    new URLSearchParams(window.location.hash.slice(1)).get("error_description")
  );
}

// Google redirects here with ?code=...; the Supabase client (detectSessionInUrl + PKCE)
// exchanges it automatically, then useAuth sees the session and we route onwards.
export default function AuthCallback() {
  const auth = useAuth();
  const router = useRouter();
  const error = useSyncExternalStore(noSubscribe, readUrlError, () => null);

  useEffect(() => {
    if (auth.status === "signed_in") router.replace(auth.profile ? "/home" : "/onboarding");
  }, [auth, router]);

  if (error || auth.status === "signed_out") {
    return (
      <main className="grid min-h-dvh place-items-center px-5 text-center">
        <div>
          <p className="font-medium">Sign-in didn&apos;t complete</p>
          {error && <p className="mt-1 text-sm text-ink-soft">{error}</p>}
          <Link href="/login" className="mt-4 inline-block text-sm font-medium text-brand">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }
  return <FullPageSpinner />;
}
