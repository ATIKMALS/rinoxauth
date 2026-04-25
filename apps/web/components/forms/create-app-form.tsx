"use client";

import { useState } from "react";
import { CLIENT_BACKEND_BASE_URL } from "@/lib/client-env";
import { Button } from "@/components/ui/button";
import { 
  Layers, 
  Package, 
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";

interface CreateAppFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  createdBy?: string;
}

export function CreateAppForm({ onClose, onSuccess, createdBy }: CreateAppFormProps) {
  const [formData, setFormData] = useState({
    app_name: "",
    version: "1.0.0",
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.app_name || formData.app_name.length < 2) {
      newErrors.app_name = "Application name must be at least 2 characters";
    }
    
    if (!formData.version || formData.version.length < 1) {
      newErrors.version = "Version is required";
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
      const response = await fetch(`${CLIENT_BACKEND_BASE_URL}/api/admin/apps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: formData.app_name,
          version: formData.version,
          created_by: createdBy,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        onSuccess?.();
        onClose();
      } else {
        const errorMessage = data?.message || data?.detail || "Failed to create application";
        setErrors({ submit: errorMessage });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Application Name */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          Application Name <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={formData.app_name}
            onChange={(e) => {
              setFormData({ ...formData, app_name: e.target.value });
              if (errors.app_name) setErrors(prev => ({ ...prev, app_name: "" }));
            }}
            placeholder="My Desktop App"
            className={`w-full rounded-xl border bg-zinc-800/50 pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 backdrop-blur-sm focus:outline-none transition-all ${
              errors.app_name 
                ? "border-red-500/50 focus:ring-red-500/20" 
                : "border-zinc-700/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
            }`}
            autoFocus
          />
          {formData.app_name && !errors.app_name && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
          )}
          {errors.app_name && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
          )}
        </div>
        {errors.app_name && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.app_name}
          </p>
        )}
      </div>

      {/* Version */}
      <div>
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
          Version <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={formData.version}
            onChange={(e) => {
              setFormData({ ...formData, version: e.target.value });
              if (errors.version) setErrors(prev => ({ ...prev, version: "" }));
            }}
            placeholder="1.0.0"
            className={`w-full rounded-xl border bg-zinc-800/50 pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 backdrop-blur-sm focus:outline-none transition-all ${
              errors.version 
                ? "border-red-500/50 focus:ring-red-500/20" 
                : "border-zinc-700/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
            }`}
          />
          {formData.version && !errors.version && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
          )}
          {errors.version && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
          )}
        </div>
        {errors.version && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.version}
          </p>
        )}
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{errors.submit}</p>
        </div>
      )}

      {/* Actions */}
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
              Creating...
            </span>
          ) : (
            "Create Application"
          )}
        </Button>
      </div>
    </form>
  );
}