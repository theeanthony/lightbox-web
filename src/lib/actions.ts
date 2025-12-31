"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { randomBytes } from "crypto";

// =========================================================
// CONFIGURATION
// Change this to 0 if you want users to pay immediately.
// Change this to 10 (or 50) to give them a free trial.
const INITIAL_FREE_CREDITS = 5; 
// =========================================================

export async function getUserDashboardData() {
  // 1. Verify the user is logged in via Clerk
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return null; 
  }

  // 2. Reference the Firestore Document
  // We use the Clerk User ID as the document ID for easy lookup.
  const userRef = adminDb.collection("users").doc(userId);
  const doc = await userRef.get();

  // 3. IF USER EXISTS: Return their data
  if (doc.exists) {
    return doc.data();
  }

  // 4. IF USER DOES NOT EXIST: Create them (Onboarding)
  
  // Generate a secure, random API key
  const newApiKey = `lb_live_${randomBytes(16).toString("hex")}`;
  
  const newUser = {
    // Basic Info
    email: user.emailAddresses[0].emailAddress,
    userId: userId,
    
    // The Logic you requested:
    credits: INITIAL_FREE_CREDITS, 
    
    // Security & Metadata
    apiKey: newApiKey,
    createdAt: new Date(),
    status: "active"
  };

  // Write to Firebase
  await userRef.set(newUser);

  return newUser;
}