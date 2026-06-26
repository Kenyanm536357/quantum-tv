import axios from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BACKEND =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.backendUrl ||
  "";
export const API = `${BACKEND}/api`;

const client = axios.create({ baseURL: API, timeout: 25000 });

client.interceptors.request.use(async (config) => {
  const t = await AsyncStorage.getItem("qtv_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default client;

export const colors = {
  bg: "#060714",
  surface: "#0D0E23",
  surfaceAlt: "#1A1C3A",
  white: "#FFFFFF",
  zinc400: "#A1A1AA",
  zinc500: "#71717A",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  red: "#EF4444",
};
