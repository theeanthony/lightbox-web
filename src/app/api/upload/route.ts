import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import r2 from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    // 1. Get the file type from the client (e.g., "image/png")
    const { fileType } = await request.json();

    // 2. Generate a unique filename using native crypto
    // This prevents users from accidentally overwriting each other's files
    const fileExtension = fileType.split('/')[1];
    const filename = `${crypto.randomUUID()}.${fileExtension}`;

    // 3. Prepare the command for the browser to upload directly to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      ContentType: fileType,
      // ACL: 'public-read', // Uncomment if you want files to be public immediately
    });

    // 4. Generate the "Permission Slip" (Signed URL) valid for 60 seconds
    const signedUrl = await getSignedUrl(r2, command, { expiresIn: 60 });

    // 5. Send the URL and the final filename back to the frontend
    return NextResponse.json({ url: signedUrl, filename });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}