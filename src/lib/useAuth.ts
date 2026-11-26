"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Profile = {
  user_id: string;
  full_name: string;
  dob: string;
  gender: string | null;
  height_cm: number;
  weight_kg: number;
  activity_level: string;
  conditions: string[];
  allergies: string[];
  diet_prefs: string[];
  goals: string[];
  health_text: string;
  bmi: number | null;
  bmr_kcal: number | null;
  daily_kcal: number | null;
  rulebook: Record<string, unknown> | null;
  processing_status: string;
};

type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; session: Session; profile: Profile | null };

/** Current session + the user's profile row (null until onboarding is done). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const sb = supabase();
    let active = true;

    async function load(session: Session | null) {
      if (!session) {
        if (active) setState({ status: "signed_out" });
        return;
      }
      const { data } = await sb
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (active) setState({ status: "signed_in", session, profile: (data as Profile) ?? null });
    }

    sb.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
