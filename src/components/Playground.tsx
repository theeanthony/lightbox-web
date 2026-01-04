"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Loader2, UploadCloud, Sliders, Zap, Sparkles, 
  Aperture, Play, X, Image as ImageIcon,
  Download, Maximize2, FileText, Monitor, Check, Clock, 
  ThumbsUp, ThumbsDown
} from "lucide-react";
import CompareSlider from "./CompareSlider";

// 🔧 CONFIGURATION
const R2_PUBLIC_DOMAIN = "https://pub-07de09a82f474da9b43b3ffbb54fb5f5.r2.dev"; 
const EXPIRATION_HOURS = 24;

const isJobExpired = (createdAt?: string) => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffInHours = (now - created) / (1000 * 60 * 60);
  return diffInHours > EXPIRATION_HOURS;
};

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface Job {
  id: string;
  file?: File; 
  status: "idle" | "uploading" | "processing" | "done" | "error" | "expired";
  originalUrl: string;
  resultUrl?: string;
  error?: string;
  step?: string;
  originalDims?: { w: number; h: number };
  resultDims?: { w: number; h: number };
  createdAt?: string;
  feedback?: "like" | "dislike" | null;
  progress?: number; // 🟢 ADD THIS LINE
}

export default function Playground() {
  const [mode, setMode] = useState<"face" | "universal">("face");
  const [scale, setScale] = useState(2);
  const [faceBlend, setFaceBlend] = useState(0.5);
  const [proMode, setProMode] = useState(false);
  const [lighting, setLighting] = useState("");
  const [subject, setSubject] = useState("");
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [zoomedJob, setZoomedJob] = useState<Job | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. FETCH HISTORY (Reusable Function) ---
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history", { 
        cache: 'no-store', // 🔴 Critical: Never use browser cache
        next: { revalidate: 0 } // 🔴 Critical: Tell Next.js to fetch fresh data
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // SMART MERGE: Update existing jobs with new status, append new ones
        setJobs(prevJobs => {
           const newJobs = [...prevJobs];
           
           data.jobs.forEach((serverJob: any) => {
              const expired = isJobExpired(serverJob.createdAt);
              const status = expired ? 'expired' : serverJob.status;
              
              const existingIndex = newJobs.findIndex(j => j.id === serverJob.id);
              
              if (existingIndex !== -1) {
                 // Update existing job (keep local properties like 'file' if they exist)
                 newJobs[existingIndex] = {
                    ...newJobs[existingIndex],
                    status: status,
                    resultUrl: serverJob.resultUrl,
                    resultDims: serverJob.resultDims,
                    createdAt: serverJob.createdAt,
                    originalDims: serverJob.originalDims || newJobs[existingIndex].originalDims,
                    feedback: serverJob.feedback || newJobs[existingIndex].feedback
                 };
              } else {
                 // Add new job from history
                 newJobs.push({
                    id: serverJob.id,
                    status: status,
                    originalUrl: serverJob.originalUrl,
                    resultUrl: serverJob.resultUrl,
                    resultDims: serverJob.resultDims,
                    originalDims: serverJob.originalDims,
                    createdAt: serverJob.createdAt,
                    feedback: serverJob.feedback || null
                 });
              }
           });
           
           // Sort by CreatedAt Descending
           return newJobs.sort((a, b) => 
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
           );
        });
      }
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // --- 2. POLLING MECHANISM ---
  // If we have any 'processing' jobs, check for updates every 3 seconds
  useEffect(() => {
    const hasProcessing = jobs.some(j => j.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
       fetchHistory();
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, fetchHistory]);


  // --- FEEDBACK HANDLER ---
  const handleFeedback = async (jobId: string, vote: "like" | "dislike") => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, feedback: vote } : j));
    if (zoomedJob && zoomedJob.id === jobId) {
       setZoomedJob(prev => prev ? { ...prev, feedback: vote } : null);
    }
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, vote })
      });
    } catch (e) { console.error(e); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newJobs: Job[] = Array.from(e.target.files).map((file) => {
        const url = URL.createObjectURL(file);
        const job: Job = {
          id: Math.random().toString(36).substr(2, 9), // Temp ID
          file: file,
          status: "idle",
          originalUrl: url,
          feedback: null
        };
        const img = new Image();
        img.onload = () => {
          updateJob(job.id, { originalDims: { w: img.width, h: img.height } });
        };
        img.src = url;
        return job;
      });
      setJobs((prev) => [...newJobs, ...prev]);
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

  // --- 3. FIXED PROCESS FUNCTION (Async Safe) ---
  const processSingleJob = async (job: Job) => {
    if (!job.file) return; 
    
    try {
      // Step A: Upload
      updateJob(job.id, { status: "uploading", step: "Uploading..." });
      
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
      
      // Step B: Call Engine (Async)
      updateJob(job.id, { status: "processing", step: "Queued...", originalUrl: publicUrl });

      const enhanceRes = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: publicUrl,
          mode, scale, face_blend: faceBlend,
          pro_mode: proMode,
          lighting_prompt: lighting,
          force_subject: subject,
          client_meta: {
            fileSize: job.file.size,
            fileType: job.file.type,
            originalWidth: job.originalDims?.w || 0,
            originalHeight: job.originalDims?.h || 0,
          }
        }),
      });

      if (!enhanceRes.ok) throw new Error("Engine Busy");
      
      // 🟢 KEY FIX HERE:
      // The API returns { status: "queued", jobId: "..." }
      // We do NOT have resultUrl yet. We just update the ID and wait for polling.
      const data = await enhanceRes.json();

      setJobs(prev => prev.map(j => j.id === job.id ? { 
         ...j, 
         id: data.jobId, // Swap temp ID for real DB ID
         status: "processing",
         step: "Enhancing...",
      } : j));

      // Polling useEffect will take over from here...

    } catch (err: any) {
      console.error(err);
      updateJob(job.id, { status: "error", error: err.message || "Error", step: "Failed" });
    }
  };

  const updateJob = (id: string, updates: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `enhanced_${filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 text-foreground pb-20">
      
      {/* SIDEBAR */}
      <aside className="lg:w-80 flex-shrink-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Playground</h1>
          <p className="text-muted-foreground text-sm">
             Batch test your model with different parameters.
          </p>
        </div>
        <div className="sticky top-8 space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Sliders className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Configuration</h2>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Engine Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMode("face")} className={`flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-md text-xs font-medium border transition-all ${mode === "face" ? "bg-primary/5 border-primary text-primary" : "bg-background border-input text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Sparkles className="w-4 h-4"/> Generative
                </button>
                <button onClick={() => setMode("universal")} className={`flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-md text-xs font-medium border transition-all ${mode === "universal" ? "bg-primary/5 border-primary text-primary" : "bg-background border-input text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Aperture className="w-4 h-4"/> Fidelity
                </button>
              </div>
            </div>
            <div className="space-y-4">
               <div className="flex justify-between items-center"><label className="text-sm font-medium text-foreground">Upscale Factor</label><button onClick={() => setProMode(!proMode)} className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all border ${proMode ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"}`}><Zap className="w-3 h-3" /> {proMode ? '8K Pro' : '4K Std'}</button></div>
               <input type="range" min="1" max="4" step="1" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"/>
               <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-1"><span>1x</span><span>2x</span><span>3x</span><span>4x</span></div>
            </div>
            {mode === "face" && (
              <div className="space-y-4 pt-2 border-t border-dashed border-border">
                <div className="flex justify-between items-center"><label className="text-sm font-medium text-foreground">Identity Blend</label><span className="text-xs font-mono text-muted-foreground">{Math.round(faceBlend * 100)}%</span></div>
                <input type="range" min="0" max="1" step="0.1" value={faceBlend} onChange={(e) => setFaceBlend(Number(e.target.value))} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"/>
                <div className="flex justify-between text-[10px] text-muted-foreground px-1"><span>Creative</span><span>Strict</span></div>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
             <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-amber-500" /><h2 className="text-sm font-semibold text-foreground">Prompting</h2></div>
             <div><label className="text-xs font-medium text-muted-foreground mb-1.5 block">Lighting Style</label><input type="text" placeholder="e.g. Cinematic, Neon..." value={lighting} onChange={(e) => setLighting(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"/></div>
             <div><label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject Focus</label><input type="text" placeholder="e.g. Cat, Face..." value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"/></div>
          </div>
        </div>
      </aside>

      {/* WORKSPACE */}
      <main className="flex-1 min-w-0 flex flex-col pt-14">
        <div className="flex items-center justify-between mb-6 bg-card border border-border p-3 rounded-lg shadow-sm">
           <div className="flex items-center gap-6 px-4">
              <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Queue</span><span className="text-sm font-mono font-medium text-foreground">{jobs.length}</span></div>
              <div className="w-px h-8 bg-border"></div>
              <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Est. Time</span><span className="text-sm font-mono font-medium text-foreground">~{jobs.filter(j => j.status === 'idle').length * 3}s</span></div>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-muted border border-input rounded-md text-sm font-medium text-foreground transition-colors"><UploadCloud className="w-4 h-4" /> Add Photos</button>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
              <button onClick={runBatch} disabled={isBatchRunning || jobs.filter(j => j.status === 'idle').length === 0} className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all shadow-sm ${isBatchRunning ? "bg-muted text-muted-foreground cursor-not-allowed" : jobs.filter(j => j.status === 'idle').length > 0 ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>{isBatchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}{isBatchRunning ? "Processing..." : "Run Batch"}</button>
           </div>
        </div>

        {/* GRID */}
        {isLoadingHistory ? (
           <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {jobs.map((job) => (
              <div key={job.id} className="group flex flex-col bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all">
                
                {/* Card Header */}
                <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-muted/10">
                  <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{job.file?.name || `Job ${job.id.substr(0, 6)}`}</span>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                         {job.status === 'idle' && 'Waiting'}{job.status === 'uploading' && 'Uploading'}{job.status === 'processing' && 'Enhancing'}{job.status === 'done' && 'Complete'}{job.status === 'error' && 'Failed'}{job.status === 'expired' && 'Expired'}
                      </span>
                  </div>
                  {job.status === 'idle' || job.status === 'error' || job.status === 'expired' ? (
                      <button onClick={() => removeJob(job.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                  ) : (
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${job.status === 'processing' ? 'bg-purple-100 text-purple-700' : job.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                         {job.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}{job.status === 'done' && <Check className="w-3 h-3" />}{job.status.toUpperCase()}
                      </div>
                  )}
                </div>

                {/* Viewport */}
                <div className="relative aspect-[3/2] bg-muted/20 w-full flex items-center justify-center overflow-hidden border-b border-border">
                  {job.status === 'expired' ? (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground"><Clock className="w-8 h-8 mb-2 opacity-50" /><span className="text-sm font-semibold">Image Expired</span><span className="text-xs max-w-[200px] mt-1">Privacy Policy: Images are auto-deleted after 24 hours.</span></div>
                  ) : job.status === "done" && job.originalUrl && job.resultUrl ? (
                    <CompareSlider before={job.originalUrl} after={job.resultUrl} />
                  ) : (
                    <>
                      <img src={job.originalUrl} alt="Preview" className={`absolute inset-0 w-full h-full object-contain p-4 transition-all duration-700 ${job.status === 'idle' ? 'opacity-100' : 'opacity-50 blur-sm scale-95'}`}/>
                      {job.status === 'processing' && (
        <div className="relative z-10 flex flex-col items-center gap-3 bg-card/90 backdrop-blur px-6 py-4 rounded-xl border border-border shadow-sm">
           <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Spinner Background */}
              <div className="absolute inset-0 rounded-full border-4 border-muted/30"></div>
              {/* Spinner */}
              <Loader2 className="w-16 h-16 text-primary animate-spin absolute" />
              {/* Percentage Text */}
              <span className="text-[10px] font-bold text-foreground z-10">
                 {job.progress || 0}%
              </span>
           </div>
           <span className="text-xs font-medium text-foreground">
              Enhancing...
           </span>
        </div>
      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-card flex justify-between items-center h-12">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {job.file && <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /><span>{formatBytes(job.file.size)}</span></div>}
                    {(job.originalDims || job.resultDims) && (
                      <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /><span>{job.originalDims?.w || '?'}x{job.originalDims?.h || '?'}</span>{job.resultDims && <><span className="text-muted-foreground/50">→</span><span className="font-medium text-green-600">{job.resultDims.w}x{job.resultDims.h}</span></>}</div>
                    )}
                  </div>
                  {job.status === 'done' && job.resultUrl && !isJobExpired(job.createdAt) && (
                    <div className="flex items-center gap-2"><button onClick={() => setZoomedJob(job)} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors" title="Zoom"><Maximize2 className="w-4 h-4" /></button><button onClick={() => downloadImage(job.resultUrl!, job.file?.name || 'enhanced.png')} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors" title="Download"><Download className="w-4 h-4" /></button></div>
                  )}
                </div>
              </div>
            ))}
            
            {jobs.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-border rounded-xl h-96 flex flex-col items-center justify-center bg-muted/10 text-center p-8">
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-4 border border-input shadow-sm"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
                <h3 className="text-base font-semibold text-foreground mb-1">Your Queue is Empty</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">Drag & drop photos here or use the button below.</p>
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-background border border-input text-foreground rounded-md text-sm font-medium hover:bg-muted transition-colors shadow-sm">Select Photos</button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- ZOOM MODAL --- */}
      {zoomedJob && zoomedJob.originalUrl && zoomedJob.resultUrl && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border bg-background">
                 <div className="flex flex-col"><h3 className="font-semibold text-foreground">{zoomedJob.file?.name || 'Enhanced Image'}</h3><span className="text-xs text-muted-foreground font-mono">{zoomedJob.originalDims?.w}x{zoomedJob.originalDims?.h} → {zoomedJob.resultDims?.w}x{zoomedJob.resultDims?.h}</span></div>
                 
                 <div className="flex items-center gap-4">
                    {/* FEEDBACK CONTROLS */}
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                       <button onClick={() => handleFeedback(zoomedJob.id, 'like')} className={`p-2 rounded-md transition-colors ${zoomedJob.feedback === 'like' ? 'bg-green-100 text-green-700' : 'hover:bg-muted text-muted-foreground'}`}><ThumbsUp className="w-4 h-4" /></button>
                       <div className="w-px h-4 bg-border" />
                       <button onClick={() => handleFeedback(zoomedJob.id, 'dislike')} className={`p-2 rounded-md transition-colors ${zoomedJob.feedback === 'dislike' ? 'bg-red-100 text-red-700' : 'hover:bg-muted text-muted-foreground'}`}><ThumbsDown className="w-4 h-4" /></button>
                    </div>
                    <div className="h-6 w-px bg-border mx-2" />
                    <div className="flex items-center gap-2"><button onClick={() => downloadImage(zoomedJob.resultUrl!, zoomedJob.file?.name || 'enhanced.png')} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:opacity-90 transition-colors flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Download</button><button onClick={() => setZoomedJob(null)} className="p-1.5 hover:bg-muted text-muted-foreground rounded-md transition-colors"><X className="w-5 h-5" /></button></div>
                 </div>
              </div>
              <div className="flex-1 min-h-0 bg-muted/20 relative p-4 flex items-center justify-center overflow-hidden [&_img]:max-h-[85vh] [&_img]:w-auto [&_img]:mx-auto [&_img]:object-contain">
                 <div className="relative inline-block shadow-lg"><CompareSlider before={zoomedJob.originalUrl} after={zoomedJob.resultUrl} isModal={true} /></div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}