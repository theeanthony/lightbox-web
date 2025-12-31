import "server-only";
import * as admin from "firebase-admin";

// 1. Clean up the private key
// Vercel and .env files sometimes mess up the "\n" (newline) characters.
// This logic fixes it automatically.
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

// 2. Initialize the App (Singleton Pattern)
// We check if an app already exists to prevent errors during hot-reloading.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

// 3. Export the database instance
export const adminDb = admin.firestore();