import { redirect } from "next/navigation";
import { getUserDashboardData } from "@/lib/actions";
import { UsageChart } from "@/components/UsageChart";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

// ⚠️ MAKE SURE "export default" IS HERE
export default async function UsagePage() {
  const userData = await getUserDashboardData();
  if (!userData) redirect("/");

  const totalLimit = 100;
  const percentage = Math.min((userData.credits / totalLimit) * 100, 100);

  return (
    <div className="space-y-12 fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">Usage</h1>
        <p className="text-muted-foreground max-w-3xl">
          View your credit consumption and activity logs.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
            <span className="text-xl font-semibold text-foreground">February 2026</span>
            <div className="ml-auto bg-muted p-1 rounded-lg flex text-xs font-semibold">
                <button className="px-3 py-1.5 bg-background shadow-sm rounded-md text-foreground">DAILY</button>
            </div>
        </div>
        
        <div>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-foreground">Daily usage</span>
                <Info size={14} className="text-muted-foreground" />
            </div>
            {/* Ensure this component exists in src/components/UsageChart.tsx */}
            <UsageChart />
        </div>
      </div>
    </div>
  );
}