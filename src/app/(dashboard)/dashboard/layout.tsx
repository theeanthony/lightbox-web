import { ReactNode } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { HelpCircle } from "lucide-react";
import { DashboardNav } from "@/components/DashboardNav"; // <-- Import the new component

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground hidden md:flex flex-col">
        <div className="py-6">
             {/* We simply drop in the smart navigation here */}
            <DashboardNav />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-background">
        <header className="h-16 border-b border-border flex items-center justify-end px-8 bg-background">
            <div className="flex items-center gap-6">
                <Link href="#" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle size={18} />
                    <span>Help</span>
                </Link>
                <div className="flex items-center gap-3 pl-6 border-l border-border">
                    <span className="text-sm font-medium text-foreground">Personal</span>
                    <UserButton afterSignOutUrl="/"/>
                </div>
            </div>
        </header>

        <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}