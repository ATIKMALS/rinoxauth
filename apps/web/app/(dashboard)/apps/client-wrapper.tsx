"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud } from "lucide-react";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { Modal } from "@/components/ui/modal";
import { CreateAppForm } from "@/components/forms/create-app-form";
import { CredentialsModal } from "@/components/modals/credentials-modal";

interface AppRecord {
  id: number | string;
  name: string;
  version: string;
  status: string;
  users: number;
}

interface AppsClientWrapperProps {
  apps: AppRecord[];
  currentUser?: string | null;
}

export function AppsClientWrapper({ apps, currentUser }: AppsClientWrapperProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    router.refresh();
  };

  const openCredentials = (appId: string | number) => {
    setSelectedAppId(String(appId));
    setIsCredentialModalOpen(true);
  };

  const exportRows = apps.map((a) => [a.id, a.name, a.version, a.status, a.users]);

  // ============================================
  // IMPORT APPS
  // ============================================
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    let imported = 0;
    let failed = 0;

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        alert("CSV file must have header + data rows");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        if (values.length < 1 || !values[0]) continue;

        const appName = values[headers.includes("app_name") ? headers.indexOf("app_name") : headers.includes("name") ? headers.indexOf("name") : 0];
        const version = values[headers.includes("version") ? headers.indexOf("version") : 1] || "1.0.0";

        if (!appName) { failed++; continue; }

        try {
          const res = await fetch("/api/admin/apps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_name: appName, version, created_by: currentUser }),
          });
          if (res.ok) imported++;
          else failed++;
        } catch {
          failed++;
        }
      }

      alert(`✅ ${imported} apps imported, ❌ ${failed} failed`);
      router.refresh();
    } catch {
      alert("Failed to read CSV file");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Header Buttons */}
      <div className="flex items-center gap-3">
        {/* Import Button */}
        <button
          type="button"
          onClick={handleImportClick}
          disabled={isImporting}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:border-zinc-600/70 transition-all duration-300 backdrop-blur-sm group"
        >
          <UploadCloud className="h-4 w-4 group-hover:scale-110 transition-transform" />
          {isImporting ? "Importing..." : "Import"}
        </button>
        <input
          type="file"
          accept=".csv,text/csv"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Export Button */}
        <ExportCsvButton
          filename={`applications-${new Date().toISOString().slice(0, 10)}.csv`}
          headers={["ID", "Name", "Version", "Status", "Users"]}
          rows={exportRows}
          label="Export"
        />

        {/* Create Button */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white inline-flex items-center gap-2 group shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-105"
        >
          <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" />
          Create New App
        </button>
      </div>

      {/* Create App Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Application" size="md">
        <CreateAppForm onClose={() => setIsCreateModalOpen(false)} onSuccess={handleCreateSuccess} createdBy={currentUser || undefined} />
      </Modal>

      {/* Credentials Modal */}
      <CredentialsModal
        isOpen={isCredentialModalOpen}
        onClose={() => { setIsCredentialModalOpen(false); setSelectedAppId(null); }}
        appId={selectedAppId || ""}
      />
    </>
  );
}