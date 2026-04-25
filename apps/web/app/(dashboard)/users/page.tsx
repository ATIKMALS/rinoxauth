import { Card } from "@/components/ui/card";
import { env } from "@/lib/config";
import { revalidatePath } from "next/cache";
import { 
  Users as UsersIcon, 
  UserCheck, 
  UserX, 
  Activity,
  Search,
  RefreshCw,
  Trash2,
  Edit,
  TrendingUp,
  TrendingDown,
  Ban,
  Play
} from "lucide-react";
import { UsersClientWrapper } from "./client-wrapper";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ============================================
// ANIMATED STAT CARD COMPONENT
// ============================================
function StatCard({ 
  title, value, subValue, icon: Icon, color, trend, change 
}: { 
  title: string; value: string; subValue?: string; icon: any; color: string;
  trend?: "up" | "down"; change?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
  return (
    <Card className="relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/10">
      <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-${color}-500/10 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-700`} />
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 flex items-center justify-center group-hover:bg-${color}-500/20 transition-all duration-300 group-hover:scale-110`}>
            <Icon className={`h-5 w-5 text-${color}-400`} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend === "up" ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
              <TrendIcon className="h-3 w-3" />{change}
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300">{value}</p>
        {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
      </div>
    </Card>
  );
}

// ============================================
// DATA FETCHING
// ============================================
async function getApps(createdBy?: string) {
  try {
    const query = createdBy ? `?created_by=${encodeURIComponent(createdBy)}` : "";
    const res = await fetch(`${env.BACKEND_BASE_URL}/api/apps${query}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch { return []; }
}

async function getUsers() {
  try {
    const res = await fetch(`${env.BACKEND_BASE_URL}/api/users`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || (Array.isArray(data) ? data : []);
  } catch { return []; }
}

// ============================================
// MAIN PAGE
// ============================================
export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const currentUser = session?.user?.username;
  const [users, apps] = await Promise.all([getUsers(), getApps(currentUser)]);
  const activeUsers = users.filter((u: any) => u.status === "active").length;
  const expiredUsers = users.filter((u: any) => new Date(u.expires_at) < new Date()).length;
  const retentionRate = users.length ? Math.round((activeUsers / users.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <UsersIcon className="h-5 w-5 text-indigo-400" />
            </div>
            Users Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Manage and monitor your application users</p>
        </div>
        <UsersClientWrapper users={users} apps={apps} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={users.length.toString()} subValue="All registered users" icon={UsersIcon} color="indigo" trend="up" change="12%" />
        <StatCard title="Active Users" value={activeUsers.toString()} subValue={`${retentionRate}% retention rate`} icon={UserCheck} color="emerald" trend="up" change="8%" />
        <StatCard title="Expired" value={expiredUsers.toString()} subValue="Require renewal" icon={UserX} color="rose" trend="down" change="3%" />
        <StatCard title="Activity Rate" value={`${retentionRate}%`} subValue="Last 30 days" icon={Activity} color="amber" />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input placeholder="Search users by name or email..." className="w-full rounded-xl border border-zinc-700/50 bg-zinc-800/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all" />
          </div>
          <div className="flex gap-2">
            <select className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 cursor-pointer">
              <option value="">All Applications</option>
              {apps.map((app: any) => <option key={app.id} value={app.id}>{app.name}</option>)}
            </select>
            <select className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 cursor-pointer">
              <option>All Plans</option>
              <option>Free</option><option>Starter</option><option>Professional</option><option>Enterprise</option>
            </select>
            <select className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-300 cursor-pointer">
              <option>All Status</option>
              <option>Active</option><option>Inactive</option><option>Banned</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/50 bg-zinc-900/50">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">User</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Application</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Plan</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Devices</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Expires</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-zinc-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
                        <UsersIcon className="h-8 w-8 text-zinc-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-zinc-400">No Users Found</h3>
                      <p className="text-sm text-zinc-500 max-w-md">Create your first user to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user: any, index: number) => (
                  <tr key={user.id || index} className="group border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-all duration-300">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform duration-300 ${user.status === "active" ? "from-indigo-500 to-violet-500" : "from-zinc-600 to-zinc-500"}`}>
                          {user.username?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-indigo-300 transition-colors duration-300">{user.username}</p>
                          <p className="text-xs text-zinc-500">{user.email || "No email"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><span className="text-sm text-zinc-400">{user.application_name || "Unknown"}</span></td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase border ${user.plan === "enterprise" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : user.plan === "professional" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>{user.plan}</span>
                    </td>
                    <td className="px-4 py-4"><span className="text-sm text-zinc-400 font-mono">{user.hwid ? "1/1" : "0/1"}</span></td>
                    <td className="px-4 py-4"><span className="text-sm text-zinc-400">{user.expires_at?.slice(0, 10) || "N/A"}</span></td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${user.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : user.status === "banned" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />{user.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <form action={async (formData: FormData) => {
                          "use server";
                          const uid = Number(formData.get("user_id"));
                          await fetch(`${env.BACKEND_BASE_URL}/api/admin/users/${uid}/reset-hwid`, { method: "POST" });
                          revalidatePath("/users");
                        }}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button type="submit" className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all duration-300 hover:scale-110" title="Reset HWID"><RefreshCw className="h-4 w-4" /></button>
                        </form>
                        <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-indigo-400 transition-all duration-300 hover:scale-110" title="Edit User"><Edit className="h-4 w-4" /></button>
                        <form action={async (formData: FormData) => {
                          "use server";
                          const uid = Number(formData.get("user_id"));
                          const action = String(formData.get("action"));
                          await fetch(`${env.BACKEND_BASE_URL}/api/admin/users/${uid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action }) });
                          revalidatePath("/users");
                        }}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <input type="hidden" name="action" value={user.status === "banned" ? "active" : "banned"} />
                          <button type="submit" className={`p-2 rounded-lg bg-zinc-800 transition-all duration-300 hover:scale-110 ${user.status === "banned" ? "hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400" : "hover:bg-red-500/20 text-zinc-400 hover:text-red-400"}`} title={user.status === "banned" ? "Unban" : "Ban"}>
                            {user.status === "banned" ? <Play className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                        </form>
                        <form action={async (formData: FormData) => {
                          "use server";
                          const uid = Number(formData.get("user_id"));
                          await fetch(`${env.BACKEND_BASE_URL}/api/admin/users/${uid}`, { method: "DELETE" });
                          revalidatePath("/users");
                        }}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button type="submit" className="p-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all duration-300 hover:scale-110" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {users.length > 0 && (
          <div className="p-4 border-t border-zinc-800/50 flex items-center justify-between">
            <p className="text-sm text-zinc-500">Showing <span className="text-white font-medium">{users.length}</span> user{users.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </Card>
    </div>
  );
}