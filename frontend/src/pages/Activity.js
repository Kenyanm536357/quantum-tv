import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";

export default function ActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["activity-all"],
    queryFn: async () => (await api.get("/admin/activity?limit=200")).data,
  });
  const items = data?.activity || [];
  return (
    <div data-testid="activity-page" className="space-y-6 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Stream</div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">Activity</h1>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {isLoading && <div className="neon-card p-6 text-center text-zinc-500">Loading…</div>}
        {items.length === 0 && !isLoading && (
          <div className="neon-card p-6 text-center text-zinc-500 text-sm">No activity yet.</div>
        )}
        {items.map((a, i) => (
          <div key={i} className="neon-card p-4">
            <div className="flex items-center gap-3">
              <img src={a.avatar || "/logo.png"} className="w-9 h-9 rounded-full border border-white/10 object-cover shrink-0" alt="" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.username}</div>
                <div className="text-xs text-zinc-500 font-mono truncate">{a.action}{a.server ? ` · ${a.server}` : ""}</div>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono shrink-0 text-right">
                {a.at ? new Date(a.at).toLocaleDateString() : "—"}
                <div>{a.at ? new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block neon-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 text-xs uppercase tracking-[0.2em] text-zinc-400">
              <th className="text-left py-3 px-5 font-heading font-semibold">User</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Action</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">Server</th>
              <th className="text-left py-3 px-5 font-heading font-semibold">At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && <tr><td colSpan={4} className="py-10 text-center text-zinc-500">Loading…</td></tr>}
            {items.map((a, i) => (
              <tr key={i} className="hover:bg-white/[0.03]">
                <td className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <img src={a.avatar || "/logo.png"} className="w-8 h-8 rounded-full border border-white/10 object-cover" alt="" />
                    <span>{a.username}</span>
                  </div>
                </td>
                <td className="py-3 px-5 text-sm text-zinc-300 font-mono">{a.action}</td>
                <td className="py-3 px-5 text-sm text-zinc-300">{a.server || "—"}</td>
                <td className="py-3 px-5 text-sm text-zinc-400 font-mono">{a.at ? new Date(a.at).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {items.length === 0 && !isLoading && (
              <tr><td colSpan={4} className="py-10 text-center text-zinc-500">No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
