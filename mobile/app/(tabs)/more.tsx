import { useEffect, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { colors } from "../../src/api";

export default function More() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const servers = useQuery({ queryKey: ["servers"], queryFn: async () => (await client.get("/servers")).data });

  useEffect(() => { AsyncStorage.getItem("qtv_user").then((s) => setUser(s ? JSON.parse(s) : null)); }, []);

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
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 110 }}>
      <View style={s.profile}>
        <Image source={{ uri: user?.avatar || "https://i.pravatar.cc/200" }} style={s.avatar} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={s.name}>{user?.username || "—"}</Text>
          <Text style={s.email}>{user?.email || ""}</Text>
        </View>
      </View>

      <Text style={s.section}>Plex Servers</Text>
      <View style={s.card}>
        {(servers.data?.servers || []).map((srv: any) => (
          <Pressable testID={`pick-${srv.client_identifier}`} key={srv.client_identifier} onPress={() => selectServer(srv.client_identifier)} style={s.row}>
            <Ionicons name="server-outline" size={18} color={colors.cyan} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.rowTitle}>{srv.name}</Text>
              <Text style={s.rowSub} numberOfLines={1}>{srv.uri}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.zinc500} />
          </Pressable>
        ))}
        {(servers.data?.servers || []).length === 0 && (
          <Text style={{ color: colors.zinc500, fontFamily: "Outfit_400Regular", padding: 16 }}>No servers found.</Text>
        )}
      </View>

      <Pressable testID="disconnect-btn" onPress={disconnect} style={s.disconnect}>
        <Ionicons name="log-out-outline" size={18} color="#fca5a5" />
        <Text style={{ color: "#fca5a5", fontFamily: "Unbounded_700Bold", marginLeft: 8 }}>Disconnect</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(13,14,35,0.6)", padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  name: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: 18 },
  email: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: 12, marginTop: 2 },
  section: { color: colors.zinc500, fontFamily: "Outfit_500Medium", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 22, marginBottom: 8 },
  card: { backgroundColor: "rgba(13,14,35,0.6)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  rowTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: 14 },
  rowSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: 11, marginTop: 2 },
  disconnect: { marginTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "rgba(252,165,165,0.3)", backgroundColor: "rgba(239,68,68,0.05)" },
});
