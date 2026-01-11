import PlaygroundTest from "@/components/PlaygroundTest";
import { getUserDashboardData } from "@/lib/actions";
import { redirect } from "next/navigation";

// 🔒 Force dynamic rendering (no caching) - required for auth
export const dynamic = "force-dynamic";

// Full-screen Pantheon Playground with Authentication
export default async function PlaygroundPage() {
  // 🔒 SECURITY: Verify user is authenticated via Clerk
  const userData = await getUserDashboardData();

  // Redirect to home if not logged in
  if (!userData) {
    redirect("/");
  }

  // Pass real credits from Firestore to the client component
  return <PlaygroundTest initialCredits={userData.credits} />;
}
