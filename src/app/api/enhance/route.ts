import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; 
import { FieldValue } from "firebase-admin/firestore";
import { ratelimit } from "@/lib/ratelimit";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { calculateCost } from "@/lib/pricing";

// 🔧 CONFIG
const MODAL_URL = "https://theeanthony--lightbox-engine-upscale-router.modal.run";

export async function POST(req: Request) {
  try {
    // 1. AUTHENTICATION (Dual Auth: Clerk + API Key)
    const userId = await getAuthenticatedUser(req);
    
    if (!userId) {
      return new NextResponse("Unauthorized: Invalid Session or API Key", { status: 401 });
    }

    // 2. RATE LIMIT CHECK
    const { success, reset } = await ratelimit.limit(userId);
    if (!success) {
      return new NextResponse("Too Many Requests", { 
        status: 429,
        headers: { "Retry-After": reset.toString() } 
      });
    }

    // 3. PARSE INPUTS (New Unified Schema)
    const body = await req.json();
    const { 
      imageUrl, 
      task = "upscale",
      variant = "standard",
      engine = "generative",
      scale = 2,
      strength = 0.5,
      enhance_face = true,
      creativity = 0.65,
      lighting_prompt = "", 
      force_subject = "", 
      uncrop_expansion = [0,0,0,0],
      pro_mode = false,
      created_at = Date.now() / 1000,
      client_meta = {}
    } = body;

    // 4. CALCULATE COST SERVER-SIDE (Security)
    let cost = 1;
    
    if (["matting", "sharpen", "denoise"].includes(task)) {
       cost = 1; // Cheap tasks
    } else if (["uncrop", "relight"].includes(task)) {
       cost = 3; // Expensive generative tasks
    } else {
       // Upscale: Depends on resolution
       const w = client_meta.originalWidth || 1000; 
       const h = client_meta.originalHeight || 1000;
       cost = calculateCost(w, h, Number(scale));
    }

    // 5. CHECK CREDITS
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const currentCredits = userSnap.data()?.credits || 0;

    if (currentCredits < cost) {
      return NextResponse.json({ 
        error: `Insufficient credits. Job costs ${cost}, you have ${currentCredits}.` 
      }, { status: 402 });
    }

    // 6. CREATE DB RECORD
    const generationsRef = userRef.collection("generations");
    const newDoc = generationsRef.doc();
    const jobId = newDoc.id;
    
    await newDoc.set({
      id: jobId,
      userId,
      status: "processing", 
      originalUrl: imageUrl,
      task,
      variant, 
      engine,
      scale,
      cost, // Saved for refund logic
      createdAt: FieldValue.serverTimestamp(),
      params: { strength, creativity, lighting_prompt, uncrop_expansion },
      meta: client_meta,
    });

    // 7. 🔥 FIRE & FORGET: Trigger Modal
    fetch(MODAL_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Webhook-Secret": process.env.MODAL_WEBHOOK_SECRET! 
      },
      body: JSON.stringify({
        // 🟢 MAPPING TO PYTHON UNIFIED SCHEMA
        image_url: imageUrl,
        task,
        variant,
        engine,
        scale_factor: Number(scale),
        strength,
        enhance_face,
        creativity,
        lighting_prompt,
        force_subject,
        uncrop_expansion,
        pro_mode,
        created_at: Date.now() / 1000,
        // Async Context
        job_id: jobId,
        user_id: userId,
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/modal`
      }),
    }).catch(err => console.error("Failed to trigger Modal:", err));

    // 8. DEDUCT CREDITS
    await userRef.update({ credits: FieldValue.increment(-cost) });

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