import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    // 1. Security Check
    const authHeader = req.headers.get("Authorization");
    
    console.log("📥 Webhook received");
    console.log("🔑 Auth header:", authHeader ? "Present" : "Missing");
    
    if (authHeader !== `Bearer ${process.env.MODAL_WEBHOOK_SECRET}`) {
      console.error("❌ Invalid webhook secret");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    console.log("📦 Webhook payload:", JSON.stringify(body, null, 2));
    
    const { jobId, userId, status, resultUrl, error, meta, progress } = body;

    if (!jobId || !userId) {
      console.error("❌ Missing jobId or userId in payload");
      return new NextResponse("Missing Data", { status: 400 });
    }

    console.log(`🔄 Processing webhook for job ${jobId}, status: ${status}`);

    const jobRef = adminDb.collection("users").doc(userId).collection("generations").doc(jobId);
    const userRef = adminDb.collection("users").doc(userId);

    // 🟢 CRITICAL: Verify job exists before updating
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      console.error(`❌ Job ${jobId} does not exist in Firestore for user ${userId}`);
      return new NextResponse("Job Not Found", { status: 404 });
    }

    const existingData = jobDoc.data();
    console.log(`📋 Existing job status: ${existingData?.status}`);

    // 2. PROCESSING: Update progress bar
    if (status === "processing") {
      console.log(`⏳ Updating progress to ${progress}%`);
      
      await jobRef.update({
        status: "processing",
        progress: progress || 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Progress updated successfully (${Date.now() - startTime}ms)`);
      return new NextResponse("Ack", { status: 200 });
    }

    // 3. SUCCESS: Mark done
    if (status === "success") {
      if (!resultUrl) {
        console.error("❌ Success webhook missing resultUrl");
        return new NextResponse("Missing resultUrl", { status: 400 });
      }

      console.log(`✅ Marking job as done with resultUrl: ${resultUrl}`);
      
      await jobRef.update({
        status: "done",
        progress: 100,
        resultUrl: resultUrl,
        resultDims: meta || null,
        completedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Job marked as done successfully (${Date.now() - startTime}ms)`);
      return new NextResponse("Ack", { status: 200 });
    }

    // 4. ERROR/FAILED: Refund the user
    if (status === "failed" || status === "error") {
      console.log(`❌ Job failed, initiating refund...`);
      
      try {
        await adminDb.runTransaction(async (t) => {
          // Read the job doc to find the cost
          const jobSnapshot = await t.get(jobRef);
          const paidAmount = jobSnapshot.data()?.cost || 1;
          
          console.log(`💰 Refunding ${paidAmount} credits to user ${userId}`);
          
          // Refund credits
          t.update(userRef, { 
            credits: FieldValue.increment(paidAmount) 
          });
  
          // Mark job as failed
          t.update(jobRef, {
            status: "error",
            error: error || "Processing failed",
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        
        console.log(`✅ Refund completed successfully (${Date.now() - startTime}ms)`);
        return new NextResponse("Ack", { status: 200 });
        
      } catch (txError: any) {
        console.error("❌ Transaction failed during refund:", txError);
        throw txError;
      }
    }

    // 5. Unknown status
    console.warn(`⚠️ Unknown status received: ${status}`);
    return new NextResponse("Ack", { status: 200 });

  } catch (error: any) {
    console.error("❌ Webhook Error:", error.message);
    console.error("📚 Stack trace:", error.stack);
    return new NextResponse("Internal Error", { status: 500 });
  }
}