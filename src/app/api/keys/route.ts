import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const snapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("keys")
    .orderBy("createdAt", "desc")
    .get();

  const keys = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString()
  }));

  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { name } = await req.json();

  // 1. Generate the Secret Key (sk_live_...)
  // This is the ONLY time this full string exists.
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const secretKey = `sk_live_${randomBytes}`;

  // 2. Hash it for storage (SHA-256)
  // If your DB is hacked, they only see hashes, not keys.
  const hash = crypto.createHash("sha256").update(secretKey).digest("hex");

  // 3. Save Metadata + Hash
  const newKeyRef = adminDb.collection("users").doc(userId).collection("keys").doc();
  const keyData = {
    id: newKeyRef.id,
    name: name || "Default Key",
    prefix: secretKey.substring(0, 12), // Store 'sk_live_1234' for display
    hash: hash,
    createdAt: FieldValue.serverTimestamp(),
  };

  await newKeyRef.set(keyData);

  // 4. Return the FULL key to the user (Once)
  return NextResponse.json({ 
    secretKey, 
    meta: { ...keyData, createdAt: new Date().toISOString() } 
  });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    await adminDb.collection("users").doc(userId).collection("keys").doc(id).delete();
  }

  return NextResponse.json({ success: true });
}