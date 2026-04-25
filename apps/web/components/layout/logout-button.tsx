"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const onLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <button
      onClick={onLogout}
      className="relative inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition-all duration-300 hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-200 hover:shadow-lg hover:shadow-rose-500/10 group overflow-hidden"
    >
      {/* Hover shine effect */}
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      <LogOut className="h-4 w-4 relative z-10 group-hover:translate-x-0.5 transition-transform duration-300" />
      <span className="relative z-10 hidden sm:inline">Logout</span>
    </button>
  );
}