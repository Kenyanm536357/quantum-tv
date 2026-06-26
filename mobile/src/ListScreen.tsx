import { View, Text, FlatList, ActivityIndicator, Pressable, Image, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import client, { BACKEND, colors } from "../../src/api";

const isTV = Platform.isTV;

export function ListScreen({ endpoint, title, removeLabel, removeFromList, emptyText }: any) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [endpoint],
    queryFn: async () => (await client.get(endpoint)).data,
  });
  const remove = useMutation({
    mutationFn: async (rk: string) => removeFromList(rk),
    onSuccess: () => qc.invalidateQueries({ queryKey: [endpoint] }),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: isTV ? 40 : 60 }}>
      <View style={{ paddingHorizontal: isTV ? 40 : 20 }}>
        <Text style={s.kicker}>YOUR</Text>
        <Text style={s.title}>{title}</Text>
      </View>
      {isLoading && <ActivityIndicator color={colors.cyan} style={{ marginTop: 40 }} />}
      <FlatList
        contentContainerStyle={{ padding: isTV ? 40 : 20, paddingBottom: 130 }}
        data={data?.items || []}
        keyExtractor={(it) => String(it.rating_key)}
        numColumns={isTV ? 5 : 3}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={() => !isLoading && (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Ionicons name="bookmark-outline" size={48} color={colors.zinc500} />
            <Text style={s.empty}>{emptyText}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            testID={`item-${item.rating_key}`}
            style={({ focused }) => [{ flex: 1 }, focused && s.focused]}
            focusable
            onPress={() => router.push({ pathname: "/player/[rk]", params: { rk: String(item.rating_key), title: item.title } })}
            onLongPress={() => remove.mutate(String(item.rating_key))}
          >
            <View style={s.card}>
              {item.thumb ? (
                <Image source={{ uri: `${BACKEND}${item.thumb}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={["#1A1C3A", "#0D0E23"]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.9)"]} style={s.shade} />
              <View style={{ position: "absolute", bottom: 8, left: 8, right: 8 }}>
                <Text style={s.cTitle} numberOfLines={1}>{item.title}</Text>
                {item.year ? <Text style={s.cSub}>{item.year}</Text> : null}
              </View>
            </View>
            <Text style={s.hint} numberOfLines={1}>Hold to {removeLabel}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  kicker: { color: colors.zinc500, letterSpacing: 2, textTransform: "uppercase", fontSize: isTV ? 13 : 11, fontFamily: "Outfit_400Regular" },
  title: { color: "#fff", fontSize: isTV ? 38 : 28, fontFamily: "Unbounded_800ExtraBold", marginTop: 4 },
  card: { height: isTV ? 220 : 170, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%" },
  cTitle: { color: "#fff", fontFamily: "Outfit_600SemiBold", fontSize: isTV ? 15 : 12 },
  cSub: { color: colors.zinc500, fontFamily: "Outfit_400Regular", fontSize: isTV ? 12 : 10, marginTop: 1 },
  hint: { color: colors.zinc500, fontSize: isTV ? 11 : 9, marginTop: 4, fontFamily: "Outfit_400Regular" },
  empty: { color: colors.zinc400, marginTop: 14, fontFamily: "Outfit_400Regular", fontSize: isTV ? 16 : 13, textAlign: "center" },
  focused: { transform: [{ scale: 1.05 }], shadowColor: colors.cyan, shadowOpacity: 0.8, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
});

export default ListScreen;
