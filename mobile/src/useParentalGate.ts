import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import client from "./api";

// ============================================================
// useParentalGate — checks whether adult-channel access requires
// a PIN and whether the current session is already unlocked.
//
// Usage:
//   const { isAdult, requiresPin, promptPin, unlocked } = useParentalGate();
//
// Call promptPin(onUnlocked) to show the PIN modal; the callback
// fires once the user enters a valid PIN (or immediately if the
// session is already unlocked / no PIN is configured).
// ============================================================

export const PARENTAL_UNLOCKED_KEY = "qtv_parental_unlocked";
export const PARENTAL_UNLOCK_TTL = 15 * 60 * 1000; // 15 minutes

/** Returns true if a channel genre/category string looks like adult content. */
export function isAdultCategory(genre?: string, category?: string): boolean {
  const haystack = `${genre || ""} ${category || ""}`.toLowerCase();
  return (
    haystack.includes("adult") ||
    haystack.includes("xxx") ||
    haystack.includes("18+") ||
    haystack.includes("erotic") ||
    haystack.includes("x-rated")
  );
}

export function useParentalGate() {
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const checkedRef = useRef(false);

  // Check stored unlock timestamp on mount
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    AsyncStorage.getItem(PARENTAL_UNLOCKED_KEY).then((val) => {
      if (val) {
        const ts = parseInt(val, 10);
        if (Date.now() - ts < PARENTAL_UNLOCK_TTL) setSessionUnlocked(true);
        else AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
      }
    });
  }, []);

  const parentalQ = useQuery({
    queryKey: ["parental-settings"],
    queryFn: async () => (await client.get("/settings/parental")).data as { enabled: boolean; pin_set: boolean },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const enabled = parentalQ.data?.enabled ?? false;
  const pinSet = parentalQ.data?.pin_set ?? false;
  const requiresPin = enabled && pinSet && !sessionUnlocked;

  const setUnlocked = useCallback(async () => {
    await AsyncStorage.setItem(PARENTAL_UNLOCKED_KEY, String(Date.now()));
    setSessionUnlocked(true);
  }, []);

  return { requiresPin, sessionUnlocked, setUnlocked };
}
