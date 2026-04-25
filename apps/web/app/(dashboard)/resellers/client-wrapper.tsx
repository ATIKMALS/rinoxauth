"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { AddResellerForm } from "@/components/forms/add-reseller-form";
import { ExportCsvButton } from "@/components/ui/export-csv-button";

interface ResellerRecord {
  id: number;
  username: string;
  email?: string;
  credits: number;
  users_created: number;
  status: string;
  commission_rate?: number;
  phone?: string;
}

export function ResellersClientWrapper({ resellers }: { resellers: ResellerRecord[] }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleAddSuccess = () => router.refresh();

  const exportRows = resellers.map((r) => [
    r.username, r.email ?? "", r.credits, r.commission_rate ?? "",
    r.users_created ?? 0, r.status, r.phone ?? "",
  ]);

  // ============================================
  // IMPORT RESELLERS
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
        if (values.length < 2 || !values[0] || !values[1]) { failed++; continue; }
        const payload: any = {
          username: values[0],
          email: values[1],
          password: values[2] || `Temp${Math.random().toString(36).slice(2, 8)}`,
          credits: parseInt(values[3]) || 100,
          commission_rate: parseFloat(values[4]) || 20,
        };
        if (values[5]) payload.phone = values[5];
        if (values[6]) payload.notes = values[6];
        try {
          const res = await fetch("/api/admin/resellers", {
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
        <ExportCsvButton filename={`resellers-${new Date().toISOString().slice(0, 10)}.csv`} headers={["Username","Email","Credits","Commission%","Users","Status","Phone"]} rows={exportRows} label="Export" />

        {/* Add Button */}
        <button onClick={() => setIsAddModalOpen(true)} className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white inline-flex items-center gap-2 group shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-105">
          <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" /> Add Reseller
        </button>
      </div>
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Reseller" size="lg">
        <AddResellerForm onClose={() => setIsAddModalOpen(false)} onSuccess={handleAddSuccess} />
      </Modal>
    </>
  );
}