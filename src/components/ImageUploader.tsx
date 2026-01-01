"use client";

import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase"; // Make sure this path is correct
import { Loader2, UploadCloud } from "lucide-react";

export default function ImageUploader() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Upload to Firebase Storage
      // Create a unique name: "uploads/USER_ID/TIMESTAMP_filename.jpg"
      // For MVP we just use a random ID or timestamp
      const storageRef = ref(storage, `uploads/${Date.now()}_${imageFile.name}`);
      const snapshot = await uploadBytes(storageRef, imageFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      console.log("File uploaded to:", downloadURL);

      // 2. Send that URL to your API
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: downloadURL }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to process image");

      // 3. Show Result
      setResult(data.enhanced); // The URL from Replicate

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-gray-900/50 border border-gray-800 rounded-xl">
      
      {/* File Input Area */}
      <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:bg-gray-800/50 transition">
        <input 
          type="file" 
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          className="hidden" 
          id="fileInput"
        />
        <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400">
            <UploadCloud size={32} />
          </div>
          <div className="text-gray-400">
            {imageFile ? (
              <span className="text-white font-medium">{imageFile.name}</span>
            ) : (
              <span>Click to upload original image</span>
            )}
          </div>
        </label>
      </div>

      {/* Action Button */}
      {imageFile && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full mt-6 bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Enhancing..." : "Start Upscale"}
        </button>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 text-red-400 rounded-lg text-sm">
          Error: {error}
        </div>
      )}

      {/* Success / Result */}
      {result && (
        <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="p-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl">
            <img src={result} alt="Enhanced" className="rounded-lg w-full" />
          </div>
          <div className="text-center">
            <a 
              href={result} 
              target="_blank" 
              className="text-sm text-gray-400 hover:text-white underline"
            >
              Download Full Size
            </a>
          </div>
        </div>
      )}
    </div>
  );
}