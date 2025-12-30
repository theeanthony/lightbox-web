"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/firebase";
import { randomBytes } from "crypto";

export async function getUserDashboardData() {
  // 1. Get Auth Context from Clerk
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return null; // Handle redirects in middleware or page
  }

  // 2. Check Firestore for this user
  const userRef = db.collection("users").doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    // 3. First-time login: Create the user doc
    const newApiKey = `lb_live_${randomBytes(16).toString("hex")}`;
    
    const newUser = {
      email: user.emailAddresses[0].emailAddress,
      credits: 10, // Give 10 free credits on sign up
      apiKey: newApiKey,
      createdAt: new Date(),
    };

    await userRef.set(newUser);
    return newUser;
  }

  // 4. Return existing data
  return doc.data();
}