"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { CreateUserForm } from "@/components/forms/create-user-form";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { AppRecord, UserRecord } from "@/lib/types";
import { CLIENT_BACKEND_BASE_URL } from "@/lib/client-env";

interface UserWithApp extends UserRecord {
  application_name?: string;
}

interface UsersClientWrapperProps {
  users: UserWithApp[];
  apps: AppRecord[];
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (char === '"') { if (next === '"') { value += '"'; i += 1; } else { inQuotes = false; } }
      else { value += char; }
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === ',') { row.push(value.trim()); value = ""; continue; }
    if (char === '\r') continue;
    if (char === '\n') { row.push(value.trim()); rows.push(row); row = []; value = ""; continue; }
    value += char;
  }
  if (value.length || row.length) { row.push(value.trim()); rows.push(row); }
  return rows.filter((r) => r.length > 0);
}

function parseBoolean(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function parseExpiresInDays(value: string | undefined) {
  if (!value) return 30;
  const n = value.trim().toLowerCase();
  if (n === "never" || n === "lifetime") return 3650;
  const p = Number(n);
  if (!Number.isNaN(p) && p > 0) return Math.ceil(p);
  return 30;
}

export function UsersClientWrapper({ users, apps }: UsersClientWrapperProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const exportRows = users.map((user) => [
    user.username, user.application_name || "Unknown", user.email || "",
    user.plan || "", user.expires_at?.slice?.(0, 10) || "", user.status || "", user.hwid || "",
  ]);

  const getAppId = (value: string) => {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > 0 && apps.some((app) => app.id === numeric)) return numeric;
    const app = apps.find((app) => app.name.toLowerCase() === value.trim().toLowerCase());
    return app?.id;
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { alert("CSV must have header + data rows"); return; }
      const headerRow = rows[0].map((c) => c.trim().toLowerCase());
      const gi = (names: string[]) => names.findIndex((n) => headerRow.includes(n));
      const uIdx = gi(["username", "user"]);
      const pIdx = gi(["password", "pass", "pwd"]);
      const aIdx = gi(["application", "app", "app_name", "application_name", "app_id"]);
      const eIdx = gi(["email", "email_address"]);
      const plIdx = gi(["plan", "subscription"]);
      const exIdx = gi(["expires_at", "expiry", "expiration", "expires"]);
      const hIdx = gi(["hwid_lock", "hwid", "hwid_locked"]);
      if (uIdx === -1 || aIdx === -1) { alert("CSV must include 'username' and 'application' columns."); return; }

      let imported = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const username = row[uIdx]?.trim();
        const appId = getAppId(row[aIdx]?.trim());
        if (!username || !appId) continue;
        const payload = {
          username,
          password: row[pIdx]?.trim() || `Temp${Math.random().toString(36).slice(2, 8)}`,
          email: row[eIdx]?.trim() || undefined,
          plan: row[plIdx]?.trim().toLowerCase() || "free",
          app_id: appId,
          expires_in_days: parseExpiresInDays(row[exIdx]),
          hwid_lock: parseBoolean(row[hIdx]),
        };
        const res = await fetch(`${CLIENT_BACKEND_BASE_URL}/api/admin/users`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (res.ok) imported++;
      }
      alert(`Imported ${imported} users successfully!`);
      router.refresh();
    } catch {
      alert("Failed to import users.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Buttons Only */}
      <div className="flex items-center gap-2">
        <button onClick={() => setIsModalOpen(true)} className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white inline-flex items-center gap-2 group shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-[1.02]">
          <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" /> Create User
        </button>
        <ExportCsvButton filename={`users-${new Date().toISOString().slice(0, 10)}.csv`} headers={["Username","Application","Email","Plan","Expires","Status","HWID"]} rows={exportRows} label="Export CSV" />
        <button onClick={handleImportClick} disabled={isImporting} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-all duration-300">
          <UploadCloud className="h-4 w-4" /> {isImporting ? "Importing..." : "Import CSV"}
        </button>
        <input type="file" accept=".csv,text/csv" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
      </div>

      {/* Modal Only */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New User" size="lg">
        <CreateUserForm onClose={() => setIsModalOpen(false)} onSuccess={() => router.refresh()} />
      </Modal>
    </>
  );
}