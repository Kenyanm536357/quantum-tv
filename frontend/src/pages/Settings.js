import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Save, Check } from "lucide-react";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/admin/settings")).data,
  });
  const [form, setForm] = useState({ service_name: "", motd: "", allow_new_signups: true, require_invite: false });
  const [saved, setSaved] = useState(false);
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
      // Reflect the just-saved values locally without waiting on refetch overwrite.
      setForm((prev) => ({ ...prev, ...vars }));
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  return (
    <div data-testid="settings-page" className="max-w-2xl space-y-6 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Configuration</div>
        <h1 className="font-heading text-3xl font-bold mt-1">Settings</h1>
      </div>
      <div className="neon-card p-6 space-y-5">
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
    </div>
  );
}
