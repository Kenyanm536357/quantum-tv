import React, { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { Upload, Trash2, Copy, Check, Tv, Download, CheckCircle2, AlertTriangle } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const SHORT_URL = `${BACKEND}/api/q`;
const INSTALL_URL = `${BACKEND}/api/install`;
// Strip protocol so the user types fewer chars on the Fire TV remote
const DOWNLOADER_CODE = (BACKEND || "").replace(/^https?:\/\//, "") + "/api/q";

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-heading font-bold shrink-0">{n}</div>
      <div>
        <div className="font-heading font-semibold text-base">{title}</div>
        <div className="text-sm text-zinc-400 mt-1">{children}</div>
      </div>
    </div>
  );
}

export default function FireTV() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);

  const info = useQuery({
    queryKey: ["apk-info"],
    queryFn: async () => (await api.get("/admin/apk/info")).data,
  });

  const upload = async (file) => {
    setErr(null); setUploading(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/admin/apk/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      qc.invalidateQueries({ queryKey: ["apk-info"] });
    } catch (e) {
      setErr(e?.response?.data?.detail || "Upload failed");
    } finally { setUploading(false); }
  };

  const del = useMutation({
    mutationFn: async () => api.delete("/admin/apk"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["apk-info"] }),
  });

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <div data-testid="firetv-page" className="space-y-7 fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 font-heading">Install</div>
        <h1 className="font-heading text-3xl font-bold mt-1">Fire TV / Android</h1>
        <p className="text-zinc-400 text-sm mt-2">Host your Quantum TV APK on this server and install it on any Fire Stick via the Downloader app.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upload */}
        <div className="neon-card p-6">
          <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-purple-400" /> APK File
          </h3>

          {info.data?.available ? (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 mb-4">
              <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> APK is live
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-zinc-400 font-mono">
                <div><span className="text-zinc-500">version</span><div className="text-white">{info.data.version}</div></div>
                <div><span className="text-zinc-500">size</span><div className="text-white">{Math.round((info.data.size||0)/1024/1024*10)/10} MB</div></div>
                <div><span className="text-zinc-500">sha256</span><div className="text-white">{info.data.sha256}…</div></div>
                <div><span className="text-zinc-500">uploaded</span><div className="text-white">{info.data.uploaded_at ? new Date(info.data.uploaded_at).toLocaleString() : "—"}</div></div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
              <div className="text-sm text-yellow-200">No APK uploaded yet. Upload one below to start serving downloads.</div>
            </div>
          )}

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-white/10 hover:border-cyan-500/40 rounded-2xl p-8 text-center transition-colors"
            data-testid="apk-dropzone"
          >
            <Upload className="w-7 h-7 text-zinc-400 mx-auto" />
            <div className="mt-3 font-heading font-semibold">Drop quantum-tv.apk here or click to browse</div>
            <div className="text-xs text-zinc-500 mt-1">Max ~200 MB. Replaces the existing APK.</div>
            <input ref={fileRef} type="file" accept=".apk,application/vnd.android.package-archive"
              onChange={onPick} className="hidden" data-testid="apk-input" />
          </div>

          {uploading && (
            <div className="mt-4">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-zinc-500 mt-2 font-mono">{progress}% uploaded…</div>
            </div>
          )}
          {err && <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}

          {info.data?.available && (
            <button data-testid="apk-delete" onClick={() => { if (window.confirm("Delete the APK from the server?")) del.mutate(); }}
              className="mt-4 text-sm text-red-300 hover:text-red-200 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Remove APK
            </button>
          )}
        </div>

        {/* Downloader code */}
        <div className="neon-card p-6">
          <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
            <Tv className="w-4 h-4 text-cyan-400" /> Downloader Code
          </h3>
          <p className="text-sm text-zinc-400 mb-4">In the <b className="text-white">Downloader</b> app on Fire TV, type this URL exactly:</p>

          <div className="bg-[#0b0c1f] border border-cyan-500/30 rounded-xl p-5 text-center">
            <div className="font-mono text-2xl gradient-text break-all" data-testid="downloader-code">{DOWNLOADER_CODE}</div>
          </div>
          <div className="flex gap-2 mt-3">
            <button data-testid="copy-code" onClick={() => copy(DOWNLOADER_CODE)}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-sm flex items-center justify-center gap-2">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy code"}
            </button>
            <a href={SHORT_URL} target="_blank" rel="noopener"
              className="flex-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl py-2.5 text-sm font-heading font-bold flex items-center justify-center gap-2 hover:brightness-110">
              <Download className="w-4 h-4" /> Test download
            </a>
          </div>

          <div className="mt-5 text-xs text-zinc-500">
            Friendly landing page: <a className="text-cyan-400 hover:text-cyan-300" href={INSTALL_URL} target="_blank" rel="noopener">{INSTALL_URL}</a>
          </div>
        </div>
      </div>

      {/* Install steps */}
      <div className="neon-card p-7">
        <h3 className="font-heading font-semibold text-lg mb-5">Install on Fire Stick / Fire TV</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Step n={1} title="Allow apps from unknown sources">
            On your Fire TV: <b className="text-white">Settings → My Fire TV → Developer Options → Install Unknown Apps</b>, then toggle <b className="text-white">ON</b> for the Downloader app.
          </Step>
          <Step n={2} title="Open the Downloader app">
            If you don't have it, search <b className="text-white">Downloader</b> in the Fire TV app store and install it (free, by AFTVnews).
          </Step>
          <Step n={3} title="Enter the URL above">
            In Downloader's URL field, type the code shown on the right and press <b className="text-white">Go</b>.
          </Step>
          <Step n={4} title="Install Quantum TV">
            When the APK finishes downloading, choose <b className="text-white">Install</b> → <b className="text-white">Open</b>. Sign in with the username & password you created in Users.
          </Step>
        </div>
      </div>
    </div>
  );
}
