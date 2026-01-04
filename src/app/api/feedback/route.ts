import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { jobId, vote } = await req.json(); // vote: 'like' | 'dislike' | null

    if (!jobId) return new NextResponse("Job ID required", { status: 400 });

    const jobRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("generations")
      .doc(jobId);

    // 1. Update the individual job
    await jobRef.update({
      feedback: vote,
      feedbackAt: FieldValue.serverTimestamp()
    });

    // 2. (Optional) Update Global Stats - purely for analytics
    // You could increment a counter on a stats document here
    // e.g., adminDb.collection("stats").doc("global").update({ [`votes.${vote}`]: FieldValue.increment(1) });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Feedback Error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}