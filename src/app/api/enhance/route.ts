import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin"; 
import { FieldValue } from "firebase-admin/firestore";

// 🔧 CONFIG: Your Modal URL
const MODAL_URL = "https://theeanthony--lightbox-engine-upscale-router.modal.run";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    // 1. Check Credits
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const credits = userSnap.data()?.credits || 0;

    if (credits < 1) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }

    // 2. Get Dynamic Params from Request
    const body = await req.json();
    const { 
      imageUrl, 
      mode = "face", 
      scale = 2, 
      face_blend = 0.5,
      // 🟢 NEW: Capture the advanced inputs from Frontend
      lighting_prompt, 
      force_subject, 
      pro_mode 
    } = body;

    if (!imageUrl) return NextResponse.json({ error: "Image URL required" }, { status: 400 });

    // 3. TRANSLATION LAYER: Frontend Params -> Modal Params
    let creativity = 0.65;
    if (mode === "face") {
      creativity = 1.0 - Number(face_blend);
      creativity = Math.max(0.1, Math.min(0.9, creativity));
    }

    // 4. Call Your Custom Modal Engine
    const response = await fetch(MODAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        engine: mode === "universal" ? "fidelity" : "generative",
        scale_factor: Number(scale),
        creativity: creativity,
        enhance_face: mode === "face",
        
        // 🟢 NEW: Pass the advanced logic to the Engine
        // Logic: Use the UI toggle OR force it if scale is >= 3
        pro_mode: pro_mode || (Number(scale) >= 3),
        
        // Logic: Use user input OR fallback to default
        lighting_prompt: lighting_prompt || "studio lighting, neutral background",
        force_subject: force_subject || ""
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Engine Failed: ${errorText}`);
    }

    const output = await response.json();

    // 5. Deduct Credit
    await userRef.update({ credits: FieldValue.increment(-1) });

    return NextResponse.json({ 
      original: imageUrl,
      enhanced: output.download_url,
      meta: output.billing,
      remainingCredits: credits - 1 
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}