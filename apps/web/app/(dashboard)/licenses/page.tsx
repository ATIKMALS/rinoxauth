import { Card } from "@/components/ui/card";
import { env } from "@/lib/config";
import { revalidatePath } from "next/cache";
import { 
  Key, Activity, Trash2, RefreshCw, Ban, Play, Info, Search
} from "lucide-react";
import { LicensesClientWrapper } from "./client-wrapper";
import { CopyButton } from "./copy-button";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getApps(createdBy?: string) {
  try {
    const query = createdBy ? `?created_by=${encodeURIComponent(createdBy)}` : "";
    const res = await fetch(`${env.BACKEND_BASE_URL}/api/apps${query}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch { return []; }
}

async function getLicenses() {
  try {
    const res = await fetch(`${env.BACKEND_BASE_URL}/api/licenses`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || (Array.isArray(data) ? data : []);
  } catch { return []; }
}

export default async function LicensesPage() {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.username;
  const [licenses, apps] = await Promise.all([getLicenses(), getApps(currentUser)]);
  const activeLicenses = licenses.filter((l: any) => l.status === "active").length;
  const expiredLicenses = licenses.filter((l: any) => l.status === "expired" || (l.expires_at && new Date(l.expires_at) < new Date())).length;
  const revokedLicenses = licenses.filter((l: any) => l.status === "revoked").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-indigo-400" />
            </div>
            License Keys
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Generate and manage license keys for your applications</p>
        </div>
        <LicensesClientWrapper licenses={licenses} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Licenses", value: licenses.length, color: "indigo" },
          { label: "Active Licenses", value: activeLicenses, color: "emerald" },
          { label: "Expired", value: expiredLicenses, color: "rose" },
          { label: "Revoked", value: revokedLicenses, color: "amber" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-500/10 rounded-full blur-xl`} />
            <p className="text-xs text-zinc-400 uppercase tracking-wider relative">{stat.label}</p>
            <p className={`text-2xl font-bold text-${stat.color === "indigo" ? "white" : stat.color + "-400"} mt-1 relative`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input 
              placeholder="Search licenses by key or note..." 
              className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all" 
            />
          </div>
          <div className="flex gap-2">
            <select className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 cursor-pointer">
              <option value="">All Applications</option>
              {apps.map((app: any) => (
                <option key={app.id} value={app.id}>{app.name}</option>
              ))}
            </select>
            <select className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 cursor-pointer">
              <option>All Status</option>
              <option>Active</option>
              <option>Expired</option>
              <option>Revoked</option>
            </select>
            <select className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 cursor-pointer">
              <option>All Plans</option>
              {[...new Set(licenses.map((l: any) => l.plan).filter(Boolean))].map((plan: any) => (
                <option key={plan} value={plan}>{plan}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-zinc-800/50">
          <p className="text-sm text-zinc-400 flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-400" />
            {licenses.length} license{licenses.length !== 1 ? "s" : ""} found
          </p>
        </div>

        {licenses.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
              <Key className="h-10 w-10 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-white">No licenses generated yet</h3>
            <p className="text-sm text-zinc-400 mt-1">Click &quot;Generate License&quot; to create one!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">License Key</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Application</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Plan</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">HWID</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Devices</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Expires</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Status</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-zinc-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {licenses.map((license: any, index: number) => (
                  <tr key={license.id || index} className="group border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-all duration-300">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white">{license.key}</span>
                        <CopyButton text={license.key} />
                      </div>
                      {license.note && <p className="text-xs text-zinc-500 mt-0.5">{license.note}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-zinc-400">{license.application_name || "Unknown"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-500/10 text-zinc-400 text-xs font-semibold uppercase border border-zinc-500/20">{license.plan}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-zinc-400 font-mono">{license.hwid_lock ? "🔒 Locked" : "🌍 Open"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-zinc-300">{license.device_limit || 1}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm ${license.is_lifetime || license.expires_at === "Never" ? "text-amber-400 font-medium" : "text-zinc-400"}`}>
                        {license.is_lifetime || license.expires_at === "Never" ? "Lifetime" : license.expires_at?.slice(0, 10) || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                        license.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        license.status === "expired" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                        "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${license.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                        {license.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <form action={async (formData: FormData) => {
                          "use server";
                          await fetch(`${env.BACKEND_BASE_URL}/api/admin/licenses/${formData.get("license_id")}/reset-hwid`, { method: "POST" });
                          revalidatePath("/licenses");
                        }}>
                          <input type="hidden" name="license_id" value={license.id} />
                          <button type="submit" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all duration-300 hover:scale-110" title="Reset HWID">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </form>
                        <form action={async (formData: FormData) => {
                          "use server";
                          await fetch(`${env.BACKEND_BASE_URL}/api/admin/licenses/${formData.get("license_id")}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: String(formData.get("action")) }),
                          });
                          revalidatePath("/licenses");
                        }}>
                          <input type="hidden" name="license_id" value={license.id} />
                          <input type="hidden" name="action" value={license.status === "revoked" ? "active" : "revoked"} />
                          <button type="submit" className={`p-2 rounded-lg bg-zinc-800 transition-all duration-300 hover:scale-110 ${
                            license.status === "revoked" ? "hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400" : "hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                          }`}>
                            {license.status === "revoked" ? <Play className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                        </form>
                        <form action={async (formData: FormData) => {
                          "use server";
                          await fetch(`${env.BACKEND_BASE_URL}/api/admin/licenses/${formData.get("license_id")}`, { method: "DELETE" });
                          revalidatePath("/licenses");
                        }}>
                          <input type="hidden" name="license_id" value={license.id} />
                          <button type="submit" className="p-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all duration-300 hover:scale-110" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}