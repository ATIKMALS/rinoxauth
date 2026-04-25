"use client";

import { useState, useRef } from "react";
import { Download, Upload, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface ExportCsvButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number | undefined)[][];
  label?: string;
}

export function ExportCsvButton({ filename, headers, rows, label = "Export" }: ExportCsvButtonProps) {
  const exportToCsv = () => {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={exportToCsv}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:border-zinc-600/70 transition-all duration-300 backdrop-blur-sm group"
    >
      <Download className="h-4 w-4 group-hover:scale-110 transition-transform" />
      {label}
    </button>
  );
}

// ============================================
// IMPORT BUTTON (Same file)
// ============================================
interface ImportButtonProps {
  type: "users" | "licenses";
  label?: string;
}

export function ImportButton({ type, label = "Import" }: ImportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setMessage("");

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        setMessage("File is empty or has no data rows");
        setIsSuccess(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        if (values.length < 2) continue;

        try {
          if (type === "users") {
            const payload: any = {
              username: values[0],
              password: values[1],
              plan: values[2] || "free",
              expires_in_days: parseInt(values[3]) || 30,
              hwid_lock: values[4]?.toLowerCase() !== "false",
            };
            if (values[5]) payload.app_id = parseInt(values[5]);
            if (values[6]) payload.email = values[6];

            const res = await fetch(`/api/admin/users`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (res.ok) successCount++;
            else failCount++;
          } else if (type === "licenses") {
            const payload: any = {
              key: values[0] || undefined,
              plan: values[1] || "standard",
              expires_in_days: parseInt(values[2]) || 30,
              device_limit: parseInt(values[3]) || 1,
            };
            if (values[4]) payload.app_id = parseInt(values[4]);
            if (values[5]) payload.note = values[5];

            const res = await fetch(`/api/admin/licenses`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (res.ok) successCount++;
            else failCount++;
          }
        } catch {
          failCount++;
        }
      }

      setMessage(`✅ ${successCount} imported, ❌ ${failCount} failed`);
      setIsSuccess(successCount > 0);
      router.refresh();
    } catch {
      setMessage("❌ Failed to read file");
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    let csvContent = "";
    if (type === "users") {
      csvContent = "username,password,plan,expires_in_days,hwid_lock,app_id,email\njohn,pass123,free,30,true,1,john@example.com";
    } else {
      csvContent = "key,plan,expires_in_days,device_limit,app_id,note\n,standard,30,1,1,My License";
    }
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${type}-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:border-zinc-600/70 transition-all duration-300 backdrop-blur-sm group"
      >
        <Upload className="h-4 w-4 group-hover:scale-110 transition-transform" />
        {label}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md bg-slate-900/95 border border-zinc-700/50 rounded-2xl shadow-2xl backdrop-blur-xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Import {type === "users" ? "Users" : "Licenses"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Download Template */}
            <div className="mb-4 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
              <p className="text-xs text-zinc-400 mb-2">📋 Download template first:</p>
              <button
                onClick={handleDownloadTemplate}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                <Download className="h-3 w-3" />
                Download {type}.csv template
              </button>
            </div>

            {/* CSV Format Info */}
            <div className="mb-4 p-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30">
              <p className="text-xs text-zinc-400 mb-1 font-semibold">CSV Format:</p>
              {type === "users" ? (
                <p className="text-xs text-zinc-500 font-mono">
                  username, password, plan, expires_in_days, hwid_lock, app_id, email
                </p>
              ) : (
                <p className="text-xs text-zinc-500 font-mono">
                  key, plan, expires_in_days, device_limit, app_id, note
                </p>
              )}
            </div>

            {/* File Upload */}
            <div className="mb-4">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isLoading
                    ? "border-zinc-600 bg-zinc-800/20"
                    : "border-zinc-700/50 bg-zinc-800/30 hover:border-indigo-500/50 hover:bg-indigo-500/5"
                }`}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                    <span className="text-xs text-zinc-400">Importing...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-zinc-500" />
                    <span className="text-xs text-zinc-400">Click to upload CSV file</span>
                  </div>
                )}
              </label>
            </div>

            {/* Message */}
            {message && (
              <div className={`p-3 rounded-xl flex items-center gap-2 ${
                isSuccess ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}>
                {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span className="text-xs">{message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}