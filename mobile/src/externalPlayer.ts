import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as Application from "expo-application";

/**
 * Known Android TV / Fire TV video player packages.
 * Order matters: try stronger HLS players first.
 */
export const KNOWN_PLAYERS: Array<{
  id: string;
  label: string;
  androidPackage: string;
  schemes?: string[];
  storeQuery?: string;
}> = [
  {
    id: "vlc",
    label: "VLC",
    androidPackage: "org.videolan.vlc",
    schemes: ["vlc://"],
    storeQuery: "vlc",
  },
  {
    id: "mx-tv",
    label: "MX Player TV",
    androidPackage: "com.mxtech.videoplayer.television",
    storeQuery: "mx player",
  },
  {
    id: "mx-pro",
    label: "MX Player Pro",
    androidPackage: "com.mxtech.videoplayer.pro",
    storeQuery: "mx player pro",
  },
  {
    id: "mx",
    label: "MX Player",
    androidPackage: "com.mxtech.videoplayer.ad",
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

function buildIntentUrl(streamUrl: string, opts?: { pkg?: string; mime?: string }): string {
  // Intent URLs break if the stream URL is not carefully encoded. Prefer
  // intentional S.browser_fallback_url-free form used by Android TV launchers.
  const mime = opts?.mime || "video/*";
  const pkgPart = opts?.pkg ? `package=${opts.pkg};` : "";
  // Keep stream URL raw after intent: — Android resolves it as the data URI.
  return `intent:${streamUrl}#Intent;action=android.intent.action.VIEW;type=${mime};${pkgPart}end`;
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
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
    // 1) Package-targeted intents for known players
    for (const p of KNOWN_PLAYERS) {
      const intent = buildIntentUrl(streamUrl, { pkg: p.androidPackage, mime });
      tried.push(`intent-pkg:${p.androidPackage}`);
      if (await tryOpen(intent)) {
        return { ok: true, method: `intent-package:${p.androidPackage}`, playerLabel: p.label };
      }
    }

    // 2) Generic video intent (lets user/chooser pick)
    const generic = buildIntentUrl(streamUrl, { mime });
    tried.push("intent-generic-video");
    if (await tryOpen(generic)) {
      return { ok: true, method: "intent-generic", playerLabel: "System player" };
    }

    // 3) Generic without mime
    const bare = `intent:${streamUrl}#Intent;action=android.intent.action.VIEW;end`;
    tried.push("intent-bare");
    if (await tryOpen(bare)) {
      return { ok: true, method: "intent-bare", playerLabel: "System player" };
    }

    // 4) VLC custom scheme
    tried.push("vlc-scheme");
    if (await tryOpen(`vlc://${streamUrl}`)) {
      return { ok: true, method: "vlc-scheme", playerLabel: "VLC" };
    }

    // 5) Plain HTTPS/HTTP open (some devices route to a player)
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
