import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { ClipboardCheck, RefreshCw, Printer, CheckCircle2, AlertTriangle, XCircle, Tv, Film, Clock } from "lucide-react";

const STATUS_META = {
  healthy: { label: "Healthy", icon: CheckCircle2, cls: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  warning: { label: "Needs Attention", icon: AlertTriangle, cls: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  critical: { label: "Critical", icon: XCircle, cls: "text-red-400 border-red-400/30 bg-red-400/10" },
};

function fmtAge(seconds) {
  if (seconds == null) return "never";
  if (seconds < 90) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-2xl font-heading font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function Audit() {
  const audit = useQuery({
    queryKey: ["audit-livetv-vod"],
    queryFn: async () => (await api.get("/admin/audit/livetv-vod")).data,
  });

  const d = audit.data;
  const meta = STATUS_META[d?.status] || STATUS_META.warning;
  const StatusIcon = meta.icon;

  return (
    <div data-testid="audit-page" className="space-y-6 fade-in max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap print:block">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Diagnostics</div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-1">Live TV + VOD Audit</h1>
          <p className="text-zinc-400 text-sm mt-2">
            On-demand health check of the Live TV channel and movie catalogs — refreshes every time you click "Run Audit".
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            data-testid="run-audit-btn"
            onClick={() => audit.refetch()}
            disabled={audit.isFetching}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-semibold disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${audit.isFetching ? "animate-spin" : ""}`} />
            {audit.isFetching ? "Running…" : "Run Audit"}
          </button>
          <button
            data-testid="print-audit-btn"
            onClick={() => window.print()}
            disabled={!d}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
      </div>

      {audit.isError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 text-red-300 text-sm p-4">
          Could not run the audit: {audit.error?.response?.data?.detail || "unknown error"}
        </div>
      )}

      {d && (
        <div className="space-y-6">
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${meta.cls}`}>
            <StatusIcon className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <div className="font-heading font-semibold">{meta.label}</div>
              <div className="text-xs opacity-80 mt-0.5 font-mono">
                Generated {new Date(d.generated_at).toLocaleString()}
              </div>
            </div>
            <ClipboardCheck className="w-5 h-5 opacity-50 shrink-0" />
          </div>

          {d.issues.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-heading font-semibold mb-2">Findings</div>
              <ul className="space-y-1.5">
                {d.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-zinc-300 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.issues.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300 flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              No issues found — catalogs look clean.
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Tv className="w-4 h-4 text-cyan-400" />
              <h2 className="font-heading text-lg font-bold">Live TV</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Channels" value={d.live.total_channels} />
              <StatCard label="Provider Channels" value={d.live.provider_channels} sub={`${d.live.provider_categories} categories`} />
              <StatCard label="Public US Channels" value={d.live.public_channels} />
              <StatCard label="Provider Cache Age" value={fmtAge(d.live.provider_cache_age_seconds)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs text-zinc-500">
              <div>Missing titles: {d.live.provider_missing_title}</div>
              <div>Missing stream_id: {d.live.provider_missing_stream_id}</div>
              <div>Duplicate ids: {d.live.provider_duplicate_ids}</div>
              <div>Divider entries skipped: {d.live.provider_divider_entries_skipped}</div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Film className="w-4 h-4 text-purple-400" />
              <h2 className="font-heading text-lg font-bold">VOD (Movies)</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Titles" value={d.vod.titles} sub={`${d.vod.categories} categories`} />
              <StatCard label="Cache Age" value={fmtAge(d.vod.cache_age_seconds)} />
              <StatCard label="Missing Titles" value={d.vod.missing_title} />
              <StatCard label="Duplicate ids" value={d.vod.duplicate_ids} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-600 print:text-zinc-800">
            <Clock className="w-3.5 h-3.5" />
            Provider {d.provider_configured ? "configured" : "not configured"} · Report generated {new Date(d.generated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
