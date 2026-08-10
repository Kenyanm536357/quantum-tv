import { useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, TextInput, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Device from "expo-device";
import client, { colors } from "../src/api";
import { s, vs, ms, SAFE, IS_TV, SIZES } from "../src/responsive";
import TVTextInput from "../src/TVTextInput";

const PROVIDER_URLS = ["http://ky-tv.cc:25461", "http://kytv.xyz:25461"];

async function getDeviceId(): Promise<string> {
  try {
    const cached = await AsyncStorage.getItem("qtv_device_id");
    if (cached) return cached;
    const id = `${Device.osName || "device"}-${Device.modelName || "unknown"}-${Date.now()}`;
    await AsyncStorage.setItem("qtv_device_id", id);
    return id;
  } catch {
    return `device-${Date.now()}`;
  }
}

export default function IptvLogin() {
  const router = useRouter();
  const { width: W, height: H } = useWindowDimensions();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);

  const cardMaxW = IS_TV ? Math.min(W * 0.6, 780) : Math.min(W * 0.9, 560);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError("Please enter your provider username and password");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const device_id = await getDeviceId();
      const device_model = Device.modelName || Device.deviceName || "Fire TV";
      const device_name = Device.deviceName || Device.modelName || "Device";
      let data: any;
      let lastError: any;
      for (const url of PROVIDER_URLS) {
        try {
          const response = await client.post("/auth/iptv-login", {
            mode: "xtream",
            url,
            username: username.trim(),
            password,
            device_id,
            device_model,
            device_name,
          });
          data = response.data;
          break;
        } catch (e: any) {
          lastError = e;
        }
      }
      if (!data) throw lastError;
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
      setError(e?.response?.data?.detail || "Could not connect. Check the link and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingHorizontal: SAFE.right, paddingVertical: SAFE.top }]}>
      <LinearGradient
        colors={["rgba(139,92,246,0.18)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: H * 0.55 }}
      />
      <View style={styles.center}>
        <Image source={require("../assets/logo.png")} style={{ width: ms(96), height: ms(96), borderRadius: ms(24), marginBottom: vs(14) }} />
        <Text style={[styles.brand, { fontSize: SIZES.fontTitle * 1.2 }]}>Quantum <Text style={{ color: colors.cyan }}>TV</Text></Text>
        <Text style={[styles.tag, { fontSize: SIZES.fontSmall }]}>Sign in with your provider portal account</Text>

        <View style={[styles.card, { width: cardMaxW, marginTop: vs(24), padding: s(24) }]}>
          <Text style={[styles.label, { fontSize: SIZES.fontTiny }]}>USERNAME</Text>
          <TVTextInput
            ref={userRef}
            testID="xtream-username-input"
            value={username}
            onChangeText={setUsername}
            placeholder="Provider username"
            placeholderTextColor="rgba(255,255,255,0.35)"
            wrapperStyle={[styles.input, { paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
            style={{ fontSize: SIZES.fontBody }}
            hasTVPreferredFocus={IS_TV}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => pwRef.current?.focus()}
          />

          <Text style={[styles.label, { fontSize: SIZES.fontTiny, marginTop: vs(16) }]}>PASSWORD</Text>
          <TVTextInput
            ref={pwRef}
            testID="xtream-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="Provider password"
            placeholderTextColor="rgba(255,255,255,0.35)"
            wrapperStyle={[styles.input, { paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
            style={{ fontSize: SIZES.fontBody }}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          <Pressable
            testID="iptv-signin-btn"
            disabled={loading}
            onPress={submit}
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
                : <Text style={{ color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontBody, letterSpacing: 0.5 }}>Connect</Text>}
            </LinearGradient>
          </Pressable>

          {error && <Text testID="iptv-login-error" style={[styles.err, { fontSize: SIZES.fontSmall, marginTop: vs(12) }]}>{error}</Text>}

          <Pressable
            testID="back-to-login"
            onPress={() => router.back()}
            focusable
            style={({ focused }) => [{ marginTop: vs(18), alignSelf: "center", borderRadius: 999, borderWidth: 2, borderColor: focused ? colors.cyan : "transparent", paddingHorizontal: 16, paddingVertical: 8 }]}
          >
            <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall }}>Back to sign in</Text>
          </Pressable>
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
  tabRow: { flexDirection: "row", gap: 10 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.10)", alignItems: "center" },
  tabActive: { borderColor: colors.cyan, backgroundColor: "rgba(103,232,249,0.10)" },
  tabText: { color: colors.zinc400, fontFamily: "Outfit_600SemiBold" },
  tabTextActive: { color: "#fff" },
  label: { color: colors.zinc400, fontFamily: "Outfit_500Medium", letterSpacing: 3, marginBottom: 8 },
  input: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", borderWidth: 1, color: "#fff", fontFamily: "Outfit_400Regular" },
  err: { color: "#fca5a5", fontFamily: "Outfit_400Regular", textAlign: "center" },
  focusRing: { borderColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
});
