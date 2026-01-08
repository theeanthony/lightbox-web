import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; 
import { FieldValue } from "firebase-admin/firestore";
import { ratelimit } from "@/lib/ratelimit";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { calculateCost } from "@/lib/pricing";

// 🔧 CONFIG
// Make sure this matches the app name in deploy.py ("lightbox-engine")
const MODAL_URL = "https://theeanthony--lightbox-engine-upscale-router.modal.run";

export async function POST(req: Request) {
  try {
    // 1. AUTHENTICATION
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

    // 3. PARSE INPUTS
    const body = await req.json();
    const { 
      imageUrl, 
      task = "upscale",
      engine = "generative",
      scale_factor = 2, // Map 'scale' from client to 'scale_factor' for python
      creativity = 0.65,
      lighting_prompt = "", 
      enhance_face = true,
      // 🟢 NEW PARAMS
      sharpen_amount = 0,
      denoise_amount = 0,
      pro_mode = false,
      client_meta = {}
    } = body;

    // 4. CALCULATE COST
    let cost = 1;
    if (["sharpen", "denoise"].includes(task)) {
       cost = 1; 
    } else {
       const w = client_meta.originalWidth || 1000; 
       const h = client_meta.originalHeight || 1000;
       cost = calculateCost(w, h, Number(scale_factor));
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
      engine,
      scale: scale_factor,
      cost,
      createdAt: FieldValue.serverTimestamp(),
      // Save params so we can show them in history later
      params: { creativity, lighting_prompt, sharpen_amount, denoise_amount, pro_mode },
      meta: client_meta,
    });

    // 7. 🔥 TRIGGER MODAL
    // Ensure we are sending a reachable URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    if (baseUrl.includes("localhost")) {
        console.warn("⚠️ WARNING: sending localhost webhook to cloud Modal. This will fail unless using ngrok.");
    }
    const webhookUrl = `${baseUrl}/api/webhooks/modal`;

    fetch(MODAL_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Webhook-Secret": process.env.MODAL_WEBHOOK_SECRET! 
      },
      body: JSON.stringify({
        // 🟢 MAPPING TO PYTHON UNIFIED SCHEMA EXACTLY
        image_url: imageUrl,
        task,
        engine,
        scale_factor: Number(scale_factor),
        creativity,
        lighting_prompt,
        enhance_face,
        sharpen_amount, // Passed correctly now
        denoise_amount, // Passed correctly now
        pro_mode,
        
        // System / Async
        job_id: jobId,
        user_id: userId,
        webhook_url: webhookUrl,
        created_at: Date.now() / 1000
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