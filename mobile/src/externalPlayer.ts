import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as Application from "expo-application";
import * as IntentLauncher from "expo-intent-launcher";

const ACTION_VIEW = "android.intent.action.VIEW";

/**
 * Known Android TV / Fire TV video player packages.
 * Order matters: try stronger HLS players first.
 */
export const KNOWN_PLAYERS: Array<{
  id: string;
  label: string;
  androidPackage: string;
  /** Player's officially documented playback Activity — REQUIRED for real
   * explicit-package targeting. expo-intent-launcher's native module only
   * sets `intent.component` (i.e. actually restricts to this package) when
   * BOTH packageName AND className are given; packageName alone is
   * silently ignored, so without this the "explicit" attempt below is
   * actually just a generic implicit VIEW intent (whatever the OS
   * auto-resolves), and any "Opened with X" label would be a lie. */
  androidClassName?: string;
  schemes?: string[];
  storeQuery?: string;
}> = [
  {
    id: "vlc",
    label: "VLC",
    androidPackage: "org.videolan.vlc",
    androidClassName: "org.videolan.vlc.gui.video.VideoPlayerActivity",
    schemes: ["vlc://"],
    storeQuery: "vlc",
  },
  {
    id: "mx-tv",
    label: "MX Player TV",
    androidPackage: "com.mxtech.videoplayer.television",
    androidClassName: "com.mxtech.videoplayer.ActivityScreen",
    storeQuery: "mx player",
  },
  {
    id: "mx-pro",
    label: "MX Player Pro",
    androidPackage: "com.mxtech.videoplayer.pro",
    androidClassName: "com.mxtech.videoplayer.ActivityScreen",
    storeQuery: "mx player pro",
  },
  {
    id: "mx",
    label: "MX Player",
    androidPackage: "com.mxtech.videoplayer.ad",
    androidClassName: "com.mxtech.videoplayer.ActivityScreen",
    storeQuery: "mx player",
  },
  {
    id: "kodi",
    label: "Kodi",
    androidPackage: "org.xbmc.kodi",
    storeQuery: "kodi",
  },
  {
    id: "justplayer",
    label: "Just Player",
    androidPackage: "com.brouken.player",
    storeQuery: "just player",
  },
  {
    id: "nova",
    label: "Nova Player",
    androidPackage: "org.courville.nova",
    storeQuery: "nova player",
  },
  {
    id: "exoplayer",
    label: "ExoPlayer Demo",
    androidPackage: "com.google.android.exoplayer2.demo",
  },
];

export type PlayerProbe = {
  id: string;
  label: string;
  androidPackage: string;
  /** true/false if we could probe; null if unknown on this OS */
  installed: boolean | null;
};

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Explicit-package launch via the real Android Intent API — Linking.openURL
 * can't set a package/type on an intent, it only opens a bare ACTION_VIEW
 * on the raw URL, so it can never reliably target a specific player app.
 *
 * IMPORTANT: do NOT pass FLAG_ACTIVITY_NEW_TASK here. expo-intent-launcher's
 * native module calls startActivityForResult() and keeps a single pending
 * promise until Android delivers the result back via onActivityResult — but
 * per Android's own contract, NEW_TASK activities never deliver a result.
 * That leaves the native module's pending-promise lock permanently held
 * after the very first successful external-player launch, so every
 * subsequent call in the same app session throws
 * ActivityAlreadyStartedException immediately and silently degrades to the
 * generic Linking.openURL fallback (a bare "System handler" open) instead
 * of correctly targeting MX Player/VLC/etc. Omitting the flag lets Android
 * deliver the result when the user backs out of the external player,
 * clearing the lock and keeping every later launch working. */
async function tryStartActivity(opts: {
  data: string;
  type?: string;
  packageName?: string;
  className?: string;
}): Promise<boolean> {
  try {
    await IntentLauncher.startActivityAsync(ACTION_VIEW, {
      data: opts.data,
      type: opts.type,
      packageName: opts.packageName,
      className: opts.className,
    });
    return true;
  } catch (e) {
    // Swallowing this error previously made external-player failures
    // impossible to diagnose remotely (only "plain-url" fallback was ever
    // visible in logs). Log it so `adb logcat` shows the real reason
    // (e.g. native module missing, ActivityNotFoundException, etc.)
    if (__DEV__) {
      console.warn("[externalPlayer] tryStartActivity failed", opts.packageName, e);
    } else {
      console.warn(
        "[externalPlayer] tryStartActivity failed",
        opts.packageName,
        (e as any)?.message || e
      );
    }
    return false;
  }
}


/**
 * Probe whether common players look installed.
 * On modern Android, canOpenURL/package visibility is limited, so "unknown"
 * is common — the launch path still tries package-targeted intents.
 */
export async function probeInstalledPlayers(): Promise<PlayerProbe[]> {
  if (Platform.OS !== "android") {
    const out: PlayerProbe[] = [];
    for (const p of KNOWN_PLAYERS) {
      let installed: boolean | null = null;
      if (p.schemes?.length) {
        try {
          installed = await Linking.canOpenURL(p.schemes[0] + "https://example.com/test.m3u8");
        } catch {
          installed = null;
        }
      }
      out.push({
        id: p.id,
        label: p.label,
        androidPackage: p.androidPackage,
        installed,
      });
    }
    return out;
  }

  const out: PlayerProbe[] = [];
  for (const p of KNOWN_PLAYERS) {
    let installed: boolean | null = null;
    // Prefer scheme probe when available (VLC).
    if (p.schemes?.length) {
      try {
        installed = await Linking.canOpenURL(`${p.schemes[0]}https://example.com/x.m3u8`);
      } catch {
        installed = null;
      }
    }
    // Package deep-link probe (works on some Fire TV firmwares).
    if (installed !== true) {
      try {
        const ok = await Linking.canOpenURL(`market://details?id=${p.androidPackage}`);
        // market link existing does NOT mean app is installed — leave unknown.
        if (installed === null && !ok) installed = null;
      } catch {
        /* ignore */
      }
    }
    out.push({
      id: p.id,
      label: p.label,
      androidPackage: p.androidPackage,
      installed,
    });
  }
  return out;
}

export type LaunchResult =
  | { ok: true; method: string; playerLabel?: string }
  | { ok: false; reason: "no-player" | "bad-url"; tried: string[] };

/**
 * Launch stream in an external player using multiple strategies.
 * Never trusts a single intent form — Fire TV / Android TV are inconsistent.
 */
export async function launchExternalPlayer(streamUrl: string): Promise<LaunchResult> {
  if (!streamUrl || typeof streamUrl !== "string") {
    return { ok: false, reason: "bad-url", tried: [] };
  }

  const tried: string[] = [];
  const isTs = /\.ts(\?|$)/i.test(streamUrl);
  const isM3u8 = /\.m3u8(\?|$)/i.test(streamUrl);
  const mime = isM3u8 ? "application/x-mpegURL" : isTs ? "video/mp2t" : "video/*";

  if (Platform.OS === "android") {
    // 1) Explicit-package Intents for known players (real Android Intent API —
    // works whether or not the target declares a matching data/mime filter,
    // since packageName alone is enough to resolve the component).
    for (const p of KNOWN_PLAYERS) {
      // Skip candidates we can't actually target explicitly — packageName
      // alone doesn't restrict the intent (see androidClassName doc above),
      // so without a known className this would just be a duplicate of the
      // generic attempt below, wasting an intent-launcher call for nothing.
      if (!p.androidClassName) continue;
      tried.push(`intent-pkg:${p.androidPackage}`);
      if (await tryStartActivity({ data: streamUrl, type: mime, packageName: p.androidPackage, className: p.androidClassName })) {
        return { ok: true, method: `intent-package:${p.androidPackage}`, playerLabel: p.label };
      }
    }

    // 2) Generic video intent (lets Android's chooser pick, or auto-resolve
    // if only one app matches)
    tried.push("intent-generic-video");
    if (await tryStartActivity({ data: streamUrl, type: mime })) {
      return { ok: true, method: "intent-generic", playerLabel: "System player" };
    }

    // 3) Generic without mime — some players only match a bare VIEW+data
    tried.push("intent-bare");
    if (await tryStartActivity({ data: streamUrl })) {
      return { ok: true, method: "intent-bare", playerLabel: "System player" };
    }

    // 4) VLC custom scheme (real scheme VLC's manifest declares — safe via Linking)
    tried.push("vlc-scheme");
    if (await tryOpen(`vlc://${streamUrl}`)) {
      return { ok: true, method: "vlc-scheme", playerLabel: "VLC" };
    }

    // 5) Plain HTTPS/HTTP open — last-resort fallback for very old/oddball
    // Fire OS builds where the above may not resolve any component.
    tried.push("plain-url");
    if (await tryOpen(streamUrl)) {
      return { ok: true, method: "plain-url", playerLabel: "System handler" };
    }

    return { ok: false, reason: "no-player", tried };
  }

  // iOS / other
  tried.push("vlc-scheme");
  try {
    const vlc = `vlc://${streamUrl}`;
    if (await Linking.canOpenURL(vlc)) {
      if (await tryOpen(vlc)) return { ok: true, method: "vlc-scheme", playerLabel: "VLC" };
    }
  } catch {
    /* ignore */
  }
  tried.push("plain-url");
  if (await tryOpen(streamUrl)) {
    return { ok: true, method: "plain-url" };
  }
  return { ok: false, reason: "no-player", tried };
}

export function openPlayerStore(playerId = "vlc") {
  const p = KNOWN_PLAYERS.find((x) => x.id === playerId) || KNOWN_PLAYERS[0];
  const q = encodeURIComponent(p.storeQuery || p.label);
  const pkg = p.androidPackage;
  // Fire TV Amazon store, then Play Store, then web.
  return Linking.openURL(`amzn://apps/android?p=${pkg}`).catch(() =>
    Linking.openURL(`amzn://apps/android?s=${q}`).catch(() =>
      Linking.openURL(`market://details?id=${pkg}`).catch(() =>
        Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`).catch(() =>
          Linking.openURL(`https://www.amazon.com/s?k=${q}`).catch(() => undefined),
        ),
      ),
    ),
  );
}

export function getDeviceLabel(): string {
  const name = Application.applicationName || "Quantum TV";
  return `${name} · ${Platform.OS}`;
}
