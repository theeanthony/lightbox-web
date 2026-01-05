import { getUserDashboardData } from "@/lib/actions";
import { redirect } from "next/navigation";
import { CreditCard, Check, Zap, Receipt, ShieldCheck } from "lucide-react";
import { BuyButton } from "@/components/BuyButton";

export default async function BillingPage() {
  const userData = await getUserDashboardData();
  if (!userData) redirect("/");

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Billing & Credits</h1>
          <p className="text-muted-foreground mt-1">
            Manage your credit balance and payment history.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 2. MAIN WALLET CARD (The "Bank Account") */}
        <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Available Balance</h2>
                        <div className="text-5xl font-bold text-foreground tabular-nums">
                            {userData.credits.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">Credits</span>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                           <ShieldCheck className="w-4 h-4 text-green-500" /> Never expire as long as account is active.
                        </p>
                    </div>
                    <div className="flex-shrink-0">
                        {/* 🟢 Reusing your Buy Button here */}
                        <BuyButton />
                    </div>
                </div>
                
                {/* Visual Progress Bar context */}
                <div className="bg-muted/50 px-6 py-4 border-t border-border flex items-center gap-4 text-sm">
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[20%]" /> {/* Mock visual */}
                    </div>
                    <span className="text-muted-foreground">Safe Zone</span>
                </div>
            </div>

            {/* 3. INVOICE HISTORY */}
            <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-muted-foreground" /> 
                    Transaction History
                </h3>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-6 py-3 font-medium">Date</th>
                                <th className="px-6 py-3 font-medium">Description</th>
                                <th className="px-6 py-3 font-medium">Amount</th>
                                <th className="px-6 py-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {/* 🟢 MOCK DATA - Stripe Webhook doesn't save history to your DB yet */}
                            <tr className="group hover:bg-muted/20 transition-colors">
                                <td className="px-6 py-4 text-muted-foreground">Jan 4, 2026</td>
                                <td className="px-6 py-4 font-medium text-foreground">500 Credits Top-up</td>
                                <td className="px-6 py-4 text-muted-foreground">$10.00</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Paid
                                    </span>
                                </td>
                            </tr>
                            {/* Empty State visual */}
                            {userData.credits === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        No transactions yet. Start by topping up!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* 4. CURRENT PLAN (Side Panel) */}
        <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">Current Plan</h3>
                    <span className="px-2 py-1 bg-muted rounded-md text-xs font-medium text-muted-foreground">Free Tier</span>
                </div>
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary" /> <span>Standard Speed</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary" /> <span>Concurrent Jobs: 4</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                         <Check className="w-4 h-4 text-primary" /> <span>4K Max Resolution</span>
                    </div>
                </div>
                <button disabled className="w-full py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground bg-muted/20 cursor-not-allowed">
                    Current Plan
                </button>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                <div className="flex items-center gap-2 mb-2 text-primary">
                    <Zap className="w-5 h-5 fill-current" />
                    <h3 className="font-bold">Upgrade to Pro</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Get access to the VIP GPU lane, 8K upscaling, and priority support.
                </p>
                <button className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                    Upgrade ($29/mo)
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}