import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const [t, setT] = useState<string | null | undefined>(undefined);
  useEffect(() => { AsyncStorage.getItem("qtv_token").then(setT); }, []);
  if (t === undefined) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#060714" }}><ActivityIndicator color="#06B6D4" /></View>;
  return t ? <Redirect href="/(tabs)/browse" /> : <Redirect href="/login" />;
}
