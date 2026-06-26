import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import api from "../api";

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
        nav("/");
      } else {
        // Regular user signed in on the web — show a friendly message.
        // The native app is the proper place for streaming; the web is the admin's tool.
        setErr("This is the Quantum TV web portal. Please use the Quantum TV mobile app to start watching.");
      }
    } catch (e) {
      setErr(e?.response?.data?.detail || "Account is not registered or not activated");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.img
            src="/logo.png" alt="Quantum TV"
            initial={{ scale: 0.9, rotate: -5 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 120 }}
            className="w-24 h-24 rounded-3xl shadow-glow mb-4"
          />
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            <span className="gradient-text">Quantum TV</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2">Sign in to your account</p>
        </div>

        <div className="glass rounded-3xl p-8">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Username</label>
              <input
                data-testid="admin-username"
                className="qtv-input mt-2" placeholder="Enter your username"
                value={u} onChange={(e) => setU(e.target.value)} required
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
