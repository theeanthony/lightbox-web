"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Loader2, UploadCloud, Sliders, Zap, Sparkles, 
  Aperture, Play, X, Image as ImageIcon,
  Download, Maximize2, FileText, Monitor, Check, Clock, 
  ThumbsUp, ThumbsDown, Coins, Scissors, Sun, Expand, Droplets, Activity,
  RectangleVertical, RectangleHorizontal, Square, Scan, AlertCircle
} from "lucide-react"; 
import CompareSlider from "./CompareSlider";
import { calculateCost } from "@/lib/pricing";

// 🔧 CONFIGURATION
const R2_PUBLIC_DOMAIN = "https://pub-07de09a82f474da9b43b3ffbb54fb5f5.r2.dev"; 
const EXPIRATION_HOURS = 24;

const TASKS = [
  { id: "upscale", label: "Upscale", icon: Activity, desc: "Increase resolution & quality" },
  { id: "matting", label: "Remove BG", icon: Scissors, desc: "Remove background transparently" },
  { id: "sharpen", label: "Sharpen", icon: Aperture, desc: "Fix blur & focus issues" },
  { id: "denoise", label: "Denoise", icon: Droplets, desc: "Remove grain & ISO noise" },
  { id: "relight", label: "Relight", icon: Sun, desc: "Change lighting & atmosphere" },
  { id: "uncrop", label: "Uncrop", icon: Expand, desc: "Expand image borders" },
];

const VARIANTS = {
  sharpen: [
    { id: "standard", label: "Standard" },
    { id: "strong", label: "Strong" },
    { id: "lens_blur", label: "Lens Blur" },
    { id: "motion_blur", label: "Motion Blur" },
    { id: "art", label: "Digital Art" }
  ],
  denoise: [
    { id: "normal", label: "Normal" },
    { id: "extreme", label: "Extreme" }
  ]
};

const ASPECT_RATIOS = [
  { id: "custom", label: "Custom Zoom", value: 0, icon: Scan },
  { id: "1:1", label: "Square (1:1)", value: 1, icon: Square },
  { id: "9:16", label: "Story (9:16)", value: 9/16, icon: RectangleVertical },
  { id: "16:9", label: "Landscape (16:9)", value: 16/9, icon: RectangleHorizontal },
  { id: "4:5", label: "Post (4:5)", value: 4/5, icon: RectangleVertical },
];

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
  progress?: number; 
}

export default function Playground({ initialCredits = 0 }: { initialCredits?: number }) {
  const [task, setTask] = useState("upscale");
  const [variant, setVariant] = useState("standard");
  const [engine, setEngine] = useState<"generative" | "fidelity">("generative");
  
  const [scale, setScale] = useState(2);
  const [strength, setStrength] = useState(0.7); 
  const [creativity, setCreativity] = useState(0.65);
  const [enhanceFace, setEnhanceFace] = useState(true);
  
  const [lighting, setLighting] = useState("");
  const [subject, setSubject] = useState("");
  
  const [targetRatio, setTargetRatio] = useState("9:16"); 
  const [zoomOut, setZoomOut] = useState(0.5); 
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [zoomedJob, setZoomedJob] = useState<Job | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [credits, setCredits] = useState(initialCredits);
  
  // 🟢 NEW: Track deleted IDs to prevent "Zombie Cards" reappearing during polling
  const deletedJobIds = useRef(new Set<string>());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCredits(initialCredits); }, [initialCredits]);

  const getJobCost = (job: Job) => {
    if (task === 'matting' || task === 'sharpen' || task === 'denoise') return 1;
    if (task === 'uncrop' || task === 'relight') return 3;
    if (!job.originalDims) return 1; 
    return calculateCost(job.originalDims.w, job.originalDims.h, scale);
  };

  const pendingJobs = jobs.filter(j => j.status === 'idle');
  const batchCost = pendingJobs.reduce((sum, job) => sum + getJobCost(job), 0);

  // --- FETCH HISTORY ---
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history", { cache: 'no-store', next: { revalidate: 0 } });
      if (res.ok) {
        const data = await res.json();
        
        setJobs(prevJobs => {
           const newJobs = [...prevJobs];
           
           data.jobs.forEach((serverJob: any) => {
              // 🟢 FIX: Ignore jobs that we have locally deleted
              if (deletedJobIds.current.has(serverJob.id)) return;

              const expired = isJobExpired(serverJob.createdAt);
              
              // 🟢 FIX: Map 'failed' to 'error'
              let status = expired ? 'expired' : serverJob.status;
              if (status === 'failed') status = 'error'; 
              
              const existingIndex = newJobs.findIndex(j => j.id === serverJob.id);
              
              if (existingIndex !== -1) {
                 newJobs[existingIndex] = {
                    ...newJobs[existingIndex],
                    status: status,
                    resultUrl: serverJob.resultUrl,
                    resultDims: serverJob.resultDims,
                    createdAt: serverJob.createdAt,
                    originalDims: serverJob.originalDims || newJobs[existingIndex].originalDims,
                    feedback: serverJob.feedback || newJobs[existingIndex].feedback,
                    progress: serverJob.progress,
                    error: serverJob.error || newJobs[existingIndex].error
                 };
              } else {
                 newJobs.push({
                    id: serverJob.id,
                    status: status,
                    originalUrl: serverJob.originalUrl,
                    resultUrl: serverJob.resultUrl,
                    resultDims: serverJob.resultDims,
                    originalDims: serverJob.originalDims,
                    createdAt: serverJob.createdAt,
                    feedback: serverJob.feedback || null,
                    progress: serverJob.progress,
                    error: serverJob.error
                 });
              }
           });
           
           // Filter out any that might have slipped in
           return newJobs
             .filter(j => !deletedJobIds.current.has(j.id))
             .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        });
      }
    } catch (e) { console.error("History error", e); } 
    finally { setIsLoadingHistory(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Polling
  useEffect(() => {
    const hasProcessing = jobs.some(j => j.status === 'processing' || j.status === 'uploading');
    if (!hasProcessing) return;
    const interval = setInterval(() => fetchHistory(), 2000);
    return () => clearInterval(interval);
  }, [jobs, fetchHistory]);

  const handleFeedback = async (jobId: string, vote: "like" | "dislike") => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, feedback: vote } : j));
    if (zoomedJob && zoomedJob.id === jobId) setZoomedJob(prev => prev ? { ...prev, feedback: vote } : null);
    try { await fetch("/api/feedback", { method: "POST", body: JSON.stringify({ jobId, vote }) }); } catch (e) {}
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newJobs: Job[] = Array.from(e.target.files).map((file) => {
        const url = URL.createObjectURL(file);
        const job: Job = { id: Math.random().toString(36).substr(2, 9), file, status: "idle", originalUrl: url, feedback: null };
        const img = new Image();
        img.onload = () => updateJob(job.id, { originalDims: { w: img.width, h: img.height } });
        img.src = url;
        return job;
      });
      setJobs((prev) => [...newJobs, ...prev]);
    }
  };

  // 🟢 FIX: Robust Delete Handler
  const removeJob = async (id: string) => {
    // 1. Add to ignore list immediately (prevents Polling resurrection)
    deletedJobIds.current.add(id);
    
    // 2. Optimistic Update
    setJobs(prev => prev.filter(j => j.id !== id));
    
    // 3. Server call (Assuming DELETE /api/history?id=xyz)
    try {
        await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
    } catch (e) {
        console.error("Failed to delete job on server", e);
    }
  };

  const updateJob = (id: string, updates: Partial<Job>) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));

  const runBatch = async () => {
    setIsBatchRunning(true);
    const queue = jobs.filter(j => j.status === "idle" || j.status === "error");
    const totalCost = queue.reduce((sum, job) => sum + getJobCost(job), 0);

    if (credits < totalCost) {
       alert(`Insufficient Credits.`);
       setIsBatchRunning(false);
       return;
    }
    for (const job of queue) await processSingleJob(job);
    setIsBatchRunning(false);
  };

  const processSingleJob = async (job: Job) => {
    const cost = getJobCost(job);
    if (credits < cost) return;
    if (!job.file) return; 
    
    setCredits(prev => Math.max(0, prev - cost));
    
    try {
      updateJob(job.id, { status: "uploading", step: "Uploading..." });
      
      const signRes = await fetch("/api/upload", {
        method: "POST",
        body: JSON.stringify({ fileType: job.file.type }),
      });
      if (!signRes.ok) throw new Error("Auth Failed");
      const { url, filename } = await signRes.json();

      await fetch(url, { method: "PUT", body: job.file, headers: { "Content-Type": job.file.type } });
      const publicUrl = `${R2_PUBLIC_DOMAIN}/${filename}`;
      
      let expansion = [0, 0, 0, 0]; 
      
      if (task === 'uncrop') {
         if (targetRatio === 'custom') {
            expansion = [zoomOut, zoomOut, zoomOut, zoomOut];
         } else {
            const { w, h } = job.originalDims || { w: 1000, h: 1000 };
            const currentRatio = w / h;
            const ratioValue = ASPECT_RATIOS.find(r => r.id === targetRatio)?.value || 1;
            
            if (currentRatio > ratioValue) {
               const newH = w / ratioValue;
               const addH = newH - h;
               const perSide = (addH / 2) / h;
               expansion = [0, 0, perSide, perSide];
            } else {
               const newW = h * ratioValue;
               const addW = newW - w;
               const perSide = (addW / 2) / w;
               expansion = [perSide, perSide, 0, 0];
            }
         }
      }

      updateJob(job.id, { status: "processing", step: "Queued...", originalUrl: publicUrl });

      const enhanceRes = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: publicUrl,
          task: task, 
          variant: variant,
          engine: engine,
          scale_factor: scale,
          strength: strength,
          enhance_face: enhanceFace,
          creativity: creativity,
          lighting_prompt: lighting,
          force_subject: subject,
          uncrop_expansion: expansion, 
          client_meta: {
            originalWidth: job.originalDims?.w || 0,
            originalHeight: job.originalDims?.h || 0,
          }
        }),
      });

      if (!enhanceRes.ok) throw new Error("Engine Busy");
      const data = await enhanceRes.json();

      updateJob(job.id, { id: data.jobId, status: "processing", step: "Processing..." });

    } catch (err: any) {
      console.error(err);
      setCredits(prev => prev + cost);
      updateJob(job.id, { status: "error", error: err.message });
    }
  };

  const downloadImage = (url: string, filename: string) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = `edited_${filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 text-foreground pb-20">
      <aside className="lg:w-80 flex-shrink-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Playground</h1>
          <p className="text-muted-foreground text-sm">AI Visual Intelligence Engine</p>
        </div>

        <div className={`rounded-lg border p-4 flex items-center justify-between shadow-sm transition-colors ${credits > 0 ? "bg-primary/5 border-primary/20" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${credits > 0 ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600"}`}><Coins className="w-5 h-5" /></div>
                <div><div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Balance</div><div className="text-lg font-bold">{credits} <span className="text-xs font-normal text-muted-foreground">Cr</span></div></div>
            </div>
            <a href="/dashboard/billing" className="text-xs font-medium text-primary hover:underline">Top Up</a>
        </div>

        <div className="sticky top-8 space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Sliders className="w-4 h-4"/> Select Task</h2>
            <div className="grid grid-cols-3 gap-2">
              {TASKS.map((t) => (
                <button 
                  key={t.id}
                  onClick={() => { setTask(t.id); setVariant("standard"); }}
                  className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-md border transition-all ${task === t.id ? "bg-primary/10 border-primary text-primary" : "bg-background border-input hover:bg-muted text-muted-foreground"}`}
                  title={t.desc}
                >
                  <t.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-6">
            {(task === 'sharpen' || task === 'denoise') && VARIANTS[task as keyof typeof VARIANTS] && (
               <div className="space-y-3">
                  <label className="text-sm font-medium">Model Variant</label>
                  <select value={variant} onChange={(e) => setVariant(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm">
                    {VARIANTS[task as keyof typeof VARIANTS].map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
               </div>
            )}

            {task === 'upscale' && (
              <>
                <div className="space-y-3">
                  <label className="text-sm font-medium">Engine</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setEngine("generative")} className={`py-2 px-2 rounded text-xs font-medium border ${engine === "generative" ? "bg-primary/10 border-primary text-primary" : "bg-background border-input"}`}>Generative (Creative)</button>
                    <button onClick={() => setEngine("fidelity")} className={`py-2 px-2 rounded text-xs font-medium border ${engine === "fidelity" ? "bg-primary/10 border-primary text-primary" : "bg-background border-input"}`}>Fidelity (Exact)</button>
                  </div>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between"><label className="text-sm font-medium">Scale</label><span className="text-xs text-muted-foreground">{scale}x</span></div>
                   <input type="range" min="1" max="4" step="1" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"/>
                </div>
              </>
            )}

            {task === 'uncrop' && (
               <div className="space-y-4">
                  <label className="text-sm font-medium">Target Aspect Ratio</label>
                  <div className="grid grid-cols-3 gap-2">
                     {ASPECT_RATIOS.map(ratio => (
                        <button
                           key={ratio.id}
                           onClick={() => setTargetRatio(ratio.id)}
                           className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs transition-all ${targetRatio === ratio.id ? "bg-primary/10 border-primary text-primary" : "bg-background hover:bg-muted text-muted-foreground"}`}
                        >
                           <ratio.icon className="w-4 h-4 mb-1" />
                           {ratio.id}
                        </button>
                     ))}
                  </div>
                  
                  {targetRatio === 'custom' && (
                     <div className="space-y-3 pt-2">
                        <div className="flex justify-between"><label className="text-sm font-medium">Expansion Amount</label><span className="text-xs text-muted-foreground">{Math.round(zoomOut * 100)}%</span></div>
                        <input type="range" min="0.1" max="0.8" step="0.1" value={zoomOut} onChange={(e) => setZoomOut(Number(e.target.value))} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"/>
                     </div>
                  )}
               </div>
            )}

            {['sharpen', 'denoise', 'relight', 'upscale'].includes(task) && (
               <div className="space-y-3">
                  <div className="flex justify-between"><label className="text-sm font-medium">{task === 'relight' ? 'Effect Strength' : 'Creativity / Strength'}</label><span className="text-xs text-muted-foreground">{Math.round(strength * 100)}%</span></div>
                  <input type="range" min="0.1" max="1.0" step="0.1" value={strength} onChange={(e) => { setStrength(Number(e.target.value)); setCreativity(Number(e.target.value)); }} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"/>
               </div>
            )}

            {(task === 'relight' || (task === 'upscale' && engine === 'generative')) && (
               <div className="space-y-3 pt-4 border-t border-dashed">
                  <label className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-500"/> Prompting</label>
                  <input type="text" placeholder={task === 'relight' ? "e.g. Sunset, Neon Lights..." : "e.g. Detailed texture..."} value={lighting} onChange={(e) => setLighting(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"/>
               </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-border">
               <label className="text-sm font-medium text-muted-foreground">Enhance Faces</label>
               <button onClick={() => setEnhanceFace(!enhanceFace)} className={`w-10 h-5 rounded-full transition-colors relative ${enhanceFace ? "bg-green-500" : "bg-muted"}`}>
                  <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${enhanceFace ? "left-6" : "left-1"}`} />
               </button>
            </div>

          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col pt-14">
        <div className="flex items-center justify-between mb-6 bg-card border border-border p-3 rounded-lg shadow-sm">
           <div className="flex items-center gap-6 px-4">
              <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Queue</span><span className="text-sm font-mono font-medium text-foreground">{jobs.length}</span></div>
              <div className="w-px h-8 bg-border"></div>
              <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Est. Time</span><span className="text-sm font-mono font-medium text-foreground">~{pendingJobs.length * (task === 'matting' ? 5 : 20)}s</span></div>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-muted border border-input rounded-md text-sm font-medium transition-colors"><UploadCloud className="w-4 h-4" /> Add Photos</button>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
              
              <button 
                  onClick={runBatch} 
                  disabled={isBatchRunning || pendingJobs.length === 0 || credits <= 0} 
                  className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all shadow-sm ${credits <= 0 ? "bg-red-100 text-red-600 border border-red-200" : pendingJobs.length > 0 ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground"}`}
              >
                  {isBatchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {credits <= 0 ? "No Credits" : isBatchRunning ? "Processing..." : pendingJobs.length > 0 ? `Run Batch (${batchCost} Cr)` : "Run Batch"}
              </button>
           </div>
        </div>

        {isLoadingHistory ? (
           <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {jobs.map((job) => (
              <div key={job.id} className={`group flex flex-col bg-card border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all ${job.status === 'error' ? 'border-red-300' : 'border-border'}`}>
                {/* CARD HEADER */}
                <div className={`px-4 py-3 border-b flex justify-between items-center ${job.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-muted/10 border-border'}`}>
                  <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{job.file?.name || `Job ${job.id.substr(0, 6)}`}</span>
                      
                      {/* 🟢 FIX: Better Error Display */}
                      {job.status === 'error' ? (
                        <div className="flex items-center gap-1 text-red-600">
                           <AlertCircle className="w-3 h-3" />
                           <span className="text-[10px] font-medium truncate max-w-[200px]" title={(job as any).error || "Unknown Error"}>{(job as any).error || "Failed"}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{job.status}</span>
                      )}
                  </div>
                  
                  {/* Close/Status Button */}
                  {job.status === 'idle' || job.status === 'error' || job.status === 'expired' ? (
                      <button onClick={() => removeJob(job.id)} className="text-muted-foreground hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                  ) : (
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${job.status === 'processing' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                         {job.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}{job.status}
                      </div>
                  )}
                </div>

                <div className="relative aspect-[3/2] bg-muted/20 w-full flex items-center justify-center overflow-hidden border-b border-border">
                  {/* 🟢 FIX: Handle Expired & Error Visuals */}
                  {job.status === 'expired' ? (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground"><Clock className="w-8 h-8 mb-2 opacity-50" /><span className="text-sm font-semibold">Image Expired</span></div>
                  ) : job.status === 'error' ? (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-red-400"><AlertCircle className="w-8 h-8 mb-2 opacity-50" /><span className="text-sm font-semibold">Generation Failed</span></div>
                  ) : job.status === "done" && job.originalUrl && job.resultUrl ? (
                    task === "matting" ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-[url('https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ftse1.mm.bing.net%2Fth%3Fid%3DOIP.8-sWfHk3qQk9qKqKqKqKqQHaHa%26pid%3DApi&f=1&ipt=e8f9c9c3e9c9c9c9c9c9c9c9c9c9c9c9&ipo=images')] bg-repeat opacity-100">
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px]" />
                            <img src={job.resultUrl} alt="Result" className="relative z-10 w-full h-full object-contain p-2" />
                        </div>
                    ) : (
                        <CompareSlider before={job.originalUrl} after={job.resultUrl} />
                    )
                  ) : (
                    <>
                      <img src={job.originalUrl} alt="Preview" className={`absolute inset-0 w-full h-full object-contain p-4 transition-all duration-700 ${job.status === 'idle' ? 'opacity-100' : 'opacity-50 blur-sm scale-95'}`}/>
                      {job.status === 'processing' && (
                        <div className="relative z-10 flex flex-col items-center gap-3 bg-card/90 backdrop-blur px-6 py-4 rounded-xl border border-border shadow-sm">
                           <div className="relative w-16 h-16 flex items-center justify-center">
                              <div className="absolute inset-0 rounded-full border-4 border-muted/30"></div>
                              <Loader2 className="w-16 h-16 text-primary animate-spin absolute" />
                              <span className="text-[10px] font-bold text-foreground z-10">{job.progress || 0}%</span>
                           </div>
                           <span className="text-xs font-medium text-foreground">Processing...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="p-3 bg-card flex justify-between items-center h-12">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {job.file && <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /><span>{formatBytes(job.file.size)}</span></div>}
                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-muted border border-border text-[10px] font-medium text-foreground">
                       <Coins className="w-3 h-3 text-muted-foreground" /><span>{getJobCost(job)} Cr</span>
                    </div>
                  </div>
                  {job.status === 'done' && job.resultUrl && !isJobExpired(job.createdAt) && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => setZoomedJob(job)} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"><Maximize2 className="w-4 h-4" /></button>
                        <button onClick={() => downloadImage(job.resultUrl!, job.file?.name || 'enhanced.png')} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"><Download className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {jobs.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-border rounded-xl h-96 flex flex-col items-center justify-center bg-muted/10 text-center p-8">
                <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center mb-4 border border-input shadow-sm"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
                <h3 className="text-base font-semibold text-foreground mb-1">Your Queue is Empty</h3>
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 mt-4 bg-background border border-input text-foreground rounded-md text-sm font-medium hover:bg-muted shadow-sm">Select Photos</button>
              </div>
            )}
          </div>
        )}
      </main>

      {zoomedJob && zoomedJob.originalUrl && zoomedJob.resultUrl && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border bg-background">
                 <h3 className="font-semibold text-foreground">Result Viewer</h3>
                 <button onClick={() => setZoomedJob(null)} className="p-1.5 hover:bg-muted rounded-md"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 bg-muted/20 relative p-4 flex items-center justify-center overflow-hidden">
                 <div className="relative inline-block shadow-lg"><CompareSlider before={zoomedJob.originalUrl} after={zoomedJob.resultUrl} isModal={true} /></div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}