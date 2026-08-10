import { useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, TextInput, useWindowDimensions, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Device from "expo-device";
import * as Application from "expo-application";
import client, { colors } from "../src/api";
import { s, vs, ms, SAFE, IS_TV, SIZES } from "../src/responsive";
import TVTextInput from "../src/TVTextInput";

/**
 * Produce a stable per-install device id. We persist a UUID-style string in
 * AsyncStorage on first launch so that even if Expo's underlying id changes
 * across reinstalls / OS upgrades, the user's "slot" with us stays consistent
 * for the duration of a single install.
 */
async function getDeviceId(): Promise<string> {
  try {
    const cached = await AsyncStorage.getItem("qtv_device_id");
    if (cached) return cached;
    let id: string | null = null;
    if (Platform.OS === "android" && (Application as any).getAndroidId) {
      try { id = (Application as any).getAndroidId(); } catch { /* fallthrough */ }
    }
    if (!id) {
      const t = await (Application as any).getInstallationTimeAsync?.();
      id = `${Device.osName || Platform.OS}-${Device.modelName || "device"}-${t?.getTime?.() || Date.now()}`;
    }
    await AsyncStorage.setItem("qtv_device_id", id);
    return id;
  } catch {
    return `${Platform.OS}-${Date.now()}`;
  }
}

/**
 * Only sign-in method: the account's Xtream provider username/password.
 * The backend validates directly against the hardwired provider server.
 */
export default function Login() {
  const router = useRouter();
  const { width: W, height: H } = useWindowDimensions();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);

  const isLandscape = W > H;
  const cardMaxW = IS_TV ? Math.min(W * 0.55, 720) : Math.min(W * 0.9, 520);

  const signIn = async () => {
    const u = username.trim();
    if (!u || !password) {
      setError("Please enter your username and password");
      return;
    }
    setError(null); setLoading(true);
    try {
      const device_id = await getDeviceId();
      const device_model = Device.modelName || Device.deviceName || Platform.OS;
      const device_name = Device.deviceName || Device.modelName || "Device";
      const { data } = await client.post("/auth/iptv-login", { username: u, password, device_id, device_model, device_name });
      await AsyncStorage.setItem("qtv_token", data.token);
      await AsyncStorage.setItem("qtv_user", JSON.stringify({
        username: data.username,
        display_name: data.display_name,
        avatar: data.avatar,
        account_number: data.account_number,
        subscription: data.subscription,
      }));
      router.replace("/(tabs)/browse");
    } catch (e: any) {
      const reason = e?.response?.data?.detail || "Incorrect username or password. Please try again.";
      setError(reason);
    } finally { setLoading(false); }
  };

  return (
    <View style={[styles.root, { paddingHorizontal: SAFE.right, paddingVertical: SAFE.top }]}>
      <LinearGradient
        colors={["rgba(139,92,246,0.18)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: H * 0.55 }}
      />
      <View style={[styles.center, isLandscape && IS_TV ? { flexDirection: "row", gap: s(60) } : null]}>
        <View style={{ alignItems: "center", justifyContent: "center", flex: isLandscape && IS_TV ? 1 : undefined }}>
          <Image source={require("../assets/logo.png")} style={{ width: ms(110), height: ms(110), borderRadius: ms(28), marginBottom: vs(16) }} />
          <Text style={[styles.brand, { fontSize: SIZES.fontTitle * 1.4 }]}>Quantum <Text style={{ color: colors.cyan }}>TV</Text></Text>
          <Text style={[styles.tag, { fontSize: SIZES.fontSmall }]}>Sign in to your account</Text>
        </View>

        <View style={[styles.card, { width: cardMaxW, marginTop: isLandscape && IS_TV ? 0 : vs(28), padding: s(24) }]}>
          <Text style={[styles.label, { fontSize: SIZES.fontTiny }]}>USERNAME</Text>
          <TVTextInput
            ref={userRef}
            testID="username-input"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="rgba(255,255,255,0.35)"
            wrapperStyle={[styles.input, { paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
            style={{ fontSize: SIZES.fontBody }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => pwRef.current?.focus()}
            hasTVPreferredFocus={IS_TV}
          />

          <Text style={[styles.label, { fontSize: SIZES.fontTiny, marginTop: vs(16) }]}>PASSWORD</Text>
          <View style={styles.pwRow}>
            <TVTextInput
              ref={pwRef}
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="rgba(255,255,255,0.35)"
              wrapperStyle={[styles.input, { flex: 1, paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
              style={{ fontSize: SIZES.fontBody }}
              secureTextEntry={!showPw}
              returnKeyType="go"
              onSubmitEditing={signIn}
            />
            <Pressable
              testID="toggle-pw"
              onPress={() => setShowPw((s) => !s)}
              focusable
              style={({ focused }) => [styles.eye, focused && styles.focusRing]}
            >
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={SIZES.iconMd} color="#fff" />
            </Pressable>
          </View>

          <Pressable
            testID="signin-btn"
            disabled={loading}
            onPress={signIn}
            focusable
            style={({ focused, pressed }) => [
              { marginTop: vs(22), borderRadius: 999, borderWidth: 2, borderColor: "transparent" },
              focused && styles.focusRing,
              { opacity: pressed || loading ? 0.85 : 1 },
            ]}
          >
            <LinearGradient
              colors={[colors.purple, colors.cyan]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ height: SIZES.btnH, borderRadius: 999, alignItems: "center", justifyContent: "center" }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontBody, letterSpacing: 0.5 }}>Sign In</Text>}
            </LinearGradient>
          </Pressable>

          {error && <Text testID="login-error" style={[styles.err, { fontSize: SIZES.fontSmall, marginTop: vs(12) }]}>{error}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  brand: { fontFamily: "Unbounded_800ExtraBold", color: colors.purple, textAlign: "center" },
  tag: { fontFamily: "Outfit_400Regular", color: colors.zinc400, marginTop: 6, textAlign: "center" },
  card: { backgroundColor: "rgba(13,14,35,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 24 },
  label: { color: colors.zinc400, fontFamily: "Outfit_500Medium", letterSpacing: 3, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", borderWidth: 1, color: "#fff", fontFamily: "Outfit_400Regular" },
  pwRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eye: { padding: 10, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  err: { color: "#fca5a5", fontFamily: "Outfit_400Regular", textAlign: "center" },
  focusRing: { borderColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
});
