import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; 

// 🔴 CRITICAL FIX: Prevent Vercel from caching this response
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const snapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("generations")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Handle timestamp conversion safely
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : new Date().toISOString(), 
    }));

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("History Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}