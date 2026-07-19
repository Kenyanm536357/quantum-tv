import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Image } from "react-native";
import ImageWithFallback from "../../src/ImageWithFallback";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { colors } from "../../src/api";
import BrandBackground from "../../src/BrandBackground";
import { SAFE, SIZES, IS_TV, s, vs, ms } from "../../src/responsive";

export default function More() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const servers = useQuery({ queryKey: ["servers"], queryFn: async () => (await client.get("/servers")).data });

  useEffect(() => { AsyncStorage.getItem("qtv_user").then((str) => setUser(str ? JSON.parse(str) : null)); }, []);

  const disconnect = async () => {
    Alert.alert("Disconnect", "Sign out and remove this Plex connection from this device?", [
      { text: "Cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        await AsyncStorage.removeItem("qtv_token");
        await AsyncStorage.removeItem("qtv_user");
        router.replace("/login");
      } },
    ]);
  };

  const selectServer = async (cid: string) => {
    try {
      await client.post("/servers/select", { client_identifier: cid });
      Alert.alert("Server selected", "Your default Plex server has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not select server.");
    }
  };

  return (
    <BrandBackground>
    <ScrollView
      style={{ flex: 1 }}
      // SAFE.left already accounts for the collapsed TV nav rail (68px) + overscan.
      // SAFE.top provides overscan padding so the "hamburger Q" logo icon on the
      // rail does not sit on top of the profile card / disconnect button.
      contentContainerStyle={{
        paddingLeft: SAFE.left,
        paddingRight: SAFE.right,
        paddingTop: SAFE.top + vs(20),
        paddingBottom: SIZES.tabBarH + vs(40),
      }}
    >
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

      <View style={styles.profile}>
        <Image source={{ uri: user?.avatar || "https://i.pravatar.cc/200" }} style={styles.avatar} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={styles.name}>{user?.username || "—"}</Text>
          <Text style={styles.email}>{user?.email || ""}</Text>
        </View>
      </View>

      <Text style={styles.section}>Plex Servers</Text>
      <View style={styles.card}>
        {(servers.data?.servers || []).map((srv: any) => (
          <Pressable
            testID={`pick-${srv.client_identifier}`}
            key={srv.client_identifier}
            onPress={() => selectServer(srv.client_identifier)}
            focusable
            style={({ focused }) => [styles.row, focused && styles.rowFocused]}
          >
            <Ionicons name="server-outline" size={ms(18)} color={colors.cyan} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.rowTitle}>{srv.name}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{srv.uri}</Text>
            </View>
            <Ionicons name="chevron-forward" size={ms(16)} color={colors.zinc500} />
          </Pressable>
        ))}
        {(servers.data?.servers || []).length === 0 && (
          <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", padding: 16, fontSize: SIZES.fontSmall }}>No servers found.</Text>
        )}
      </View>

      <Pressable
        testID="disconnect-btn"
        onPress={disconnect}
        focusable
        style={({ focused }) => [styles.disconnect, focused && styles.disconnectFocused]}
      >
        <Ionicons name="log-out-outline" size={ms(18)} color="#fca5a5" />
        <Text style={{ color: "#fca5a5", fontFamily: "Unbounded_700Bold", marginLeft: 8, fontSize: SIZES.fontBody }}>Disconnect</Text>
      </Pressable>
    </ScrollView>
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
  section: { color: colors.zinc500, fontFamily: "Outfit_500Medium", fontSize: SIZES.fontSmall, letterSpacing: 2, textTransform: "uppercase", marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: "rgba(13,14,35,0.6)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  rowFocused: { backgroundColor: "rgba(6,182,212,0.10)", borderLeftColor: colors.cyan, borderLeftWidth: 3 },
  rowTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: SIZES.fontBody },
  rowSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 2 },
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
