import { User, Mail } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-4">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and notifications.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {/* Profile Section */}
        <div className="p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Profile</h3>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Full Name</label>
                    <div className="relative">
                        <User size={16} className="absolute left-3 top-3 text-muted-foreground" />
                        <input type="text" className="w-full bg-background border border-input pl-9 pr-3 py-2 rounded-md text-sm text-foreground focus:ring-1 focus:ring-ring" placeholder="Your Name" />
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Email Address</label>
                    <div className="relative">
                        <Mail size={16} className="absolute left-3 top-3 text-muted-foreground" />
                        <input type="email" className="w-full bg-background border border-input pl-9 pr-3 py-2 rounded-md text-sm text-foreground focus:ring-1 focus:ring-ring" placeholder="email@example.com" disabled />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Managed by Clerk Authentication</p>
                </div>
            </div>
        </div>
        
        {/* Save Button */}
        <div className="p-4 bg-muted/30 flex justify-end">
             <button className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90">
                Save Changes
             </button>
        </div>
      </div>
    </div>
  );
}