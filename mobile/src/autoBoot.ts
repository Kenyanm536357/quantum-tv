import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type AutoBootNativeModule = {
  isEnabled: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
};

const nativeAutoBoot = Platform.OS === "android"
  ? requireOptionalNativeModule<AutoBootNativeModule>("QuantumAutoBoot")
  : null;

export const autoBootAvailable = !!nativeAutoBoot;

export async function getAutoBootEnabled(): Promise<boolean> {
  if (!nativeAutoBoot || Platform.OS !== "android") return false;
  return nativeAutoBoot.isEnabled();
}

export async function setAutoBootEnabled(enabled: boolean): Promise<void> {
  if (!nativeAutoBoot || Platform.OS !== "android") {
    throw new Error("Auto boot is available only in the updated Android app.");
  }
  await nativeAutoBoot.setEnabled(enabled);
}