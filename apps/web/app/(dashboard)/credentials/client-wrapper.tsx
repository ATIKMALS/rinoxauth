"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { GenerateApiKeyForm } from "@/components/forms/generate-api-key-form";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import type { ApiKeyRecord } from "@/lib/types";

export function CredentialsClientWrapper({ credentials }: { credentials: ApiKeyRecord[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSuccess = () => router.refresh();

  const exportRows = credentials.map((c) => [
    c.name, c.prefix, c.status, c.created_at, c.last_used ?? "",
    (c.permissions && c.permissions.join(";")) || "",
  ]);

  // ============================================
  // IMPORT API KEYS
  // ============================================
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    let imported = 0, failed = 0;
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { alert("CSV must have header + data rows"); return; }
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        if (values.length < 1 || !values[0]) { failed++; continue; }
        const payload: any = {
          name: values[0],
          permissions: values[1] ? values[1].split(";").map((p: string) => p.trim()) : ["read"],
          expires_in_days: parseInt(values[2]) || 90,
        };
        if (values[3]) payload.app_id = parseInt(values[3]);
        try {
          const res = await fetch("/api/admin/api-keys", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          });
          if (res.ok) imported++; else failed++;
        } catch { failed++; }
      }
      alert(`✅ ${imported} imported, ❌ ${failed} failed`);
      router.refresh();
    } catch { alert("Failed to read file"); }
    finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Import Button */}
        <button onClick={handleImportClick} disabled={isImporting} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-all duration-300">
          <UploadCloud className="h-4 w-4" /> {isImporting ? "Importing..." : "Import"}
        </button>
        <input type="file" accept=".csv,text/csv" ref={fileInputRef} className="hidden" onChange={handleFileChange} />

        {/* Export Button */}
        <ExportCsvButton filename={`api-credentials-${new Date().toISOString().slice(0, 10)}.csv`} headers={["Name","Key prefix","Status","Created","Last used","Permissions"]} rows={exportRows} label="Export" />

        {/* Generate Button */}
        <button onClick={() => setIsModalOpen(true)} className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white inline-flex items-center gap-2 group shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-105">
          <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" /> Generate New Key
        </button>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Generate New API Key" size="lg">
        <GenerateApiKeyForm onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
      </Modal>
    </>
  );
}