import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Save, Check, Lock, LockOpen, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/admin/settings")).data,
  });
  const [form, setForm] = useState({
    service_name: "",
    motd: "",
    allow_new_signups: true,
    require_invite: false,
    parental_pin_enabled: false,
  });
  const [newPin, setNewPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const hydrated = useRef(false);

  // Hydrate once from server on first load; do not overwrite user edits afterward.
  useEffect(() => {
    if (data && !hydrated.current) {
      setForm((prev) => ({ ...prev, ...data }));
      hydrated.current = true;
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (body) => api.put("/admin/settings", body),
    onSuccess: (_resp, vars) => {
      setForm((prev) => ({ ...prev, ...vars }));
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  const savePin = useMutation({
    mutationFn: async () => api.put("/admin/settings", { parental_pin: newPin }),
    onSuccess: () => {
      setNewPin("");
      qc.invalidateQueries({ queryKey: ["settings"] });
      setPinMsg("PIN saved.");
      setTimeout(() => setPinMsg(""), 2000);
    },
    onError: (e) => {
      setPinMsg(e?.response?.data?.detail || "Failed to save PIN.");
      setTimeout(() => setPinMsg(""), 3000);
    },
  });

  const clearPin = useMutation({
    mutationFn: async () => api.put("/admin/settings", { parental_pin: "" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setPinMsg("PIN cleared.");
      setTimeout(() => setPinMsg(""), 2000);
    },
  });

  return (
    <div data-testid="settings-page" className="max-w-2xl space-y-6 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Configuration</div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">Settings</h1>
      </div>

      {/* General settings */}
      <div className="neon-card p-5 sm:p-6 space-y-5">
        <div>
          <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Service Name</label>
          <input
            data-testid="service-name"
            className="qtv-input mt-2"
            value={form.service_name || ""}
            onChange={(e) => setForm({ ...form, service_name: e.target.value })}
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">Message of the day</label>
          <textarea
            data-testid="motd"
            className="qtv-input mt-2" rows={3}
            value={form.motd || ""}
            onChange={(e) => setForm({ ...form, motd: e.target.value })}
            placeholder="Shown in the mobile app banner (optional)"
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <div className="text-sm">Allow new signups</div>
            <div className="text-xs text-zinc-500">If off, only existing users can sign in.</div>
          </div>
          <button
            data-testid="toggle-signups"
            onClick={() => setForm({ ...form, allow_new_signups: !form.allow_new_signups })}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.allow_new_signups ? "bg-gradient-to-r from-purple-500 to-cyan-500" : "bg-white/10"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.allow_new_signups ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <button
          data-testid="save-settings"
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
          className="btn-gradient px-6 py-3 flex items-center gap-2"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>

      {/* Parental Controls */}
      <div className="neon-card p-5 sm:p-6 space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading mb-1">Parental Controls</div>
          <p className="text-xs text-zinc-500">Lock adult channels behind a 4-digit PIN on all devices.</p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2">
            {form.parental_pin_enabled ? <Lock className="w-4 h-4 text-purple-400" /> : <LockOpen className="w-4 h-4 text-zinc-500" />}
            <div>
              <div className="text-sm">Adult channel lock</div>
              <div className="text-xs text-zinc-500">
                {form.parental_pin_enabled ? "Enabled — PIN required on device" : "Disabled — all channels visible"}
              </div>
            </div>
          </div>
          <button
            data-testid="toggle-parental"
            onClick={() => {
              const next = { ...form, parental_pin_enabled: !form.parental_pin_enabled };
              setForm(next);
              save.mutate(next);
            }}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.parental_pin_enabled ? "bg-gradient-to-r from-purple-500 to-cyan-500" : "bg-white/10"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.parental_pin_enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-heading">
            {data?.parental_pin_set ? "Change PIN" : "Set PIN"}
          </label>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <input
                data-testid="parental-pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                pattern="[0-9]*"
                className="qtv-input w-full pr-10"
                placeholder="4-digit PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              data-testid="save-pin"
              onClick={() => savePin.mutate()}
              disabled={newPin.length !== 4 || savePin.isPending}
              className="btn-gradient px-4 py-2 flex items-center gap-1 disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            {data?.parental_pin_set && (
              <button
                data-testid="clear-pin"
                onClick={() => clearPin.mutate()}
                disabled={clearPin.isPending}
                className="px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm disabled:opacity-40"
              >
                Clear
              </button>
            )}
          </div>
          {pinMsg && <p className="text-xs mt-2 text-cyan-400">{pinMsg}</p>}
          <p className="text-xs text-zinc-500 mt-2">
            This PIN will be required on the mobile app to access channels categorized as adult content.
          </p>
        </div>
      </div>
    </div>
  );
}
