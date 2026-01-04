import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { adminDb } from "@/lib/firebaseAdmin"; 
import { FieldValue } from "firebase-admin/firestore";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    // 1. Check Credits (Standard check)
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const credits = userSnap.data()?.credits || 0;

    if (credits < 1) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }

    // 2. Get Dynamic Params from the Request
    const body = await req.json();
    const { 
      imageUrl, 
      mode = "face",       // Default to face
      scale = 2,           // Default to 2x
      face_blend = 0.5     // Default to 0.5
    } = body;

    if (!imageUrl) return NextResponse.json({ error: "Image URL required" }, { status: 400 });

    // 3. Run Replicate with DYNAMIC Inputs
    const output = await replicate.run(
      "theeanthony/upscale-test:e61dff0ddcba40f0375d6f6a67fb8930bcc3f47b417113a323f4c154549767af",
      {
        input: {
          image: imageUrl,   
          mode: mode,
          scale: Number(scale),
          face_blend: Number(face_blend)
        }
      }
    );

    // 4. Deduct Credit
    await userRef.update({ credits: FieldValue.increment(-1) });

    return NextResponse.json({ 
      original: imageUrl,
      enhanced: output, 
      remainingCredits: credits - 1 
    });

  } catch (error) {
    console.error("API Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}