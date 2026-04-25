"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { CreateLicenseForm } from "@/components/forms/create-license-form";
import { ExportCsvButton } from "@/components/ui/export-csv-button";

interface LicenseRecord {
  id: number;
  application_name?: string;
  key: string;
  plan: string;
  issued_to?: string;
  device_limit: number;
  issued_date: string;
  expires_at: string;
  status: string;
  note?: string;
  hwid_lock?: boolean;
}

export function LicensesClientWrapper({ licenses }: { licenses: LicenseRecord[] }) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleCreateSuccess = () => router.refresh();

  const licenseExportRows = licenses.map((l) => [
    l.key, l.application_name || "Unknown", l.plan, l.status,
    l.expires_at, l.device_limit, l.note ?? "", l.hwid_lock ? "locked" : "open",
  ]);

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
        if (values.length < 1) continue;
        const payload: any = {
          key: values[0] || undefined,
          plan: values[1] || "standard",
          expires_in_days: parseInt(values[2]) || 30,
          device_limit: parseInt(values[3]) || 1,
        };
        if (values[4]) payload.app_id = parseInt(values[4]);
        if (values[5]) payload.note = values[5];
        try {
          const res = await fetch("/api/admin/licenses", {
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
        <button onClick={handleImportClick} disabled={isImporting} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-all duration-300">
          <UploadCloud className="h-4 w-4" /> {isImporting ? "Importing..." : "Import"}
        </button>
        <input type="file" accept=".csv,text/csv" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
        
        <ExportCsvButton filename={`licenses-${new Date().toISOString().slice(0, 10)}.csv`} headers={["Key","App","Plan","Status","Expires","Devices","Note","HWID"]} rows={licenseExportRows} label="Export" />
        
        <button onClick={() => setIsCreateModalOpen(true)} className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white inline-flex items-center gap-2 group shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-105">
          <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" /> Generate License
        </button>
      </div>
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Generate New License" size="lg">
        <CreateLicenseForm onClose={() => setIsCreateModalOpen(false)} onSuccess={handleCreateSuccess} />
      </Modal>
    </>
  );
}