"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, Settings, Zap, FlaskConical, Key, Sparkles } from "lucide-react";

const items = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Playground",
    href: "/dashboard/playground",
    icon: FlaskConical,
  },
  // {
  //   title: "Usage",
  //   href: "/dashboard/usage",
  //   icon: Zap,
  // },
  {
    title: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    title: "API Keys",
    href: "/dashboard/keys",
    icon: Key, 
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function DashboardNav() {
  const path = usePathname();

  return (
    <nav className="grid items-start gap-2">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <Link
            key={index}
            href={item.href}
            className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground ${
              path === item.href ? "bg-accent text-accent-foreground" : "transparent"
            }`}
          >
            <Icon className="mr-2 h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        );
      })}

      {/* 🏛️ Pantheon Full-Screen Playground */}
      <div className="mt-4 pt-4 border-t border-border">
        <Link
          href="/playground"
          className="group flex items-center rounded-md px-3 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 transition-all shadow-sm hover:shadow-md"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          <span>Pantheon Studio</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1 px-3">
          Full-screen enhancement workspace
        </p>
      </div>
    </nav>
  );
}