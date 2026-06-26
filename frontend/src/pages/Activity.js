import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";

export default function ActivityPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["activity-all"],
    queryFn: async () => (await api.get("/admin/activity?limit=200")).data,
  });
  return (
    <div data-testid="activity-page" className="space-y-6 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Stream</div>
        <h1 className="font-heading text-3xl font-bold mt-1">Activity</h1>
      </div>
      <div className="neon-card overflow-hidden">
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
            {(data?.activity || []).map((a, i) => (
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
            {(data?.activity || []).length === 0 && !isLoading && (
              <tr><td colSpan={4} className="py-10 text-center text-zinc-500">No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
