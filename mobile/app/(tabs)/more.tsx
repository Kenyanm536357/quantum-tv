import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Image, Modal, TextInput, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import client, { colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import { SAFE, SIZES, IS_TV, vs, ms } from "../../src/responsive";

// ============================================================
// Settings screen — account info, sign out, parental controls
// ============================================================

const PARENTAL_UNLOCKED_KEY = "qtv_parental_unlocked";
const PARENTAL_UNLOCK_TTL = 15 * 60 * 1000; // 15 minutes

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

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  // Parental controls state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<"unlock" | "set">("unlock");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinVerifying, setPinVerifying] = useState(false);
  const [parentalUnlocked, setParentalUnlocked] = useState(false);

  useEffect(() => { AsyncStorage.getItem("qtv_user").then((str) => setUser(str ? JSON.parse(str) : null)); }, []);

  // Check if parental lock session is still active
  useEffect(() => {
    AsyncStorage.getItem(PARENTAL_UNLOCKED_KEY).then((val) => {
      if (val) {
        const ts = parseInt(val, 10);
        if (Date.now() - ts < PARENTAL_UNLOCK_TTL) setParentalUnlocked(true);
        else AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
      }
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
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await AsyncStorage.removeItem("qtv_token");
        await AsyncStorage.removeItem("qtv_user");
        await AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
        router.replace("/login");
      } },
    ]);
  };

  const handlePinSubmit = useCallback(async (pin: string) => {
    setPinVerifying(true);
    setPinError(null);
    try {
      const { data } = await client.post("/settings/parental/verify", { pin });
      if (data.valid) {
        await AsyncStorage.setItem(PARENTAL_UNLOCKED_KEY, String(Date.now()));
        setParentalUnlocked(true);
        setPinModalVisible(false);
      } else {
        setPinError("Incorrect PIN. Try again.");
      }
    } catch {
      setPinError("Could not verify PIN. Check connection.");
    } finally {
      setPinVerifying(false);
    }
  }, []);

  const lockParental = useCallback(async () => {
    await AsyncStorage.removeItem(PARENTAL_UNLOCKED_KEY);
    setParentalUnlocked(false);
  }, []);

  return (
    <BrandBackground>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingLeft: SAFE.left,
        paddingRight: SAFE.right,
        paddingTop: SAFE.top + vs(20),
        paddingBottom: SIZES.tabBarH + vs(40),
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: vs(20) }}>
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: IS_TV ? ms(48) : ms(38), height: IS_TV ? ms(48) : ms(38), borderRadius: ms(10) }}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>ACCOUNT</Text>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>
      </View>

      {/* Profile card */}
      <View style={styles.profile}>
        <Image source={{ uri: user?.avatar || "https://i.pravatar.cc/200" }} style={styles.avatar} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={styles.name}>{user?.username || "—"}</Text>
          <Text style={styles.email}>{user?.email || ""}</Text>
        </View>
      </View>

      {/* Parental Controls section */}
      <Text style={styles.sectionHeader}>PARENTAL CONTROLS</Text>
      <View style={styles.sectionCard}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: vs(10) }}>
          <View style={[styles.sectionIconBox, { backgroundColor: parentalEnabled ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.06)" }]}>
            <Ionicons name={parentalEnabled ? "lock-closed" : "lock-open-outline"} size={ms(18)} color={parentalEnabled ? colors.purple : colors.zinc500} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>Adult Channel Lock</Text>
            <Text style={styles.sectionMeta}>
              {parentalQ.isLoading
                ? "Loading…"
                : parentalEnabled
                  ? pinSet
                    ? parentalUnlocked ? "Unlocked for this session" : "PIN required to access adult channels"
                    : "Enabled — no PIN set (contact admin)"
                  : "Disabled — all channels accessible"}
            </Text>
          </View>
          {parentalQ.isLoading && <ActivityIndicator size="small" color={colors.cyan} />}
        </View>

        {parentalEnabled && pinSet && (
          parentalUnlocked ? (
            <Pressable
              focusable
              onPress={lockParental}
              style={({ focused }) => [styles.actionBtn, focused && styles.actionBtnFocused]}
            >
              <Ionicons name="lock-closed-outline" size={ms(16)} color={colors.purple} />
              <Text style={[styles.actionBtnTxt, { color: colors.purple }]}>Lock Now</Text>
            </Pressable>
          ) : (
            <Pressable
              focusable
              onPress={() => { setPinModalMode("unlock"); setPinError(null); setPinModalVisible(true); }}
              style={({ focused }) => [styles.actionBtn, focused && styles.actionBtnFocused]}
            >
              <Ionicons name="lock-open-outline" size={ms(16)} color={colors.cyan} />
              <Text style={[styles.actionBtnTxt, { color: colors.cyan }]}>Unlock with PIN</Text>
            </Pressable>
          )
        )}

        <Text style={styles.sectionNote}>
          The PIN is set and managed by the service administrator. Contact your admin to change or reset it.
        </Text>
      </View>

      {/* Sign out */}
      <Pressable
        testID="disconnect-btn"
        onPress={disconnect}
        focusable
        style={({ focused }) => [styles.disconnect, focused && styles.disconnectFocused]}
      >
        <Ionicons name="log-out-outline" size={ms(18)} color="#fca5a5" />
        <Text style={{ color: "#fca5a5", fontFamily: "Unbounded_700Bold", marginLeft: 8, fontSize: SIZES.fontBody }}>Sign Out</Text>
      </Pressable>
    </ScrollView>

    {/* PIN entry modal */}
    <PinModal
      visible={pinModalVisible}
      title={pinModalMode === "unlock" ? "Unlock Adult Content" : "Change PIN"}
      onSubmit={pinVerifying ? () => {} : handlePinSubmit}
      onDismiss={() => { setPinModalVisible(false); setPinError(null); }}
      error={pinError}
    />
    </BrandBackground>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" },
  pageTitle: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontTitle, marginTop: 4, marginBottom: vs(20) },
  profile: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(13,14,35,0.6)", padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  avatar: { width: IS_TV ? 72 : 56, height: IS_TV ? 72 : 56, borderRadius: 36, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  name: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontH2 },
  email: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 2 },

  sectionHeader: { color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular", marginTop: vs(28), marginBottom: vs(8) },
  sectionCard: { backgroundColor: "rgba(13,14,35,0.6)", padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: vs(8) },
  sectionIconBox: { width: ms(36), height: ms(36), borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sectionLabel: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontBody },
  sectionMeta: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 2 },
  sectionNote: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: vs(8), lineHeight: SIZES.fontTiny * 1.5 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.04)", marginTop: vs(4) },
  actionBtnFocused: { borderColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  actionBtnTxt: { fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontBody },

  disconnect: {
    marginTop: 28,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 16,
    borderRadius: 14, borderWidth: 2, borderColor: "rgba(252,165,165,0.3)",
    backgroundColor: "rgba(239,68,68,0.05)",
  },
  disconnectFocused: {
    borderColor: "#fca5a5",
    shadowColor: "#fca5a5", shadowOpacity: 0.6, shadowRadius: 18, elevation: 10,
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
