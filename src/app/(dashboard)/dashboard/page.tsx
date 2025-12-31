import { redirect } from "next/navigation";
import { getUserDashboardData } from "@/lib/actions";
import { Zap, Activity, CreditCard } from "lucide-react";
import Link from "next/link";
import { BuyButton } from "@/components/BuyButton"; // <--- 1. Import it

export default async function OverviewPage() {
  const userData = await getUserDashboardData();
  if (!userData) redirect("/");

  return (
    <div className="space-y-8">
      
      {/* 2. Update this Header Section to include the button */}
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Overview</h1>
            <p className="text-muted-foreground">
                Welcome back. You are on the <span className="font-medium text-foreground">Free Plan</span>.
            </p>
        </div>
        {/* The Button goes here */}
        <BuyButton />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Credits Available" value={userData.credits} icon={<Zap />} href="/dashboard/usage" />
        <Card title="API Status" value="Operational" icon={<Activity />} href="https://status.lightboxlabs.org" external />
        <Card title="Current Spend" value="$0.00" icon={<CreditCard />} href="/dashboard/billing" />
      </div>

      {/* Quick Start Guide */}
      <div className="rounded-lg border border-border p-6 bg-card">
        <h3 className="font-semibold mb-4 text-foreground">Quick Start</h3>
        <div className="bg-muted p-4 rounded-md font-mono text-sm overflow-x-auto text-muted-foreground">
            curl -X POST https://api.lightboxlabs.org/v1/upscale \<br/>
            &nbsp;&nbsp;-H "Authorization: Bearer {userData.apiKey}" \<br/>
            &nbsp;&nbsp;-d '{"{"}"image": "https://..."{"}"}'
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, icon, href, external }: any) {
    return (
        <Link href={href} target={external ? "_blank" : undefined} className="block group">
            <div className="p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{value}</div>
            </div>
        </Link>
    )
}