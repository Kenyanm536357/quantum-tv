import { useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, TextInput, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Device from "expo-device";
import client, { colors } from "../src/api";
import { s, vs, ms, SAFE, IS_TV, SIZES } from "../src/responsive";
import TVTextInput from "../src/TVTextInput";

/**
 * Alternate sign-in for the Fire Stick app: connect straight to an Xtream
 * Codes provider or paste an M3U playlist link instead of a Quantum TV
 * username/password. Hits /auth/iptv-login, which validates the provider,
 * makes it the app's active IPTV source, and returns a normal session token.
 */
type Mode = "xtream" | "m3u";

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
  const [mode, setMode] = useState<Mode>("xtream");
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<TextInput>(null);
  const userRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const m3uRef = useRef<TextInput>(null);

  const cardMaxW = IS_TV ? Math.min(W * 0.6, 780) : Math.min(W * 0.9, 560);

  const submit = async () => {
    if (mode === "xtream" && (!url.trim() || !username.trim() || !password)) {
      setError("Please enter the server URL, username, and password");
      return;
    }
    if (mode === "m3u" && !m3uUrl.trim()) {
      setError("Please paste your M3U playlist link");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const device_id = await getDeviceId();
      const device_model = Device.modelName || Device.deviceName || "Fire TV";
      const device_name = Device.deviceName || Device.modelName || "Device";
      const { data } = await client.post("/auth/iptv-login", {
        mode,
        url: mode === "xtream" ? url.trim() : undefined,
        username: mode === "xtream" ? username.trim() : undefined,
        password: mode === "xtream" ? password : undefined,
        m3u_url: mode === "m3u" ? m3uUrl.trim() : undefined,
        device_id,
        device_model,
        device_name,
      });
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
        <Text style={[styles.tag, { fontSize: SIZES.fontSmall }]}>Sign in with your Xtream or M3U link</Text>

        <View style={[styles.card, { width: cardMaxW, marginTop: vs(24), padding: s(24) }]}>
          <View style={styles.tabRow}>
            <Pressable
              testID="tab-xtream"
              focusable
              hasTVPreferredFocus={IS_TV}
              onPress={() => setMode("xtream")}
              style={({ focused }) => [styles.tab, mode === "xtream" && styles.tabActive, focused && styles.focusRing]}
            >
              <Text style={[styles.tabText, mode === "xtream" && styles.tabTextActive]}>Xtream Codes</Text>
            </Pressable>
            <Pressable
              testID="tab-m3u"
              focusable
              onPress={() => setMode("m3u")}
              style={({ focused }) => [styles.tab, mode === "m3u" && styles.tabActive, focused && styles.focusRing]}
            >
              <Text style={[styles.tabText, mode === "m3u" && styles.tabTextActive]}>M3U Playlist</Text>
            </Pressable>
          </View>

          {mode === "xtream" ? (
            <>
              <Text style={[styles.label, { fontSize: SIZES.fontTiny, marginTop: vs(18) }]}>SERVER URL</Text>
              <TVTextInput
                ref={urlRef}
                testID="xtream-url-input"
                value={url}
                onChangeText={setUrl}
                placeholder="http://your-provider.com:port"
                placeholderTextColor="rgba(255,255,255,0.35)"
                wrapperStyle={[styles.input, { paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
                style={{ fontSize: SIZES.fontBody }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
                onSubmitEditing={() => userRef.current?.focus()}
              />

              <Text style={[styles.label, { fontSize: SIZES.fontTiny, marginTop: vs(16) }]}>USERNAME</Text>
              <TVTextInput
                ref={userRef}
                testID="xtream-username-input"
                value={username}
                onChangeText={setUsername}
                placeholder="Xtream username"
                placeholderTextColor="rgba(255,255,255,0.35)"
                wrapperStyle={[styles.input, { paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
                style={{ fontSize: SIZES.fontBody }}
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
                placeholder="Xtream password"
                placeholderTextColor="rgba(255,255,255,0.35)"
                wrapperStyle={[styles.input, { paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
                style={{ fontSize: SIZES.fontBody }}
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            </>
          ) : (
            <>
              <Text style={[styles.label, { fontSize: SIZES.fontTiny, marginTop: vs(18) }]}>M3U LINK</Text>
              <TVTextInput
                ref={m3uRef}
                testID="m3u-url-input"
                value={m3uUrl}
                onChangeText={setM3uUrl}
                placeholder="http://your-provider.com/get.php?username=..&password=..&type=m3u_plus"
                placeholderTextColor="rgba(255,255,255,0.35)"
                wrapperStyle={[styles.input, { paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
                style={{ fontSize: SIZES.fontBody }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            </>
          )}

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
