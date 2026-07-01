import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import api from "../api";

/**
 * Device activation: user types the 6-char code shown on their Fire Stick.
 * Requires the user to be signed in first — if not, redirect to /login with
 * a continue=/activate so they come back here.
 */
export default function Activate() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = (searchParams.get("code") || "").toUpperCase().slice(0, 6);
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // {username}
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // If there's no user/admin token at all, kick to login first
    const userToken = localStorage.getItem("qtv_user_token") || localStorage.getItem("qtv_token");
    const adminToken = localStorage.getItem("qtv_admin_token");
    if (!userToken && !adminToken) {
      nav(`/login?continue=${encodeURIComponent("/activate" + (initialCode ? `?code=${initialCode}` : ""))}`);
    } else {
      inputRef.current?.focus();
    }
  }, [nav, initialCode]);

  const submit = async () => {
    setError(null);
    const c = code.trim().toUpperCase();
    if (c.length !== 6) {
      setError("Enter the 6-character code shown on your Fire Stick.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/pair/verify", { user_code: c });
      setSuccess({ username: data.username });
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not activate. Double-check the code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 py-8 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="" className="w-20 h-20 rounded-3xl shadow-glow mb-4" />
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight"><span className="gradient-text">Activate Fire TV</span></h1>
          <p className="text-zinc-400 text-sm mt-2 text-center">Enter the code shown on your Fire Stick screen.</p>
        </div>

        <div className="glass rounded-3xl p-6 sm:p-8">
          {success ? (
            <div className="text-center" data-testid="activate-success">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-300" />
              </div>
              <h2 className="font-heading text-xl font-bold mb-1">Fire Stick Activated!</h2>
              <p className="text-sm text-zinc-400 mb-5">Signed in as <span className="text-cyan-200 font-mono">{success.username}</span>. Your Fire Stick will sign in automatically in a few seconds.</p>
              <button data-testid="activate-done" onClick={() => nav("/")} className="btn-gradient w-full py-3">Done</button>
            </div>
          ) : (
            <>
              <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Activation code</label>
              <input
                ref={inputRef}
                data-testid="activate-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="ABCDEF"
                className="qtv-input mt-2 text-center tracking-[0.4em] font-mono text-2xl sm:text-3xl uppercase"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
                maxLength={6}
              />
              {error && (
                <div data-testid="activate-error" className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <button
                data-testid="activate-submit"
                disabled={submitting || code.length !== 6}
                onClick={submit}
                className="btn-gradient w-full py-3 mt-5 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {submitting ? "Activating…" : "Activate"}
              </button>
              <p className="text-[11px] text-zinc-500 mt-5 text-center leading-relaxed">
                The code expires after 10 minutes. If it doesn't work, generate a fresh one on the Fire Stick screen.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
