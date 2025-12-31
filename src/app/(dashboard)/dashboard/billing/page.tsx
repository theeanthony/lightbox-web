import { CreditCard, Download } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">Billing</h1>
        <p className="text-muted-foreground">
          Manage your subscription and payment methods.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-8 text-center py-16">
        <div className="flex justify-center mb-4">
            <div className="p-3 bg-muted rounded-full">
                <CreditCard size={24} className="text-muted-foreground" />
            </div>
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No active subscription</h3>
        <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            You are currently on the Free Tier. Upgrade to a paid plan to unlock higher limits and faster processing.
        </p>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:opacity-90 transition-opacity">
            Add Payment Method
        </button>
      </div>

      <div>
        <h3 className="text-lg font-bold text-foreground mb-4">Invoices</h3>
        <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border text-sm text-muted-foreground">
                No invoices found
            </div>
        </div>
      </div>
    </div>
  );
}