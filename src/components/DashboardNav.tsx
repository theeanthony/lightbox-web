"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Home, Settings, Zap, FlaskConical } from "lucide-react"; // <--- 1. Import Icon

const items = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Playground", // <--- 2. Add this new item
    href: "/dashboard/playground",
    icon: FlaskConical,
  },
  {
    title: "Usage",
    href: "/dashboard/usage",
    icon: Zap,
  },
  {
    title: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
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
    </nav>
  );
}