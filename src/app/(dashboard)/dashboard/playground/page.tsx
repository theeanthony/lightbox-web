import Playground from "@/components/Playground";
import { getUserDashboardData } from "@/lib/actions"; 
import { redirect } from "next/navigation";

// 🟢 ADD THIS: Forces the page to never cache
export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const userData = await getUserDashboardData();
  
  if (!userData) {
    redirect("/");
  }

  // Pass the credits down to the client component
  return <Playground initialCredits={userData.credits} />;
}