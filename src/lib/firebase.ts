import "server-only"; // Security: Ensures this never bundles to the client
import * as admin from "firebase-admin";

interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Format private key correctly for Vercel/Next.js env vars
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    } as FirebaseConfig),
  });
}

export const db = admin.firestore();