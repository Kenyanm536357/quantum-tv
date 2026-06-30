import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import api, { IS_PRODUCTION_BACKEND, PRODUCTION_URL } from "../api";

export default function Login() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username: u, password: p });
      if (data.role === "admin") {
        localStorage.setItem("qtv_admin_token", data.token);
        localStorage.removeItem("qtv_user_token");
        nav("/");
      } else {
        localStorage.setItem("qtv_user_token", data.token);
        localStorage.removeItem("qtv_admin_token");
        localStorage.setItem("qtv_user", JSON.stringify({
          username: data.username, display_name: data.display_name, avatar: data.avatar,
        }));
        nav("/watch");
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Incorrect username or password. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <motion.img
            src="/logo.png" alt="Quantum TV"
            initial={{ scale: 0.9, rotate: -5 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 120 }}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl shadow-glow mb-4"
          />
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
            <span className="gradient-text">Quantum TV</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2">Sign in to your account</p>
        </div>

        {!IS_PRODUCTION_BACKEND && (
          <div data-testid="login-preview-banner" className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm leading-snug text-amber-100">
              <div className="font-semibold text-amber-200 mb-0.5">Preview environment</div>
              Users created here will NOT show up on your Fire Stick. To manage real users, sign in at{" "}
              <a href={PRODUCTION_URL + "/login"} className="underline font-medium text-amber-200 break-all">
                {PRODUCTION_URL.replace(/^https?:\/\//, "")}/login
              </a>.
            </div>
          </div>
        )}

        <div className="glass rounded-3xl p-6 sm:p-8">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Username</label>
              <input
                data-testid="admin-username"
                className="qtv-input mt-2" placeholder="Enter your username"
                value={u} onChange={(e) => setU(e.target.value)}
                autoCapitalize="none" autoCorrect="off" spellCheck="false"
                required
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Password</label>
              <div className="relative mt-2">
                <input
                  data-testid="admin-password"
                  type={show ? "text" : "password"}
                  className="qtv-input pr-12" placeholder="Enter your password"
                  value={p} onChange={(e) => setP(e.target.value)} required
                />
                <button
                  type="button"
                  data-testid="toggle-password"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {err && <div data-testid="login-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">{err}</div>}
            <button
              type="submit" data-testid="admin-signin"
              disabled={loading}
              className="btn-gradient w-full py-4 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
