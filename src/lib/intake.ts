"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Local calendar day (India users eat on IST days, not UTC days). */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(localDay(d));
  }
  return out;
}

export type IntakeRow = {
  id: number;
  scan_id: string | null;
  day: string;
  servings: number;
  calories: number;
  sugar_g: number;
  sodium_mg: number;
  fat_g: number;
  sat_fat_g: number;
  protein_g: number;
  created_at: string;
  scans?: { product_name: string | null; verdict: string | null } | null;
};

/** Intake rows for the last `days` days (including today), newest first. */
export function useIntake(userId: string, days = 7) {
  const [rows, setRows] = useState<IntakeRow[] | null>(null);
  const since = lastNDays(days)[0];

  const load = useCallback(async () => {
    const { data } = await supabase()
      .from("daily_intake")
      .select("id, scan_id, day, servings, calories, sugar_g, sodium_mg, fat_g, sat_fat_g, protein_g, created_at, scans(product_name, verdict)")
      .eq("user_id", userId)
      .gte("day", since)
      .order("created_at", { ascending: false });
    setRows((data as unknown as IntakeRow[]) ?? []);
  }, [userId, since]);

  useEffect(() => {
    let live = true;
    supabase()
      .from("daily_intake")
      .select("id, scan_id, day, servings, calories, sugar_g, sodium_mg, fat_g, sat_fat_g, protein_g, created_at, scans(product_name, verdict)")
      .eq("user_id", userId)
      .gte("day", since)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (live) setRows((data as unknown as IntakeRow[]) ?? []);
      });
    return () => {
      live = false;
    };
  }, [userId, since]);

  return { rows, reload: load };
}

export type Totals = { calories: number; sugar_g: number; sodium_mg: number; sat_fat_g: number; protein_g: number };

export function totalsFor(rows: IntakeRow[], day: string): Totals {
  return rows
    .filter((r) => r.day === day)
    .reduce(
      (t, r) => ({
        calories: t.calories + Number(r.calories),
        sugar_g: t.sugar_g + Number(r.sugar_g),
        sodium_mg: t.sodium_mg + Number(r.sodium_mg),
        sat_fat_g: t.sat_fat_g + Number(r.sat_fat_g),
        protein_g: t.protein_g + Number(r.protein_g),
      }),
      { calories: 0, sugar_g: 0, sodium_mg: 0, sat_fat_g: 0, protein_g: 0 },
    );
}
