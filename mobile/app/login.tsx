import { useState, useEffect, useRef } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import client, { colors } from "../src/api";

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const signIn = async () => {
    setError(null); setLoading(true);
    try {
      const { data: pin } = await client.post("/plex/pin");
      // Open Plex auth in browser
      WebBrowser.openBrowserAsync(pin.auth_url);
      // Poll
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries++;
        try {
          const { data } = await client.get(`/plex/pin/${pin.pin_id}`);
          if (data.linked && data.token) {
            clearInterval(pollRef.current);
            await AsyncStorage.setItem("qtv_token", data.token);
            await AsyncStorage.setItem("qtv_user", JSON.stringify({
              username: data.plex_username, email: data.plex_email, avatar: data.avatar,
            }));
            WebBrowser.dismissBrowser?.();
            setLoading(false);
            router.replace("/(tabs)/browse");
          }
        } catch {}
        if (tries > 120) { clearInterval(pollRef.current); setLoading(false); setError("Sign in timed out. Please try again."); }
      }, 2500);
    } catch (e: any) {
      setLoading(false);
      setError(e?.response?.data?.detail || "Could not start sign in.");
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["rgba(139,92,246,0.18)", "transparent"]} style={styles.glow} />
      <View style={styles.center}>
        <Image source={require("../assets/logo.png")} style={styles.logo} />
        <Text style={styles.brand}>Quantum <Text style={{ color: colors.cyan }}>TV</Text></Text>
        <Text style={styles.tag}>Sign in with your Plex account</Text>

        <View style={styles.card}>
          <Text style={styles.note}>
            We use Plex's secure PIN sign-in. Tap the button below, sign in on plex.tv, then come back.
          </Text>
          <Pressable
            testID="signin-plex"
            disabled={loading}
            onPress={signIn}
            style={({ pressed }) => [{ opacity: pressed || loading ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={[colors.purple, colors.cyan]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Ionicons name="play-circle" size={20} color="#fff" />}
              <Text style={styles.btnTxt}>{loading ? "Waiting for Plex…" : "Sign in with Plex"}</Text>
            </LinearGradient>
          </Pressable>
          {error && <Text style={styles.err}>{error}</Text>}
        </View>

        <Text style={styles.footer}>plex powered • secure auth via plex.tv</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: "absolute", top: -120, left: -100, right: -100, height: 500, opacity: 0.7 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  logo: { width: 110, height: 110, borderRadius: 28, marginBottom: 16, shadowColor: colors.purple, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  brand: { fontFamily: "Unbounded_800ExtraBold", fontSize: 36, color: colors.purple },
  tag: { fontFamily: "Outfit_400Regular", color: colors.zinc400, marginTop: 6, letterSpacing: 1, textTransform: "uppercase", fontSize: 11 },
  card: { width: "100%", marginTop: 36, padding: 22, borderRadius: 22, backgroundColor: "rgba(13,14,35,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  note: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: 13, marginBottom: 16, lineHeight: 19 },
  btn: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 999 },
  btnTxt: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: 15 },
  err: { color: "#fca5a5", marginTop: 12, fontFamily: "Outfit_400Regular", fontSize: 13 },
  footer: { color: colors.zinc500, marginTop: 36, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
});
