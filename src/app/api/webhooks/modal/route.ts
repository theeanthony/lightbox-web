import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    // 1. Security (Keep existing check)
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.MODAL_WEBHOOK_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { jobId, userId, status, resultUrl, error, meta, progress } = body; // 🟢 Added 'progress'

    const docRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("generations")
      .doc(jobId);

    if (status === "success") {
      await docRef.update({
        status: "done",
        resultUrl: resultUrl,
        resultDims: meta,
        completedAt: FieldValue.serverTimestamp(),
        progress: 100 // Ensure 100% on done
      });
    } else if (status === "processing") {
      // 🟢 NEW: Handle progress updates
      await docRef.update({
        status: "processing", // Keeps it in processing state
        progress: progress || 0 // Updates the percentage bar
      });
    } else {
      await docRef.update({
        status: "error",
        error: error || "Processing failed",
      });
    }

    return new NextResponse("Ack", { status: 200 });

  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return new NextResponse("Internal Error", { status: 500 });
  }
}