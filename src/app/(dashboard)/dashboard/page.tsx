import { redirect } from "next/navigation";
import { getUserDashboardData } from "@/lib/actions";
import { Button } from "@/components/ui/button"; // Ensure you have this or use standard html button
import { Eye, Copy, Zap, TrendingUp, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  // Fetch data on the server
  const userData = await getUserDashboardData();

  // Security guard
  if (!userData) {
    redirect("/"); 
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-neutral-400">Welcome back, {userData.email}</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
          + Buy Credits
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Credits Card */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-neutral-400 font-medium">Credits Remaining</h3>
            <Zap className="text-yellow-500" size={20} />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {userData.credits}
          </div>
          <p className="text-sm text-neutral-500">
            {userData.credits > 0 ? "Ready to upscale" : "Top up to continue"}
          </p>
        </div>

        {/* Usage Card (Placeholder logic for now) */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-neutral-400 font-medium">API Health</h3>
            <TrendingUp className="text-green-500" size={20} />
          </div>
          <div className="text-3xl font-bold text-white mb-1">Active</div>
          <div className="text-sm text-green-500 mt-1">
             All systems operational
          </div>
        </div>
      </div>

      {/* API Key Section */}
      <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/30">
        <h3 className="text-lg font-bold mb-4">Production API Key</h3>
        
        <div className="flex items-center gap-4 bg-black/50 p-4 rounded-lg border border-neutral-800">
          {/* We use a secure Client Component wrapper for the copy/reveal logic typically, 
              but for this MVP we render the key blurred by CSS or handling it in a client island.
              For now, let's just display it. */}
          <code className="flex-1 font-mono text-indigo-400 break-all">
            {userData.apiKey}
          </code>
          {/* Note: To make Copy/Eye buttons interactive, we need to extract this 
              specific <div> into a Client Component like <ApiKeyViewer key={key} /> */}
        </div>
        
        <div className="mt-4 flex items-center gap-2 text-amber-500 text-sm">
           <AlertTriangle size={16} />
           <span>Keep this key secret. Never expose it in frontend code.</span>
        </div>
      </div>
    </div>
  );
}