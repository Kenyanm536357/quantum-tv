import { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, TextInput, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import client, { colors } from "../src/api";

const isTV = Platform.isTV || Platform.OS === "android";

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <View style={styles.root}>
      <LinearGradient colors={["rgba(139,92,246,0.18)", "transparent"]} style={styles.glow} />
      <View style={styles.center}>
        <Image source={require("../assets/logo.png")} style={styles.logo} />
        <Text style={styles.brand}>Quantum <Text style={{ color: colors.cyan }}>TV</Text></Text>
        <Text style={styles.tag}>Sign in to your account</Text>

        <View style={styles.card}>
          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            testID="username-input"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: 18 }]}>PASSWORD</Text>
          <View style={styles.pwRow}>
            <TextInput
              testID="password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={[styles.input, { flex: 1 }]}
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
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={isTV ? 28 : 22} color="#fff" />
            </Pressable>
          </View>

          <Pressable
            testID="signin-btn"
            disabled={loading}
            onPress={signIn}
            focusable
            hasTVPreferredFocus
            style={({ focused, pressed }) => [
              styles.btnWrap,
              focused && styles.focusRing,
              { opacity: pressed || loading ? 0.85 : 1 },
            ]}
          >
            <LinearGradient
              colors={[colors.purple, colors.cyan]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnTxt}>Sign In</Text>}
            </LinearGradient>
          </Pressable>

          {error && <Text testID="login-error" style={styles.err}>{error}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: "absolute", top: -120, left: -100, right: -100, height: 500, opacity: 0.7 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logo: { width: 130, height: 130, borderRadius: 32, marginBottom: 18, shadowColor: colors.purple, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  brand: { fontFamily: "Unbounded_800ExtraBold", fontSize: 44, color: colors.purple },
  tag: { fontFamily: "Outfit_400Regular", color: colors.zinc400, marginTop: 6, fontSize: 14 },
  card: { width: "100%", maxWidth: 560, marginTop: 36, padding: 28, borderRadius: 24, backgroundColor: "rgba(13,14,35,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  label: { color: colors.zinc400, fontFamily: "Outfit_500Medium", fontSize: 11, letterSpacing: 3, marginBottom: 10 },
  input: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, color: "#fff", fontFamily: "Outfit_400Regular", fontSize: 16 },
  pwRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eye: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
  btnWrap: { marginTop: 26, borderRadius: 999, borderWidth: 2, borderColor: "transparent" },
  btn: { paddingVertical: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnTxt: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: 16, letterSpacing: 0.5 },
  err: { color: "#fca5a5", marginTop: 14, fontFamily: "Outfit_400Regular", fontSize: 13, textAlign: "center" },
  focusRing: { borderColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
});
