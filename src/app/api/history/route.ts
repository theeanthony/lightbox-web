import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getAuthenticatedUser } from "@/lib/apiAuth"; // 🟢 Use unified auth helper

// 🔴 CRITICAL FIX: Prevent Vercel from caching this response
export const dynamic = 'force-dynamic';

// 1. GET: Fetch User History
export async function GET(req: Request) {
  try {
    // 🟢 UPDATED: Supports both Browser Session AND API Key
    const userId = await getAuthenticatedUser(req);
    
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const snapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("generations")
      .orderBy("createdAt", "desc")
      .limit(50) // 🟢 Increased limit to 50 for better visibility
      .get();

    const jobs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Handle timestamp conversion safely
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(), 
      };
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("History GET Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// 2. DELETE: Remove a specific job
export async function DELETE(req: Request) {
  try {
    const userId = await getAuthenticatedUser(req);
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Missing Job ID", { status: 400 });
    }

    // 🟢 PERMANENT DELETION: Remove the document from Firestore
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("generations")
      .doc(id)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("History DELETE Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}