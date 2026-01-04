"use client";

import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Loader2, UploadCloud, Sliders } from "lucide-react";
import CompareSlider from "./CompareSlider";

// Define the shape of a "Job" (one photo being processed)
interface Job {
  id: string;
  file: File;
  status: "uploading" | "processing" | "done" | "error";
  originalUrl?: string;
  resultUrl?: string;
  error?: string;
}

export default function Playground() {
  // 1. Model Parameters (State)
  const [mode, setMode] = useState<"face" | "universal">("face");
  const [scale, setScale] = useState(2);
  const [faceBlend, setFaceBlend] = useState(0.5);

  // 2. Job Queue (State)
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 3. Handle File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newJobs: Job[] = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file: file,
        status: "uploading",
      }));
      setJobs((prev) => [...prev, ...newJobs]);
      processQueue(newJobs); // Start processing immediately
    }
  };

  // 4. Processing Loop
  const processQueue = async (newJobs: Job[]) => {
    setIsProcessing(true);

    for (const job of newJobs) {
      try {
        // A. Upload to Firebase
        const storageRef = ref(storage, `playground/${Date.now()}_${job.file.name}`);
        const snapshot = await uploadBytes(storageRef, job.file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Update Job State: Uploaded
        updateJob(job.id, { status: "processing", originalUrl: downloadURL });

        // B. Call API with CURRENT Slider Values
        const res = await fetch("/api/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            imageUrl: downloadURL,
            mode: mode,
            scale: scale,
            face_blend: faceBlend
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");

        // C. Update Job State: Done
        updateJob(job.id, { status: "done", resultUrl: data.enhanced });

      } catch (err: any) {
        updateJob(job.id, { status: "error", error: err.message });
      }
    }
    setIsProcessing(false);
  };

  // Helper to update a specific job in the list
  const updateJob = (id: string, updates: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      
      {/* LEFT COLUMN: Controls */}
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl sticky top-8">
          <div className="flex items-center gap-2 mb-6 text-xl font-bold">
            <Sliders className="text-purple-400" />
            <h2>Model Settings</h2>
          </div>

          {/* Mode Selector */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Mode</label>
            <div className="grid grid-cols-2 gap-2 bg-black p-1 rounded-lg border border-gray-800">
              <button 
                onClick={() => setMode("face")}
                className={`py-2 text-sm font-medium rounded-md transition ${mode === "face" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-white"}`}
              >
                Face
              </button>
              <button 
                onClick={() => setMode("universal")}
                className={`py-2 text-sm font-medium rounded-md transition ${mode === "universal" ? "bg-purple-600 text-white" : "text-gray-500 hover:text-white"}`}
              >
                Universal
              </button>
            </div>
          </div>

          {/* Scale Selector */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Scale (x{scale})</label>
            <input 
              type="range" min="1" max="4" step="1" 
              value={scale} 
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full accent-purple-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>1x</span><span>2x</span><span>3x</span><span>4x</span>
            </div>
          </div>

          {/* Face Blend Slider (The Secret Sauce) */}
          {mode === "face" && (
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">
                Identity Blend ({faceBlend})
              </label>
              <input 
                type="range" min="0" max="1" step="0.1" 
                value={faceBlend} 
                onChange={(e) => setFaceBlend(Number(e.target.value))}
                className="w-full accent-blue-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>AI Perfect</span>
                <span>Original</span>
              </div>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                0.0 = Pure AI (Perfect but fake).<br/>
                1.0 = Pure Original (Blurry but real).<br/>
                0.5 = Balanced.
              </p>
            </div>
          )}

          {/* UPLOAD BUTTON */}
          <div className="pt-6 border-t border-gray-800">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:bg-gray-800/50 transition group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 mb-3 text-gray-400 group-hover:text-white transition" />
                <p className="text-sm text-gray-500">Upload Images</p>
              </div>
              <input type="file" className="hidden" multiple onChange={handleFileSelect} />
            </label>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Results Grid */}
      <div className="lg:col-span-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {jobs.map((job) => (
            <div key={job.id} className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
              
              {/* Header */}
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/20">
                <span className="text-sm font-medium truncate max-w-[200px]">{job.file.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full border ${
                  job.status === "done" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                  job.status === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  "bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse"
                }`}>
                  {job.status.toUpperCase()}
                </span>
              </div>

              {/* Visualization Area */}
              <div className="p-4">
                {job.status === "done" && job.originalUrl && job.resultUrl ? (
                  // SUCCESS: Show Comparison Slider
                  <CompareSlider before={job.originalUrl} after={job.resultUrl} />
                ) : job.originalUrl ? (
                  // LOADING: Show just the original with spinner overlay
                  <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden bg-black">
                    <img src={job.originalUrl} className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </div>
                  </div>
                ) : (
                  // UPLOADING: Placeholder
                  <div className="aspect-[3/4] w-full bg-black flex items-center justify-center text-gray-600">
                    Waiting for upload...
                  </div>
                )}
                
                {/* Error Message */}
                {job.error && (
                  <p className="mt-2 text-xs text-red-400">{job.error}</p>
                )}
              </div>
            </div>
          ))}
          
          {/* Empty State */}
          {jobs.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-800 rounded-xl">
              <p className="text-gray-500">No images yet. Configure settings on the left and upload photos to test.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}