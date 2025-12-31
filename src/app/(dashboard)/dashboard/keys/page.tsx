import { redirect } from "next/navigation";
import { getUserDashboardData } from "@/lib/actions";
import { Copy, AlertTriangle, RefreshCw } from "lucide-react";

// The "export default" is critical here
export default async function KeysPage() {
  const userData = await getUserDashboardData();

  if (!userData) {
    redirect("/");
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">API Keys</h1>
        <p className="text-muted-foreground">
          Manage the keys used to authenticate your requests.
        </p>
      </div>

      {/* Warning Box */}
      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg flex gap-3 text-orange-600 dark:text-orange-400">
        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-1">Security Notice</p>
          Do not share your API key with others or expose it in client-side code (browsers, apps).
        </div>
      </div>

      {/* Key Card */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-6 border-b border-border flex justify-between items-center">
            <div>
                <h3 className="font-semibold text-foreground">Production Key</h3>
                <p className="text-sm text-muted-foreground">Standard secret key for backend usage.</p>
            </div>
            <button className="text-sm flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <RefreshCw size={14} /> Roll Key
            </button>
        </div>
        
        <div className="p-6 bg-muted/30">
            <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                    {/* Read-only input for the key */}
                    <input 
                        readOnly 
                        value={userData.apiKey}
                        className="w-full bg-background border border-input px-3 py-2 rounded-md font-mono text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" 
                    />
                </div>
                <button className="p-2.5 rounded-md border border-input bg-background hover:bg-muted text-muted-foreground transition-colors">
                    <Copy size={16} />
                </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Created on {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}