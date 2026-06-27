import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;
export const ASSET_BASE = BACKEND;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((config) => {
  // Prefer user (watch) token if present, otherwise admin token (control panel)
  const userT = localStorage.getItem("qtv_user_token");
  const adminT = localStorage.getItem("qtv_admin_token");
  const token = userT || adminT;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const path = window.location.pathname;
      if (path.startsWith("/watch")) {
        localStorage.removeItem("qtv_user_token");
        if (!path.includes("/login")) window.location.href = "/login";
      } else {
        localStorage.removeItem("qtv_admin_token");
        if (!path.includes("/login")) window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default client;
