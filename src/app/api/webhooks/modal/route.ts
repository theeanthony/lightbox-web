import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    // 1. Security Check
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.MODAL_WEBHOOK_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { jobId, userId, status, resultUrl, error, meta, progress } = body;

    if (!jobId || !userId) {
      return new NextResponse("Missing Data", { status: 400 });
    }

    const jobRef = adminDb.collection("users").doc(userId).collection("generations").doc(jobId);
    const userRef = adminDb.collection("users").doc(userId);

    // 2. PROCESSING: Update progress bar
    if (status === "processing") {
      await jobRef.update({
        status: "processing",
        progress: progress || 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return new NextResponse("Ack", { status: 200 });
    }

    // 3. SUCCESS: Mark done (🟢 CHANGED: DO NOT CHARGE HERE)
    // The user was already charged in the API route.
    if (status === "success") {
      await jobRef.update({
        status: "done",
        progress: 100,
        resultUrl: resultUrl,
        resultDims: meta || null,
        completedAt: FieldValue.serverTimestamp(),
      });
      return new NextResponse("Ack", { status: 200 });
    }

    // 4. ERROR: Refund the user (🟢 CHANGED: ADD REFUND)
    // Since we charged them to start, we must pay them back if it fails.
    if (status === "error" || status === "failed") {
        await adminDb.runTransaction(async (t) => {
          // 1. Read the Job Doc to find out how much it cost
          const jobDoc = await t.get(jobRef);
          const paidAmount = jobDoc.data()?.cost || 1; // Fallback to 1 if missing
  
          // 2. Refund that exact amount
          t.update(userRef, { 
            credits: FieldValue.increment(paidAmount) 
          });
  
          t.update(jobRef, {
            status: "error",
            error: error || "Processing failed",
          });
        });
        return new NextResponse("Ack", { status: 200 });
      }

    return new NextResponse("Ack", { status: 200 });

  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return new NextResponse("Internal Error", { status: 500 });
  }
}