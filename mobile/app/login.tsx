import { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, TextInput, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import client, { colors } from "../src/api";
import { s, vs, ms, SAFE, IS_TV, SIZES } from "../src/responsive";

export default function Login() {
  const router = useRouter();
  const { width: W, height: H } = useWindowDimensions();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLandscape = W > H;
  const cardMaxW = IS_TV ? Math.min(W * 0.55, 720) : Math.min(W * 0.9, 520);

  const signIn = async () => {
    if (!username.trim() || !password) {
      setError("Please enter username and password");
      return;
    }
    setError(null); setLoading(true);
    try {
      const { data } = await client.post("/auth/login", { username: username.trim(), password });
      if (data.role === "admin") {
        setError("Admin accounts must use the web Control Panel.");
        setLoading(false);
        return;
      }
      await AsyncStorage.setItem("qtv_token", data.token);
      await AsyncStorage.setItem("qtv_user", JSON.stringify({
        username: data.username, display_name: data.display_name, avatar: data.avatar,
      }));
      router.replace("/(tabs)/browse");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Account is not registered or not activated");
    } finally { setLoading(false); }
  };

  return (
    <View style={[styles.root, { paddingHorizontal: SAFE.left, paddingVertical: SAFE.top }]}>
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
          <TextInput
            testID="username-input"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={[styles.input, { fontSize: SIZES.fontBody, paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={[styles.label, { fontSize: SIZES.fontTiny, marginTop: vs(16) }]}>PASSWORD</Text>
          <View style={styles.pwRow}>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={[styles.input, { flex: 1, fontSize: SIZES.fontBody, paddingVertical: vs(14), paddingHorizontal: s(16), borderRadius: SIZES.radius }]}
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
            hasTVPreferredFocus
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
