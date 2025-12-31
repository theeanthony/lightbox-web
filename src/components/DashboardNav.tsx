"use client"; // <--- This allows us to check the URL

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Key, CreditCard, BarChart3, Settings } from "lucide-react";

export function DashboardNav() {
  const pathname = usePathname();

  // Helper to check if a link is active
  const isActive = (path: string) => pathname === path;

  return (
    <div className="px-3">
        {/* Organization Section */}
        <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                Organization
            </h2>
            <nav className="space-y-1">
                <NavItem href="/dashboard" icon={<LayoutDashboard size={18} />} label="Overview" active={isActive("/dashboard")} />
                <NavItem href="/dashboard/settings" icon={<Settings size={18} />} label="Settings" active={isActive("/dashboard/settings")} />
                <NavItem href="/dashboard/usage" icon={<BarChart3 size={18} />} label="Usage" active={isActive("/dashboard/usage")} />
                <NavItem href="/dashboard/billing" icon={<CreditCard size={18} />} label="Billing" active={isActive("/dashboard/billing")} />
            </nav>
        </div>

        {/* User Section */}
        <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                User
            </h2>
            <nav className="space-y-1">
                <NavItem href="/dashboard/keys" icon={<Key size={18} />} label="API Keys" active={isActive("/dashboard/keys")} />
            </nav>
        </div>
    </div>
  );
}

// Sub-component for individual links
function NavItem({ href, icon, label, active }: any) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active 
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" 
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}