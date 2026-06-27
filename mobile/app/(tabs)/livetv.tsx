import { View, Text, FlatList, Pressable, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import client, { BACKEND, colors } from "../../src/api";
import { SAFE, SIZES, GRID_COLS, IS_TV, vs, ms } from "../../src/responsive";

export default function LiveTV() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await client.get("/livetv/channels")).data,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: SAFE.top }}>
      <View style={{ paddingHorizontal: SAFE.left, marginBottom: vs(16) }}>
        <Text style={{ color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: SIZES.fontSmall, fontFamily: "Outfit_400Regular" }}>LIVE</Text>
        <Text style={{ color: "#fff", fontSize: SIZES.fontTitle, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 }}>All Channels</Text>
      </View>
      {isLoading && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}
      <FlatList
        contentContainerStyle={{ paddingHorizontal: SAFE.left, paddingBottom: SIZES.tabBarH + vs(40) }}
        data={data?.channels || []}
        keyExtractor={(it, i) => `${it.key}-${i}`}
        numColumns={GRID_COLS.channels}
        columnWrapperStyle={{ gap: SIZES.gap }}
        ItemSeparatorComponent={() => <View style={{ height: SIZES.gap }} />}
        renderItem={({ item, index }) => (
          <Pressable
            testID={`channel-${item.key}`}
            focusable
            hasTVPreferredFocus={index === 0}
            style={({ focused }) => [{ flex: 1 }, focused && { transform: [{ scale: 1.05 }] }]}
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.key), title: item.title } })}
          >
            <View style={{ height: IS_TV ? vs(180) : vs(160), borderRadius: SIZES.radius, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
              {item.logo ? (
                <Image source={{ uri: item.logo.startsWith("http") ? item.logo : `${BACKEND}${item.logo}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" }} />
              <View style={{ position: "absolute", top: 10, left: 10, backgroundColor: colors.red, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                <Text style={{ color: "#fff", fontSize: SIZES.fontTiny, fontFamily: "Unbounded_800ExtraBold", letterSpacing: 1.5 }}>LIVE</Text>
              </View>
              <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
                <Text style={{ color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontBody }} numberOfLines={1}>{item.title}</Text>
                {item.number ? <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontTiny, marginTop: 2 }}>Channel {item.number}</Text> : null}
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={() =>
          !isLoading && (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="radio-outline" size={ms(36)} color={colors.zinc500} />
              <Text style={{ color: colors.zinc400, fontFamily: "Outfit_400Regular", marginTop: 10, textAlign: "center", fontSize: SIZES.fontSmall }}>
                No Live TV channels found.{"\n"}Plex DVR or Plex's free live TV must be set up on your server.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
