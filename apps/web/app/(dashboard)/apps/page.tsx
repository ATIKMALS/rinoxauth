import { Card } from "@/components/ui/card";
import { env } from "@/lib/config";
import { Layers, ExternalLink, Trash2, Users, Activity } from "lucide-react";
import { AppsClientWrapper } from "./client-wrapper";
import { revalidatePath } from "next/cache";
import { CredentialsButton } from "./credentials-button";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function getApps(createdBy?: string) {
  try {
    const query = createdBy ? `?created_by=${encodeURIComponent(createdBy)}` : "";
    const res = await fetch(`${env.BACKEND_BASE_URL}/api/apps${query}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || (Array.isArray(data) ? data : []);
  } catch {
    return [];
  }
}

export default async function AppsPage() {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.username;
  const apps = await getApps(currentUser);
  const activeApps = apps.filter((a: any) => a.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-indigo-400" />
            </div>
            📱 Your Applications
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Create and manage your application credentials</p>
        </div>
        <AppsClientWrapper apps={apps} currentUser={currentUser} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl" />
          <p className="text-xs text-zinc-400 uppercase tracking-wider relative">Total Apps</p>
          <p className="text-2xl font-bold text-white mt-1 relative">{apps.length}</p>
        </Card>
        <Card className="p-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl" />
          <p className="text-xs text-zinc-400 uppercase tracking-wider relative">Active Apps</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 relative">{activeApps}</p>
        </Card>
        <Card className="p-4 relative overflow-hidden group hover:scale-[1.02] transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full blur-xl" />
          <p className="text-xs text-zinc-400 uppercase tracking-wider relative">Total Users</p>
          <p className="text-2xl font-bold text-violet-400 mt-1 relative">
            {apps.reduce((sum: number, a: any) => sum + (a.users || 0), 0)}
          </p>
        </Card>
      </div>

      {/* Applications Table */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-zinc-800/50">
          <p className="text-sm text-zinc-400 flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-400" />
            {apps.length} application{apps.length !== 1 ? "s" : ""} configured
          </p>
        </div>

        {apps.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
              <Layers className="h-10 w-10 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-white">No Applications Yet</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto mt-1">
              Create your first application to get started with user management and license validation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">App Name</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">App ID</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Users</th>
                  <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Version</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-zinc-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {apps.map((app: any, index: number) => (
                  <tr key={app.id || index} className="group border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-all duration-300">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform duration-300">
                          {app.name?.[0]?.toUpperCase() || "A"}
                        </div>
                        <p className="font-medium text-white group-hover:text-indigo-300 transition-colors duration-300">
                          {app.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-zinc-400 font-mono">{app.id || "N/A"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm text-zinc-300">{app.users || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-500/10 text-zinc-400 text-xs font-mono border border-zinc-500/20">
                        v{app.version}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <CredentialsButton appId={app.id} />
                        
                        <a 
                          href={env.BACKEND_BASE_URL} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all duration-300 hover:scale-110 border border-emerald-500/20" 
                          title="Client Portal"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        
                        <form action={async (formData: FormData) => {
                          "use server";
                          const appId = String(formData.get("app_id") ?? "");
                          await fetch(`${env.BACKEND_BASE_URL}/api/admin/apps/${appId}`, { method: "DELETE" });
                          revalidatePath("/apps");
                        }}>
                          <input type="hidden" name="app_id" value={app.id} />
                          <button type="submit" className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all duration-300 hover:scale-110 border border-red-500/20" title="Delete">
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