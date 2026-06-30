import axios from "axios";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND}/api`;
export const ASSET_BASE = BACKEND;

/**
 * Detect whether this build is talking to the production backend
 * (quantumtv.app / *.emergent.host) or the preview backend
 * (*.preview.emergentagent.com). The admin panel shows a warning banner
 * when on preview so the operator doesn't create users in the wrong DB.
 */
export const IS_PRODUCTION_BACKEND = /quantumtv\.app|emergent\.host/i.test(BACKEND || "");
export const PRODUCTION_URL = "https://quantumtv.app";

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
