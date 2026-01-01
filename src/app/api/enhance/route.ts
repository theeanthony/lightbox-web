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
    // 1. Authenticate
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Check Credits
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
        return new NextResponse("User not found", { status: 404 });
    }

    const userData = userSnap.data();
    const credits = userData?.credits || 0;

    if (credits < 1) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    }

    // 3. Get Image from Request
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
        return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    // 4. Run YOUR Replicate Model
    // Version ID from your curl command: e61dff0ddcba40f0375d6f6a67fb8930bcc3f47b417113a323f4c154549767af
    const output = await replicate.run(
      "theeanthony/upscale-test:e61dff0ddcba40f0375d6f6a67fb8930bcc3f47b417113a323f4c154549767af",
      {
        input: {
          image: imageUrl,   // The image to upscale
          scale: 2,          // Default from your screenshot
          face_blend: 0.5    // 0.5 balances AI restoration with original details
        }
      }
    );

    // 5. Deduct Credit
    await userRef.update({
      credits: FieldValue.increment(-1)
    });

    // 6. Return Result
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