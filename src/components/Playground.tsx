"use client";

import { useState, useRef } from "react";
import { 
  Loader2, UploadCloud, Sliders, Zap, Sparkles, 
  Aperture, Play, CheckCircle2, Clock, X, Image as ImageIcon
} from "lucide-react";
import CompareSlider from "./CompareSlider";

// 🔧 CONFIGURATION
const R2_PUBLIC_DOMAIN = "https://pub-07de09a82f474da9b43b3ffbb54fb5f5.r2.dev"; 

interface Job {
  id: string;
  file: File;
  status: "idle" | "uploading" | "processing" | "done" | "error"; 
  originalUrl?: string;
  resultUrl?: string;
  error?: string;
  step?: string;
}

export default function Playground() {
  // --- STATE ---
  const [mode, setMode] = useState<"face" | "universal">("face");
  const [scale, setScale] = useState(2);
  const [faceBlend, setFaceBlend] = useState(0.5);
  const [proMode, setProMode] = useState(false);
  const [lighting, setLighting] = useState("");
  const [subject, setSubject] = useState("");
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newJobs: Job[] = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file: file,
        status: "idle",
        originalUrl: URL.createObjectURL(file)
      }));
      setJobs((prev) => [...prev, ...newJobs]);
    }
  };

  const removeJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const runBatch = async () => {
    setIsBatchRunning(true);
    const queue = jobs.filter(j => j.status === "idle" || j.status === "error");
    for (const job of queue) {
      await processSingleJob(job);
    }
    setIsBatchRunning(false);
  };

  const processSingleJob = async (job: Job) => {
    try {
      // 1. Upload
      updateJob(job.id, { status: "uploading", step: "Securing Asset..." });
      
      const signRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType: job.file.type }),
      });
      if (!signRes.ok) throw new Error("Auth Failed");
      const { url, filename } = await signRes.json();

      await fetch(url, {
        method: "PUT",
        body: job.file,
        headers: { "Content-Type": job.file.type },
      });

      const publicUrl = `${R2_PUBLIC_DOMAIN}/${filename}`;
      
      // 2. Process
      updateJob(job.id, { status: "processing", step: "Spinning up GPU...", originalUrl: publicUrl });

      const enhanceRes = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: publicUrl,
          mode, scale, face_blend: faceBlend,
          pro_mode: proMode,
          lighting_prompt: lighting,
          force_subject: subject
        }),
      });

      if (!enhanceRes.ok) throw new Error("Engine Busy");
      const data = await enhanceRes.json();

      updateJob(job.id, { status: "done", resultUrl: data.enhanced, step: "Complete" });

    } catch (err: any) {
      console.error(err);
      updateJob(job.id, { status: "error", error: err.message || "Error", step: "Failed" });
    }
  };

  const updateJob = (id: string, updates: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-100px)]">
      
      {/* --- SIDEBAR: CONTROLS --- */}
      <aside className="lg:w-80 flex-shrink-0 space-y-6">
        <div className="sticky top-8 space-y-6">
          
          {/* Panel: Engine Config */}
          <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Sliders className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold tracking-wider text-white uppercase">Configuration</h2>
            </div>

            {/* Mode Switch */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Engine Mode</label>
              <div className="grid grid-cols-2 gap-1 bg-black/50 p-1 rounded-lg border border-white/5">
                <button 
                  onClick={() => setMode("face")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                    mode === "face" 
                      ? "bg-purple-600/20 text-purple-300 shadow-[0_0_15px_rgba(147,51,234,0.3)] border border-purple-500/50" 
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3 h-3"/> Generative
                </button>
                <button 
                  onClick={() => setMode("universal")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                    mode === "universal" 
                      ? "bg-blue-600/20 text-blue-300 shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500/50" 
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  <Aperture className="w-3 h-3"/> Fidelity
                </button>
              </div>
            </div>

            {/* Sliders Area */}
            <div className="space-y-6">
              {/* Scale */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                   <label className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Upscale Factor</label>
                   <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${proMode ? 'bg-yellow-500/20 text-yellow-200 border-yellow-500/50' : 'bg-neutral-800 text-neutral-500 border-transparent'}`}>
                        {proMode ? '8K PRO' : '4K STD'}
                      </span>
                      <button 
                        onClick={() => setProMode(!proMode)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${proMode ? 'bg-yellow-500' : 'bg-neutral-700'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${proMode ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                   </div>
                </div>
                <input 
                  type="range" min="1" max="4" step="1" 
                  value={scale} 
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white hover:accent-purple-400 transition-colors"
                />
                <div className="flex justify-between text-[10px] text-neutral-600 font-mono">
                  <span>1x</span><span>2x</span><span>3x</span><span>4x</span>
                </div>
              </div>

              {/* Creativity */}
              {mode === "face" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Identity Blend</label>
                    <span className="text-xs font-mono text-purple-400">{Math.round(faceBlend * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={faceBlend} 
                    onChange={(e) => setFaceBlend(Number(e.target.value))}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white hover:accent-purple-400 transition-colors"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-600">
                    <span>AI Imagination</span>
                    <span>Strict Reality</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel: Prompt Engineering */}
          <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
             <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-yellow-500" />
                <h2 className="text-sm font-bold tracking-wider text-white uppercase">Refinement</h2>
             </div>
             <div className="space-y-3">
                <div>
                   <input 
                      type="text" 
                      placeholder="Lighting (e.g. Cinematic, Neon)"
                      value={lighting}
                      onChange={(e) => setLighting(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all"
                   />
                </div>
                <div>
                   <input 
                      type="text" 
                      placeholder="Force Subject (e.g. Cat, Car)"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all"
                   />
                </div>
             </div>
          </div>
        </div>
      </aside>

      {/* --- MAIN: WORKSPACE --- */}
      <main className="flex-1 min-w-0">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 bg-neutral-900/30 border border-white/5 p-2 rounded-xl backdrop-blur-md">
           <div className="flex items-center gap-4 px-2">
              <span className="text-xs font-mono text-neutral-500">QUEUE: <span className="text-white">{jobs.length}</span></span>
              <div className="h-4 w-px bg-white/10"></div>
              <span className="text-xs font-mono text-neutral-500">EST. TIME: <span className="text-white">~3s</span></span>
           </div>

           <div className="flex items-center gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white transition-all"
              >
                <UploadCloud className="w-3 h-3" /> Add Photos
              </button>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />

              <button
                onClick={runBatch}
                disabled={isBatchRunning || jobs.length === 0}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all shadow-lg ${
                  isBatchRunning 
                     ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                     : jobs.length > 0
                        ? "bg-white text-black hover:bg-neutral-200 hover:scale-105"
                        : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                }`}
              >
                {isBatchRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                {isBatchRunning ? "PROCESSING..." : "RUN BATCH"}
              </button>
           </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
          {jobs.map((job) => (
            <div key={job.id} className="group relative bg-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all hover:border-white/20">
              
              {/* Card Header */}
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 to-transparent">
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-white tracking-tight drop-shadow-md">{job.file.name}</span>
                    <span className="text-[10px] font-mono text-neutral-400 uppercase">{job.status === 'idle' ? 'Pending' : job.step || job.status}</span>
                 </div>
                 
                 {job.status === 'idle' && (
                    <button onClick={() => removeJob(job.id)} className="p-1.5 bg-black/50 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-full backdrop-blur-md transition-colors border border-white/10">
                       <X className="w-3 h-3" />
                    </button>
                 )}
              </div>

              {/* Status Indicators */}
              <div className="absolute bottom-4 right-4 z-20">
                 {job.status === "uploading" && <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 backdrop-blur-md text-blue-200 text-[10px] font-bold rounded-full flex items-center gap-2 animate-pulse"><UploadCloud className="w-3 h-3" /> SYNCING</div>}
                 {job.status === "processing" && <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 backdrop-blur-md text-purple-200 text-[10px] font-bold rounded-full flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> ENHANCING</div>}
                 {job.status === "done" && <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 backdrop-blur-md text-green-200 text-[10px] font-bold rounded-full flex items-center gap-2 shadow-[0_0_10px_rgba(34,197,94,0.2)]"><CheckCircle2 className="w-3 h-3" /> COMPLETE</div>}
                 {job.status === "error" && <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 backdrop-blur-md text-red-200 text-[10px] font-bold rounded-full flex items-center gap-2"><X className="w-3 h-3" /> FAILED</div>}
              </div>

              {/* Viewport */}
              <div className="relative aspect-[4/5] bg-neutral-900/50 w-full">
                {job.status === "done" && job.originalUrl && job.resultUrl ? (
                  <CompareSlider before={job.originalUrl} after={job.resultUrl} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center relative">
                     {/* Preview BG */}
                     {job.originalUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                           src={job.originalUrl} 
                           alt="Preview" 
                           className={`absolute inset-0 w-full h-full object-contain transition-all duration-700 ${job.status === 'idle' ? 'opacity-40 grayscale-[0.5]' : 'opacity-20 blur-sm scale-105'}`}
                        />
                     )}
                     
                     {/* Overlay Loader */}
                     {job.status === 'processing' && (
                        <div className="relative z-10 flex flex-col items-center gap-4">
                           <div className="relative">
                              <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                 <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                              </div>
                           </div>
                        </div>
                     )}

                     {job.status === 'idle' && (
                        <div className="relative z-10 p-4 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-center">
                           <Clock className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                           <p className="text-xs text-neutral-300 font-medium">Ready to Process</p>
                        </div>
                     )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Empty State */}
          {jobs.length === 0 && (
            <div className="col-span-full border border-dashed border-neutral-800 rounded-3xl h-96 flex flex-col items-center justify-center bg-neutral-900/20 text-center p-8">
              <div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center mb-6">
                <ImageIcon className="w-8 h-8 text-neutral-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Your Queue is Empty</h3>
              <p className="text-neutral-500 max-w-sm mb-8 text-sm leading-relaxed">
                Upload photos to the batch queue. Adjust the engine settings on the left to customize the output.
              </p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-white text-black rounded-full font-bold text-sm hover:bg-neutral-200 transition-colors"
              >
                Select Photos
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}