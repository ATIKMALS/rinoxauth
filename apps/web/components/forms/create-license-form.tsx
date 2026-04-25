"use client";

import { useState, useEffect, useCallback } from "react";
import { CLIENT_BACKEND_BASE_URL } from "@/lib/client-env";
import { Button } from "@/components/ui/button";
import { Key, Layers, Clock, AlertCircle, CheckCircle2, Info, StickyNote, Loader2, RefreshCw, Lock } from "lucide-react";

interface AppRecord {
  id: number; name: string; version: string; status: string;
}

interface CreateLicenseFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateLicenseForm({ onClose, onSuccess }: CreateLicenseFormProps) {
  const [formData, setFormData] = useState({
    app_id: "", custom_key: "", use_custom_key: false,
    expiry_days: 30, note: "", hwid_lock: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  
  const fetchApps = useCallback(async () => {
    try {
      setIsLoadingApps(true);
      setFetchError(null);
      
      // Get current user from session
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json().catch(() => ({}));
      const currentUser = sessionData?.user?.username || '';
      
      // Send created_by to filter apps for current user
      const query = currentUser ? `?created_by=${encodeURIComponent(currentUser)}` : '';
      const res = await fetch(`${CLIENT_BACKEND_BASE_URL}/api/apps${query}`);
      
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      const list = data.data || data || [];
      
      if (Array.isArray(list)) {
        setApps(list);
        if (list.length > 0) {
          setFormData((p) => (p.app_id ? p : { ...p, app_id: String(list[0].id) }));
        }
      }
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to load apps");
    } finally {
      setIsLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    void fetchApps();
  }, [fetchApps]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.app_id) errs.app_id = "Please select an application";
    if (formData.use_custom_key && formData.custom_key && formData.custom_key.length < 4) errs.custom_key = "Min 4 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        plan: "standard",
        device_limit: 1,
        note: formData.note || undefined,
        hwid_lock: formData.hwid_lock,
      };
      if (formData.app_id) body.app_id = Number(formData.app_id);
      if (formData.use_custom_key && formData.custom_key) body.key = `RinoxAuth-${formData.custom_key}`;
      if (formData.expiry_days === 0) body.is_lifetime = true;
      else {
        body.expires_in_days = formData.expiry_days;
        body.is_lifetime = false;
      }

      const res = await fetch(`${CLIENT_BACKEND_BASE_URL}/api/admin/licenses`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        if (data.data?.key) setGeneratedKey(data.data.key);
        onSuccess?.();
        setTimeout(() => onClose(), 2500);
      } else setErrors({ submit: data?.message || "Failed" });
    } catch (e: any) { setErrors({ submit: e.message }); }
    finally { setIsLoading(false); }
  };

  const generateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const key = Array.from({ length: 4 }, () => 
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    ).join("-");
    setFormData({ ...formData, custom_key: key });
  };

  const selectedApp = apps.find(a => String(a.id) === formData.app_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {generatedKey ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">License Generated!</h3>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-emerald-400 mb-2 uppercase">License Key</p>
            <div className="text-lg font-mono font-bold text-white break-all">RinoxAuth-{generatedKey}</div>
          </div>
        </div>
      ) : (
        <>
          {/* App Select */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Select Application <span className="text-red-400">*</span>
            </label>
            {fetchError ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-amber-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />{fetchError}
                  </p>
                  <button type="button" onClick={fetchApps} className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Layers className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${formData.app_id ? "text-indigo-400" : "text-zinc-500"}`} />
                <select 
                  value={formData.app_id} 
                  onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
                  disabled={isLoadingApps}
                  className={`w-full rounded-xl border bg-zinc-800/50 pl-10 pr-10 py-2.5 text-sm text-white backdrop-blur-sm focus:outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 ${errors.app_id ? "border-red-500/50" : "border-zinc-700/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"}`}
                >
                  <option value="" className="bg-zinc-900 text-zinc-500">
                    {isLoadingApps ? "Loading..." : apps.length === 0 ? "No apps - Create one first" : "Select application"}
                  </option>
                  {apps.map(a => (
                    <option key={a.id} value={a.id} className="bg-zinc-900 text-white">
                      {a.name} (v{a.version})
                    </option>
                  ))}
                </select>
                {isLoadingApps && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />}
              </div>
            )}
            {selectedApp && (
              <p className="text-xs text-zinc-500 mt-1">{selectedApp.name} • v{selectedApp.version}</p>
            )}
            {errors.app_id && (
              <p className="text-xs text-red-400 mt-1"><AlertCircle className="h-3 w-3 inline" />{errors.app_id}</p>
            )}
          </div>

          {/* Custom Key Option */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 cursor-pointer hover:border-indigo-500/30 transition-all">
            <input 
              type="checkbox" 
              checked={formData.use_custom_key} 
              onChange={(e) => setFormData({ ...formData, use_custom_key: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/20" 
            />
            <span className="text-sm text-zinc-300">Use Custom License Key</span>
          </label>

          {formData.use_custom_key && (
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input 
                type="text" 
                value={formData.custom_key} 
                onChange={(e) => setFormData({ ...formData, custom_key: e.target.value })}
                placeholder="XXXX-YYYY-ZZZZ-WWWW"
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 pl-10 pr-24 py-2.5 text-sm text-white font-mono placeholder-zinc-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none" 
              />
              <button 
                type="button" 
                onClick={generateKey} 
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs hover:bg-indigo-500/20 transition-all"
              >
                Generate
              </button>
            </div>
          )}

          {/* Expiry Days */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Expiry Days</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input 
                type="number" 
                min="0" 
                max="3650" 
                value={formData.expiry_days} 
                onChange={(e) => setFormData({ ...formData, expiry_days: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none" 
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1"><Info className="h-3 w-3 inline" />Set 0 for lifetime</p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Note <span className="text-zinc-600">(Optional)</span>
            </label>
            <div className="relative">
              <StickyNote className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <textarea 
                value={formData.note} 
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="e.g., For Client ABC" 
                rows={2}
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none resize-none" 
              />
            </div>
          </div>

          {/* HWID Lock */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 cursor-pointer hover:border-indigo-500/30 transition-all">
            <input 
              type="checkbox" 
              checked={formData.hwid_lock} 
              onChange={(e) => setFormData({ ...formData, hwid_lock: e.target.checked })}
              className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/20" 
            />
            <Lock className="h-4 w-4 text-zinc-400" />
            <span className="text-sm text-zinc-300">Enable HWID Lock</span>
          </label>

          {/* Info Box */}
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
            <p className="text-xs text-indigo-300">
              Generate key → Give to user → User registers with username & password
            </p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs text-red-300">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 transition-all duration-300"
            >
              Cancel
            </button>
            <Button 
              type="submit" 
              disabled={isLoading} 
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Key"
              )}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}