import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; 
import { FieldValue } from "firebase-admin/firestore";
import { ratelimit } from "@/lib/ratelimit";
import { getAuthenticatedUser } from "@/lib/apiAuth";
// 🔧 CONFIG
const MODAL_URL = "https://theeanthony--lightbox-engine-upscale-router.modal.run";

export async function POST(req: Request) {
  try {
    // 2. 🟢 REPLACE CLERK AUTH WITH DUAL AUTH
    const userId = await getAuthenticatedUser(req);
    
    if (!userId) {
      return new NextResponse("Unauthorized: Invalid Session or API Key", { status: 401 });
    }

    // 3. Rate Limit Check (Works for both Browser & API Key users)
    const { success, limit, reset, remaining } = await ratelimit.limit(userId);
    if (!success) {
      return new NextResponse("Too Many Requests", { 
        status: 429,
        headers: { "Retry-After": reset.toString() } 
      });
    }

    // 1. Check Credits
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const credits = userSnap.data()?.credits || 0;

    if (credits < 1) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }

    // 2. Parse Inputs
    const body = await req.json();
    const { 
      imageUrl, mode = "face", scale = 2, face_blend = 0.5,
      lighting_prompt, force_subject, pro_mode,
      client_meta
    } = body;

    // 3. Create "Pending" Record
    const generationsRef = userRef.collection("generations");
    const newDoc = generationsRef.doc();
    const jobId = newDoc.id;
    
    await newDoc.set({
      id: jobId,
      userId,
      status: "processing", // UI will show spinner immediately
      originalUrl: imageUrl,
      mode,
      scale,
      createdAt: FieldValue.serverTimestamp(),
      params: { face_blend, lighting_prompt, force_subject, pro_mode },
      meta: client_meta
    });

    // 4. Calculate Creativity
    let creativity = 0.65;
    if (mode === "face") {
      creativity = 1.0 - Number(face_blend);
      creativity = Math.max(0.1, Math.min(0.9, creativity));
    }

    // 5. 🔥 FIRE & FORGET: Trigger Modal (Don't await result)
    // We pass the 'jobId' and 'webhookUrl' so Modal knows where to report back
    fetch(MODAL_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Webhook-Secret": process.env.MODAL_WEBHOOK_SECRET! 
      },
      body: JSON.stringify({
        // Standard Params
        image_url: imageUrl,
        engine: mode === "universal" ? "fidelity" : "generative",
        scale_factor: Number(scale),
        creativity,
        enhance_face: mode === "face",
        pro_mode: pro_mode || (Number(scale) >= 3),
        lighting_prompt: lighting_prompt || "studio lighting, neutral background",
        force_subject: force_subject || "",
        
        // 🟢 NEW: Async Context
        job_id: jobId,
        user_id: userId,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/modal`
      }),
    }).catch(err => console.error("Failed to trigger Modal:", err));

    // 6. Deduct Credit Immediately (Refund later if it fails)
    await userRef.update({ credits: FieldValue.increment(-1) });

    // Return the Job ID immediately
    return NextResponse.json({ 
      success: true,
      jobId: jobId,
      status: "queued"
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}