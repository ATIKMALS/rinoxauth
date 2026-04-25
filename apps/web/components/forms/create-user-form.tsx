"use client";

import { useState, useEffect, useCallback } from "react";
import { CLIENT_BACKEND_BASE_URL } from "@/lib/client-env";
import { Button } from "@/components/ui/button";
import { 
  User, Mail, Lock, Clock, AlertCircle, CheckCircle2, Info, Eye, EyeOff, Layers, Loader2, RefreshCw
} from "lucide-react";

interface AppRecord {
  id: number;
  name: string;
  version: string;
  status: string;
}

interface CreateUserFormProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateUserForm({ onClose, onSuccess }: CreateUserFormProps) {
  const [formData, setFormData] = useState({
    app_id: "",
    username: "",
    password: "",
    email: "",
    plan: "free",
    days: 30, hours: 0, minutes: 0, seconds: 0,
    hwid_lock: false,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState("30d");

  const fetchApps = useCallback(async () => {
    try {
      setIsLoadingApps(true);
      setFetchError(null);
      
      // ✅ Get current user from session
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json().catch(() => ({}));
      const currentUser = sessionData?.user?.username || '';
      
      // ✅ Send created_by to filter apps
      const query = currentUser ? `?created_by=${encodeURIComponent(currentUser)}` : '';
      const response = await fetch(`${CLIENT_BACKEND_BASE_URL}/api/apps${query}`);

      // ✅ Check if response is OK
      if (!response.ok) throw new Error(`Failed (${response.status})`);

      const data = await response.json();
      const appsList = data.data || data || [];

      if (Array.isArray(appsList)) {
        setApps(appsList);
        if (appsList.length > 0) {
          setFormData((prev) => (prev.app_id ? prev : { ...prev, app_id: String(appsList[0].id) }));
        }
      }
    } catch (error: unknown) {
      setFetchError(error instanceof Error ? error.message : "Failed to load apps");
    } finally {
      setIsLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    void fetchApps();
  }, [fetchApps]);

  useEffect(() => {
    const parts = [];
    if (formData.days > 0) parts.push(`${formData.days}d`);
    if (formData.hours > 0) parts.push(`${formData.hours}h`);
    if (formData.minutes > 0) parts.push(`${formData.minutes}m`);
    if (formData.seconds > 0) parts.push(`${formData.seconds}s`);
    setTotalDuration(parts.length > 0 ? parts.join(" ") : "Lifetime");
  }, [formData.days, formData.hours, formData.minutes, formData.seconds]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.app_id) {
      newErrors.app_id = "Please select an application";
    }

    if (!formData.username || formData.username.length < 1) {
      newErrors.username = "Username is required";
    }

    if (!formData.password || formData.password.length < 1) {
      newErrors.password = "Password is required";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});
    
    try {
      const totalSeconds = formData.days * 86400 + formData.hours * 3600 + formData.minutes * 60 + formData.seconds;
      
      const response = await fetch(`${CLIENT_BACKEND_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
          email: formData.email || undefined,
          plan: formData.plan,
          app_id: formData.app_id ? Number(formData.app_id) : undefined,
          expires_in_days: totalSeconds > 0 ? undefined : formData.days || 30,
          expires_in_seconds: totalSeconds > 0 ? totalSeconds : undefined,
          hwid_lock: formData.hwid_lock,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        onSuccess?.();
        onClose();
      } else {
        setErrors({ submit: data?.message || "Failed to create user" });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || "Network error" });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedApp = apps.find(app => String(app.id) === formData.app_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Select Application */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          Select Application <span className="text-red-400">*</span>
        </label>
        
        {fetchError ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Failed to load: {fetchError}
              </p>
              <button type="button" onClick={fetchApps} className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <select
              value={formData.app_id}
              onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
              disabled={isLoadingApps}
              className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 pl-10 pr-10 py-2.5 text-sm text-white backdrop-blur-sm focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="" className="bg-zinc-900 text-zinc-500">
                {isLoadingApps ? "Loading..." : apps.length === 0 ? "No apps - Create one first" : "Select application"}
              </option>
              {apps.map((app) => (
                <option key={app.id} value={app.id} className="bg-zinc-900 text-white">
                  {app.name} {app.version ? `(v${app.version})` : ""}
                </option>
              ))}
            </select>
            {isLoadingApps && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 animate-spin" />}
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
        {selectedApp && <p className="text-xs text-zinc-500 mt-1">{selectedApp.name} • v{selectedApp.version}</p>}
        {errors.app_id && <p className="text-xs text-red-400 mt-1"><AlertCircle className="h-3 w-3 inline mr-1" />{errors.app_id}</p>}
      </div>

      {/* Username */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          Username <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input type="text" value={formData.username} onChange={(e) => { setFormData({ ...formData, username: e.target.value }); if (errors.username) setErrors(prev => ({ ...prev, username: "" })); }}
            placeholder="Enter username"
            className={`w-full rounded-xl border bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all ${errors.username ? "border-red-500/50" : "border-zinc-700/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"}`}
          />
        </div>
        {errors.username && <p className="text-xs text-red-400 mt-1"><AlertCircle className="h-3 w-3 inline mr-1" />{errors.username}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => { setFormData({ ...formData, password: e.target.value }); if (errors.password) setErrors(prev => ({ ...prev, password: "" })); }}
            placeholder="Enter password"
            className={`w-full rounded-xl border bg-zinc-800/50 pl-10 pr-12 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all ${errors.password ? "border-red-500/50" : "border-zinc-700/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"}`}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-400 mt-1"><AlertCircle className="h-3 w-3 inline mr-1" />{errors.password}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          Email <span className="text-zinc-600">(Optional)</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@example.com"
            className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Plan */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Plan</label>
        <div className="grid grid-cols-4 gap-2">
          {["free", "starter", "pro", "enterprise"].map((plan) => (
            <button key={plan} type="button" onClick={() => setFormData({ ...formData, plan })}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-300 ${formData.plan === plan ? "bg-indigo-500/20 border border-indigo-500/50 text-indigo-400" : "bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:border-zinc-600"}`}
            >
              {plan === "pro" ? "Pro" : plan.charAt(0).toUpperCase() + plan.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Expiry Duration</label>
        <div className="grid grid-cols-4 gap-2">
          {["days", "hours", "minutes", "seconds"].map((unit) => (
            <div key={unit}>
              <label className="text-[10px] text-zinc-500 uppercase mb-1 block">{unit}</label>
              <input type="number" min="0"
                value={formData[unit as keyof typeof formData] as number}
                onChange={(e) => setFormData({ ...formData, [unit]: parseInt(e.target.value) || 0 })}
                className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-white text-center focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-400" />
          <span className="text-sm text-zinc-400">Total:</span>
          <span className={`px-3 py-1 rounded-lg text-sm font-bold font-mono ${totalDuration === "Lifetime" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"}`}>
            {totalDuration}
          </span>
        </div>
        <p className="text-xs text-zinc-500 mt-1"><Info className="h-3 w-3 inline mr-1" />Set all to 0 for lifetime access</p>
      </div>

      {/* HWID Lock */}
      <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-700/50 bg-zinc-800/30 cursor-pointer hover:border-indigo-500/30 transition-all">
        <input type="checkbox" checked={formData.hwid_lock} onChange={(e) => setFormData({ ...formData, hwid_lock: e.target.checked })}
          className="rounded border-zinc-600 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/20" />
        <span className="text-sm text-zinc-300">Enable HWID Lock</span>
      </label>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-300">User will be created with active status and can login immediately</p>
      </div>

      {errors.submit && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{errors.submit}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 transition-all">Cancel</button>
        <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all disabled:opacity-50">
          {isLoading ? "Creating..." : "Create User"}
        </Button>
      </div>
    </form>
  );
}