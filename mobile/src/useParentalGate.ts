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
/** Device preference: adult channels are OFF by default until the user enables them. */
export const ADULT_CHANNELS_ENABLED_KEY = "qtv_adult_channels_enabled";

/** Returns true if a channel genre/category string looks like adult content. */
export function isAdultCategory(genre?: string, category?: string, title?: string): boolean {
  const haystack = `${genre || ""} ${category || ""} ${title || ""}`.toLowerCase();
  return (
    haystack.includes("adult") ||
    haystack.includes("xxx") ||
    haystack.includes("18+") ||
    haystack.includes("erotic") ||
    haystack.includes("x-rated") ||
    haystack.includes("xrated") ||
    haystack.includes("porn") ||
    haystack.includes("18plus") ||
    haystack.includes("explicit") ||
    haystack.includes("playboy") ||
    haystack.includes("hustler") ||
    haystack.includes("penthouse") ||
    haystack.includes("brazzers") ||
    haystack.includes("bangbros") ||
    haystack.includes("nudity") ||
    /\b18\s*\+/.test(haystack) ||
    /[\[\(]\s*x{1,3}\s*[\]\)]/i.test(haystack)
  );
}

export function useParentalGate() {
  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [adultChannelsEnabled, setAdultChannelsEnabledState] = useState(false);
  const checkedRef = useRef(false);

  // Check stored unlock timestamp + adult visibility preference on mount
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    AsyncStorage.multiGet([PARENTAL_UNLOCKED_KEY, ADULT_CHANNELS_ENABLED_KEY]).then((pairs) => {
      const map = Object.fromEntries(pairs);
      const unlockVal = map[PARENTAL_UNLOCKED_KEY];
      if (unlockVal) {
        const ts = parseInt(unlockVal, 10);
        if (Date.now() - ts < PARENTAL_UNLOCK_TTL) setSessionUnlocked(true);
        else AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
      }
      // Default OFF unless explicitly set to "1"
      setAdultChannelsEnabledState(map[ADULT_CHANNELS_ENABLED_KEY] === "1");
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
  // Always require a gate for adult content unless the user has enabled adult
  // channels on this device AND (if admin PIN lock is on) the session is unlocked.
  const requiresPin = !adultChannelsEnabled || (enabled && pinSet && !sessionUnlocked);

  const setUnlocked = useCallback(async () => {
    await AsyncStorage.setItem(PARENTAL_UNLOCKED_KEY, String(Date.now()));
    setSessionUnlocked(true);
  }, []);

  const setAdultChannelsEnabled = useCallback(async (on: boolean) => {
    await AsyncStorage.setItem(ADULT_CHANNELS_ENABLED_KEY, on ? "1" : "0");
    setAdultChannelsEnabledState(on);
    if (!on) {
      await AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
      setSessionUnlocked(false);
    }
  }, []);

  return {
    requiresPin,
    sessionUnlocked,
    setUnlocked,
    adultChannelsEnabled,
    setAdultChannelsEnabled,
    pinLockEnabled: enabled,
    pinSet,
  };
}
