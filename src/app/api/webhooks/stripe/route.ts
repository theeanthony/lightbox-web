import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebaseAdmin"; // Ensure this import path is correct for your project
import { FieldValue } from "firebase-admin/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover", // Matching your version
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    // 1. Verify the event actually came from Stripe
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 2. Handle the specific event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Extract the data we stuffed into metadata during checkout
    const userId = session.metadata?.userId;
    const creditsStr = session.metadata?.credits;

    if (userId && creditsStr) {
      const creditsToAdd = parseInt(creditsStr, 10);
      
      console.log(`💰 Payment success! Adding ${creditsToAdd} credits to user ${userId}`);

      // 3. Update Firebase
      await adminDb.collection("users").doc(userId).set(
        {
          credits: FieldValue.increment(creditsToAdd), // Atomic increment (safe)
        },
        { merge: true }
      );
    }
  }

  return new NextResponse("Received", { status: 200 });
}