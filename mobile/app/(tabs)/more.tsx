import React, { useEffect, useState, useCallback, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Image, Modal, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client, { colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import { SAFE, SIZES, IS_TV, vs, ms, s } from "../../src/responsive";
import {
  PARENTAL_UNLOCKED_KEY,
  PARENTAL_UNLOCK_TTL,
  ADULT_CHANNELS_ENABLED_KEY,
} from "../../src/useParentalGate";
import { checkDownloadAndApply, getOtaInfo } from "../../src/ota";

// ============================================================
// Settings — clean categorized layout (adult channels OFF by default)
// ============================================================

function PinModal({
  visible,
  title,
  onSubmit,
  onDismiss,
  error,
}: {
  visible: boolean;
  title: string;
  onSubmit: (pin: string) => void;
  onDismiss: () => void;
  error?: string | null;
}) {
  const [pin, setPin] = useState("");
  useEffect(() => { if (!visible) setPin(""); }, [visible]);

  const handleDigit = (d: string) => setPin((p) => (p.length < 4 ? p + d : p));
  const handleErase = () => setPin((p) => p.slice(0, -1));

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={ps.backdrop}>
        <View style={ps.card}>
          <Text style={ps.title}>{title}</Text>
          <Text style={ps.subtitle}>Enter 4-digit PIN</Text>
          <View style={ps.pinRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[ps.pinDot, pin.length > i && ps.pinDotFilled]} />
            ))}
          </View>
          {error ? <Text style={ps.pinError}>{error}</Text> : null}
          <View style={ps.numGrid}>
            {[1,2,3,4,5,6,7,8,9].map((d) => (
              <Pressable
                key={d}
                focusable
                hasTVPreferredFocus={d === 5}
                onPress={() => handleDigit(String(d))}
                style={({ focused }) => [ps.numKey, focused && ps.numKeyFocused]}
              >
                <Text style={ps.numKeyLabel}>{d}</Text>
              </Pressable>
            ))}
            <Pressable focusable onPress={handleErase} style={({ focused }) => [ps.numKey, focused && ps.numKeyFocused]}>
              <Ionicons name="backspace-outline" size={ms(18)} color="#fff" />
            </Pressable>
            <Pressable focusable onPress={() => handleDigit("0")} style={({ focused }) => [ps.numKey, focused && ps.numKeyFocused]}>
              <Text style={ps.numKeyLabel}>0</Text>
            </Pressable>
            <Pressable
              focusable
              onPress={() => pin.length === 4 && onSubmit(pin)}
              style={({ focused }) => [ps.numKey, { backgroundColor: pin.length === 4 ? colors.cyan : "rgba(255,255,255,0.06)" }, focused && ps.numKeyFocused]}
            >
              <Ionicons name="checkmark" size={ms(18)} color={pin.length === 4 ? "#050614" : colors.zinc500} />
            </Pressable>
          </View>
          <Pressable focusable onPress={onDismiss} style={({ focused }) => [ps.cancelBtn, focused && { borderColor: colors.cyan }]}>
            <Text style={ps.cancelTxt}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function TogglePill({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggleTrack, on && styles.toggleTrackOn]}>
      <View style={[styles.toggleThumb, on && styles.toggleThumbOn]} />
    </View>
  );
}

function SettingRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  right,
  onPress,
  danger,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  danger?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      focusable={!!onPress}
      disabled={!onPress}
      onPress={onPress}
      style={({ focused }) => [
        styles.row,
        focused && styles.rowFocused,
        danger && focused && styles.rowDangerFocused,
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={ms(18)} color={iconColor} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowTitle, danger && { color: "#fca5a5" }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

function CategoryCard({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <View style={styles.category}>
      <View style={styles.categoryHead}>
        <Text style={styles.categoryKicker}>{kicker}</Text>
        <Text style={styles.categoryTitle}>{title}</Text>
      </View>
      <View style={styles.categoryBody}>{children}</View>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<"unlock" | "enable-adult">("unlock");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [parentalUnlocked, setParentalUnlocked] = useState(false);
  const [adultEnabled, setAdultEnabled] = useState(false);
  const [busyAdult, setBusyAdult] = useState(false);
  const [otaBusy, setOtaBusy] = useState(false);
  const [otaMsg, setOtaMsg] = useState<string | null>(null);
  const otaInfo = getOtaInfo();

  useEffect(() => {
    AsyncStorage.getItem("qtv_user").then((str) => setUser(str ? JSON.parse(str) : null));
  }, []);

  useEffect(() => {
    AsyncStorage.multiGet([PARENTAL_UNLOCKED_KEY, ADULT_CHANNELS_ENABLED_KEY]).then((pairs) => {
      const map = Object.fromEntries(pairs);
      const unlockVal = map[PARENTAL_UNLOCKED_KEY];
      if (unlockVal) {
        const ts = parseInt(unlockVal, 10);
        if (Date.now() - ts < PARENTAL_UNLOCK_TTL) setParentalUnlocked(true);
        else AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
      }
      setAdultEnabled(map[ADULT_CHANNELS_ENABLED_KEY] === "1");
    });
  }, []);

  const parentalQ = useQuery({
    queryKey: ["parental-settings"],
    queryFn: async () => (await client.get("/settings/parental")).data as { enabled: boolean; pin_set: boolean },
    retry: 1,
  });

  const parentalEnabled = parentalQ.data?.enabled ?? false;
  const pinSet = parentalQ.data?.pin_set ?? false;

  const disconnect = async () => {
    Alert.alert("Sign Out", "Sign out and remove this account from this device?", [
      { text: "Cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["qtv_token", "qtv_user", PARENTAL_UNLOCKED_KEY]);
          router.replace("/login");
        },
      },
    ]);
  };

  const applyAdultEnabled = useCallback(async (on: boolean) => {
    setBusyAdult(true);
    try {
      await AsyncStorage.setItem(ADULT_CHANNELS_ENABLED_KEY, on ? "1" : "0");
      setAdultEnabled(on);
      if (!on) {
        await AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
        setParentalUnlocked(false);
      }
      qc.invalidateQueries({ queryKey: ["live"] });
      qc.invalidateQueries({ queryKey: ["live-favorites"] });
      qc.invalidateQueries({ queryKey: ["live-recent"] });
    } finally {
      setBusyAdult(false);
    }
  }, [qc]);

  const handlePinSubmit = useCallback(async (pin: string) => {
    setPinVerifying(true);
    setPinError(null);
    try {
      if (parentalEnabled && pinSet) {
        const { data } = await client.post("/settings/parental/verify", { pin });
        if (!data.valid) {
          setPinError("Incorrect PIN. Try again.");
          return;
        }
      } else if (pin.length !== 4) {
        setPinError("Enter a 4-digit PIN.");
        return;
      }

      await AsyncStorage.setItem(PARENTAL_UNLOCKED_KEY, String(Date.now()));
      setParentalUnlocked(true);
      if (pinModalMode === "enable-adult") {
        await applyAdultEnabled(true);
      }
      setPinModalVisible(false);
    } catch {
      setPinError("Could not verify PIN. Check connection.");
    } finally {
      setPinVerifying(false);
    }
  }, [parentalEnabled, pinSet, pinModalMode, applyAdultEnabled]);

  const lockParental = useCallback(async () => {
    await AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
    setParentalUnlocked(false);
  }, []);

  const onToggleAdult = useCallback(async () => {
    if (busyAdult) return;
    if (adultEnabled) {
      await applyAdultEnabled(false);
      return;
    }
    // Require PIN only when the service has an admin PIN configured.
    if (parentalEnabled && pinSet) {
      setPinModalMode("enable-adult");
      setPinError(null);
      setPinModalVisible(true);
      return;
    }
    Alert.alert(
      "Show adult channels?",
      "Adult channels are hidden by default. Turn them on for this device?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Turn On", style: "destructive", onPress: () => { applyAdultEnabled(true); } },
      ],
    );
  }, [adultEnabled, busyAdult, applyAdultEnabled, parentalEnabled, pinSet]);

  const adultStatus = adultEnabled
    ? parentalEnabled && pinSet
      ? parentalUnlocked
        ? "Visible · session unlocked"
        : "Visible · PIN required to open"
      : "Visible in Live TV"
    : "Hidden by default";

  return (
    <BrandBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingLeft: SAFE.left,
          paddingRight: SAFE.right,
          paddingTop: SAFE.top + vs(16),
          paddingBottom: SIZES.tabBarH + vs(48),
          maxWidth: IS_TV ? s(980) : undefined,
        }}
      >
        <View style={styles.header}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>ACCOUNT & PREFERENCES</Text>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageHint}>Quick controls for your account, channels, and privacy.</Text>
          </View>
        </View>

        <CategoryCard kicker="01" title="Account">
          <View style={styles.profile}>
            <Image source={{ uri: user?.avatar || "https://i.pravatar.cc/200" }} style={styles.avatar} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.name}>{user?.username || "Guest"}</Text>
              <Text style={styles.email}>{user?.email || "Signed in on this device"}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>ACTIVE</Text>
            </View>
          </View>
        </CategoryCard>

        <CategoryCard kicker="02" title="Content & Privacy">
          <SettingRow
            testID="toggle-adult-channels"
            icon={adultEnabled ? "eye-outline" : "eye-off-outline"}
            iconColor={adultEnabled ? colors.cyan : colors.zinc400}
            iconBg={adultEnabled ? "rgba(103,232,249,0.16)" : "rgba(255,255,255,0.06)"}
            title="Adult channels"
            subtitle={adultStatus}
            onPress={onToggleAdult}
            right={
              busyAdult || parentalQ.isLoading
                ? <ActivityIndicator size="small" color={colors.cyan} />
                : <TogglePill on={adultEnabled} />
            }
          />
          <View style={styles.divider} />
          <SettingRow
            icon={parentalEnabled ? "shield-checkmark" : "shield-outline"}
            iconColor={parentalEnabled ? colors.purple : colors.zinc400}
            iconBg={parentalEnabled ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.06)"}
            title="PIN protection"
            subtitle={
              parentalQ.isLoading
                ? "Checking…"
                : parentalEnabled
                  ? pinSet
                    ? "Admin PIN lock is active on this service"
                    : "Enabled — ask your admin to set a PIN"
                  : "No service-wide PIN required"
            }
          />
          {parentalEnabled && pinSet ? (
            <>
              <View style={styles.divider} />
              {parentalUnlocked ? (
                <SettingRow
                  icon="lock-closed-outline"
                  iconColor={colors.purple}
                  iconBg="rgba(139,92,246,0.18)"
                  title="Lock adult content now"
                  subtitle="Require PIN again on this device"
                  onPress={lockParental}
                  right={<Ionicons name="chevron-forward" size={ms(16)} color={colors.zinc500} />}
                />
              ) : (
                <SettingRow
                  icon="lock-open-outline"
                  iconColor={colors.cyan}
                  iconBg="rgba(103,232,249,0.14)"
                  title="Unlock with PIN"
                  subtitle="Temporary unlock for this session"
                  onPress={() => {
                    setPinModalMode("unlock");
                    setPinError(null);
                    setPinModalVisible(true);
                  }}
                  right={<Ionicons name="chevron-forward" size={ms(16)} color={colors.zinc500} />}
                />
              )}
            </>
          ) : null}
          <Text style={styles.note}>
            Adult channels stay hidden until you turn them on here. You can turn them off anytime.
          </Text>
        </CategoryCard>

        <CategoryCard kicker="03" title="App">
          <SettingRow
            icon="tv-outline"
            iconColor={colors.cyan}
            iconBg="rgba(103,232,249,0.14)"
            title="Playback source"
            subtitle="Xtream / IPTV live & VOD"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="information-circle-outline"
            iconColor={colors.zinc300}
            iconBg="rgba(255,255,255,0.06)"
            title="Version"
            subtitle={`Quantum TV 1.0.14 · runtime ${otaInfo.runtimeVersion || "n/a"}`}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="cloud-download-outline"
            iconColor={colors.cyan}
            iconBg="rgba(103,232,249,0.14)"
            title="App update"
            subtitle={
              otaMsg
                || (!otaInfo.enabled
                  ? "OTA disabled on this build"
                  : otaInfo.isEmbeddedLaunch
                    ? `Embedded build · channel ${otaInfo.channel || "production"}`
                    : `OTA active · ${(otaInfo.updateId || "").slice(0, 8) || "bundle"}`)
            }
            onPress={async () => {
              if (otaBusy) return;
              setOtaBusy(true);
              setOtaMsg("Checking…");
              const res = await checkDownloadAndApply({
                apply: true,
                onStatus: setOtaMsg,
              });
              if (!res.applied) {
                setOtaMsg(res.message);
                setOtaBusy(false);
              }
            }}
            right={
              otaBusy
                ? <ActivityIndicator size="small" color={colors.cyan} />
                : <Ionicons name="refresh" size={ms(16)} color={colors.zinc400} />
            }
          />
        </CategoryCard>

        <CategoryCard kicker="04" title="Session">
          <SettingRow
            testID="disconnect-btn"
            icon="log-out-outline"
            iconColor="#fca5a5"
            iconBg="rgba(239,68,68,0.12)"
            title="Sign out"
            subtitle="Remove this account from the device"
            onPress={disconnect}
            danger
            right={<Ionicons name="chevron-forward" size={ms(16)} color="#fca5a5" />}
          />
        </CategoryCard>
      </ScrollView>

      <PinModal
        visible={pinModalVisible}
        title={pinModalMode === "enable-adult" ? "Enable Adult Channels" : "Unlock Adult Content"}
        onSubmit={pinVerifying ? () => {} : handlePinSubmit}
        onDismiss={() => { setPinModalVisible(false); setPinError(null); }}
        error={pinError}
      />
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(14),
    marginBottom: vs(18),
  },
  headerLogo: {
    width: IS_TV ? ms(52) : ms(40),
    height: IS_TV ? ms(52) : ms(40),
    borderRadius: ms(12),
  },
  kicker: {
    color: colors.zinc500,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    fontSize: SIZES.fontSmall,
    fontFamily: "Outfit_400Regular",
  },
  pageTitle: {
    color: "#fff",
    fontFamily: "Unbounded_800ExtraBold",
    fontSize: SIZES.fontTitle,
    marginTop: 2,
  },
  pageHint: {
    color: colors.zinc400,
    fontFamily: "Outfit_400Regular",
    fontSize: SIZES.fontSmall,
    marginTop: 4,
    maxWidth: s(520),
  },

  category: { marginBottom: vs(16) },
  categoryHead: { marginBottom: vs(8), paddingHorizontal: 2 },
  categoryKicker: {
    color: colors.cyan,
    fontFamily: "Unbounded_700Bold",
    fontSize: SIZES.fontTiny,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  categoryTitle: {
    color: "#fff",
    fontFamily: "Unbounded_700Bold",
    fontSize: SIZES.fontH2,
  },
  categoryBody: {
    backgroundColor: "rgba(13,14,35,0.72)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  profile: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: s(14),
    paddingVertical: vs(14),
  },
  avatar: {
    width: IS_TV ? 72 : 56,
    height: IS_TV ? 72 : 56,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  name: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2 },
  email: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 2 },
  badge: {
    paddingHorizontal: s(10),
    paddingVertical: vs(4),
    borderRadius: 999,
    backgroundColor: "rgba(103,232,249,0.14)",
    borderWidth: 1,
    borderColor: "rgba(103,232,249,0.35)",
  },
  badgeTxt: {
    color: colors.cyan,
    fontFamily: "Outfit_600SemiBold",
    fontSize: SIZES.fontTiny,
    letterSpacing: 1,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: s(12),
    paddingHorizontal: s(14),
    paddingVertical: vs(13),
    minHeight: IS_TV ? vs(64) : vs(56),
  },
  rowFocused: { backgroundColor: "rgba(103,232,249,0.08)" },
  rowDangerFocused: { backgroundColor: "rgba(239,68,68,0.10)" },
  rowIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowTitle: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontBody },
  rowSub: {
    color: colors.zinc400,
    fontFamily: "Outfit_400Regular",
    fontSize: SIZES.fontSmall,
    marginTop: 2,
    lineHeight: SIZES.fontSmall * 1.35,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: s(14) + ms(40) + s(12),
  },
  note: {
    color: colors.zinc500,
    fontFamily: "Outfit_400Regular",
    fontSize: SIZES.fontTiny,
    lineHeight: SIZES.fontTiny * 1.5,
    paddingHorizontal: s(14),
    paddingTop: vs(4),
    paddingBottom: vs(12),
  },

  toggleTrack: {
    width: ms(46),
    height: ms(26),
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleTrackOn: {
    backgroundColor: "rgba(103,232,249,0.28)",
    borderColor: "rgba(103,232,249,0.55)",
  },
  toggleThumb: {
    width: ms(20),
    height: ms(20),
    borderRadius: 999,
    backgroundColor: "#d4d4d8",
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
    backgroundColor: colors.cyan,
  },
});

// PIN modal styles
const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(6,7,20,0.92)", alignItems: "center", justifyContent: "center", padding: ms(20) },
  card: {
    backgroundColor: "#150826", borderRadius: 24, padding: ms(24),
    borderWidth: 1, borderColor: "rgba(139,92,246,0.35)",
    maxWidth: ms(360), width: "100%", alignItems: "center",
    shadowColor: colors.purple, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20,
  },
  title: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: ms(IS_TV ? 18 : 15), textAlign: "center", marginBottom: vs(4) },
  subtitle: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: ms(12), marginBottom: vs(20) },
  pinRow: { flexDirection: "row", gap: ms(16), marginBottom: vs(6) },
  pinDot: { width: ms(16), height: ms(16), borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "transparent" },
  pinDotFilled: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  pinError: { color: "#fca5a5", fontFamily: "Outfit_400Regular", fontSize: ms(11), marginBottom: vs(10), textAlign: "center" },
  numGrid: { flexDirection: "row", flexWrap: "wrap", gap: ms(8), justifyContent: "center", marginTop: vs(12), width: ms(IS_TV ? 220 : 190) },
  numKey: {
    width: ms(IS_TV ? 60 : 52), height: ms(IS_TV ? 48 : 42),
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  numKeyFocused: { borderColor: colors.cyan, backgroundColor: "rgba(103,232,249,0.12)", transform: [{ scale: 1.06 }] },
  numKeyLabel: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: ms(16) },
  cancelBtn: { marginTop: vs(14), paddingHorizontal: ms(24), paddingVertical: vs(8), borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  cancelTxt: { color: colors.zinc300, fontFamily: "Outfit_600SemiBold", fontSize: ms(13) },
});
