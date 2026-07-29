import * as Updates from "expo-updates";

export const OTA_CHECK_TIMEOUT_MS = 8000;
export const OTA_FETCH_TIMEOUT_MS = 60000;

export function withTimeout<T>(promise: Promise<T>, msTimeout: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${msTimeout}ms`)), msTimeout);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type OtaInfo = {
  enabled: boolean;
  isEmbeddedLaunch: boolean;
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  createdAt: string | null;
};

/** Snapshot of what bundle the app is currently running. */
export function getOtaInfo(): OtaInfo {
  if (!Updates.isEnabled) {
    return {
      enabled: false,
      isEmbeddedLaunch: true,
      channel: null,
      runtimeVersion: null,
      updateId: null,
      createdAt: null,
    };
  }
  const manifest: any = Updates.manifest || {};
  return {
    enabled: true,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    channel:
      (Updates as any).channel ??
      manifest?.extra?.expoClient?.updates?.requestHeaders?.["expo-channel-name"] ??
      null,
    runtimeVersion: (Updates as any).runtimeVersion ?? null,
    updateId: Updates.updateId ?? manifest?.id ?? null,
    createdAt: manifest?.createdAt ?? null,
  };
}

/**
 * Check + download latest OTA. Returns whether a reload is needed to apply it.
 * Does NOT call reloadAsync — caller decides when to restart.
 */
export async function downloadLatestUpdate(): Promise<{
  checked: boolean;
  available: boolean;
  downloaded: boolean;
  reason?: string;
}> {
  if (!Updates.isEnabled) {
    return { checked: false, available: false, downloaded: false, reason: "updates-disabled" };
  }

  const check = await withTimeout(
    Updates.checkForUpdateAsync(),
    OTA_CHECK_TIMEOUT_MS,
    "checkForUpdateAsync",
  );

  if (!check.isAvailable) {
    return { checked: true, available: false, downloaded: false, reason: "up-to-date" };
  }

  const fetched = await withTimeout(
    Updates.fetchUpdateAsync(),
    OTA_FETCH_TIMEOUT_MS,
    "fetchUpdateAsync",
  );

  // isNew=true means a brand-new bundle was stored; false can still mean a
  // previously downloaded pending update is ready to apply.
  return {
    checked: true,
    available: true,
    downloaded: true,
    reason: fetched.isNew ? "new" : "pending",
  };
}

/** Apply downloaded update by hard-reloading the JS runtime. */
export async function applyUpdateNow(): Promise<void> {
  if (!Updates.isEnabled) return;
  await Updates.reloadAsync();
}

/**
 * Best-effort update path:
 * check → download → optional reload.
 * Never throws — returns status for UI.
 */
export async function checkDownloadAndApply(opts?: {
  apply?: boolean;
  onStatus?: (msg: string) => void;
}): Promise<{ applied: boolean; available: boolean; message: string }> {
  const apply = opts?.apply !== false;
  const onStatus = opts?.onStatus;
  try {
    if (!Updates.isEnabled) {
      return { applied: false, available: false, message: "Updates disabled on this build" };
    }

    onStatus?.("Checking for update…");
    const result = await downloadLatestUpdate();

    if (!result.available) {
      return { applied: false, available: false, message: "You are up to date" };
    }

    onStatus?.("Update downloaded. Restarting…");
    if (apply) {
      // Give UI a beat to paint "restarting", then reload.
      await new Promise((r) => setTimeout(r, 350));
      await applyUpdateNow();
      return { applied: true, available: true, message: "Reloading" };
    }

    return { applied: false, available: true, message: "Update downloaded — restart to apply" };
  } catch (e: any) {
    return {
      applied: false,
      available: false,
      message: e?.message || "Update failed",
    };
  }
}
