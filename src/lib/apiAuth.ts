import { auth } from "@clerk/nextjs/server";
import { adminDb } from "@/lib/firebaseAdmin";
import crypto from "crypto";

export async function getAuthenticatedUser(req: Request): Promise<string | null> {
  // 1. Check for Browser Session (Clerk)
  const { userId: clerkUserId } = await auth();
  if (clerkUserId) {
    return clerkUserId;
  }

  // 2. Check for API Key (Bearer Token)
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer sk_live_")) {
    const rawKey = authHeader.split("Bearer ")[1];
    
    // Hash the incoming key to match DB storage
    const hash = crypto.createHash("sha256").update(rawKey).digest("hex");

    // Query Firestore to find which user owns this key
    // Note: This is a "Collection Group Query" across all users
    const querySnapshot = await adminDb
      .collectionGroup("keys")
      .where("hash", "==", hash)
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const keyDoc = querySnapshot.docs[0];
      // The key document is located at: users/{userId}/keys/{keyId}
      // We can extract the userId from the document reference path
      const userId = keyDoc.ref.parent.parent?.id;
      
      // Update "lastUsed" timestamp for the key (optional but nice)
      await keyDoc.ref.update({ lastUsed: new Date().toISOString() });

      return userId || null;
    }
  }

  return null;
}