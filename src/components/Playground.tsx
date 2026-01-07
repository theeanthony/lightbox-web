"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Loader2, UploadCloud, Sliders, Zap, Sparkles, 
  Aperture, Play, X, Image as ImageIcon,
  Download, Maximize2, FileText, Monitor, Check, Clock, 
  ThumbsUp, ThumbsDown, Coins, Scissors, Sun, Expand, Droplets, Activity,
  RectangleVertical, RectangleHorizontal, Square, Scan, AlertCircle,
  MoreVertical, Trash2, Wand2
} from "lucide-react"; 
import CompareSlider from "./CompareSlider";
import { calculateCost } from "@/lib/pricing";

// 🔧 CONFIGURATION
const R2_PUBLIC_DOMAIN = "https://pub-07de09a82f474da9b43b3ffbb54fb5f5.r2.dev"; 
const EXPIRATION_HOURS = 24;

const ACTIVE_TASKS = [
  { id: "upscale", label: "Upscale", icon: Activity, desc: "Increase resolution & quality" },
];

const COMING_SOON_TASKS = [
  { id: "matting", label: "Remove BG", icon: Scissors },
  { id: "relight", label: "Relight", icon: Sun },
  { id: "uncrop", label: "Uncrop", icon: Expand },
  { id: "sharpen", label: "Sharpen", icon: Aperture },
  { id: "denoise", label: "Denoise", icon: Droplets },
];

const getTimeRemaining = (createdAt?: string) => {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  const expiry = created + (EXPIRATION_HOURS * 60 * 60 * 1000);
  const now = Date.now();
  const diff = expiry - now;
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

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

const JobActionMenu = ({ onDelete }: { onDelete: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-8 z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in zoom-in-95 bg-white dark:bg-zinc-900">
          <button
            onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setIsOpen(false);
            }}
            className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-red-100 hover:text-red-600 transition-colors text-red-500"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete Asset
          </button>
        </div>
      )}
    </div>
  );
};

// 🟢 NEW: Interface now includes specific params for this job
interface JobParams {
    task: string;
    engine: string;
    scale: number;
    creativity: number;
    lighting: string;
    enhanceFace: boolean;
}

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
  params: JobParams; // 🟢 Snapshot of settings
}

export default function Playground({ initialCredits = 0 }: { initialCredits?: number }) {
  // GLOBAL CONTROLS (What will be applied to NEXT upload)
  const [task, setTask] = useState("upscale");
  const [engine, setEngine] = useState<"generative" | "fidelity">("generative");
  const [scale, setScale] = useState(2);
  const [creativity, setCreativity] = useState(0.65);
  const [enhanceFace, setEnhanceFace] = useState(true);
  const [lighting, setLighting] = useState("");
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [zoomedJob, setZoomedJob] = useState<Job | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [credits, setCredits] = useState(initialCredits);
  
  const deletedJobIds = useRef(new Set<string>());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCredits(initialCredits); }, [initialCredits]);

  const getJobCost = (job: Job) => {
    if (!job.originalDims) return 1; 
    // Use the params SNAPSHOTTED on the job, not global state
    return calculateCost(job.originalDims.w, job.originalDims.h, job.params.scale);
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
              if (deletedJobIds.current.has(serverJob.id)) return;

              const expired = isJobExpired(serverJob.createdAt);
              let status = expired ? 'expired' : serverJob.status;
              if (status === 'failed') status = 'error'; 
              
              const existingIndex = newJobs.findIndex(j => j.id === serverJob.id);
              
              // 🟢 Reconstruct params from server data if needed
              const jobParams: JobParams = serverJob.params ? {
                  task: serverJob.task || "upscale",
                  engine: serverJob.engine || "generative",
                  scale: serverJob.scale || 2,
                  creativity: serverJob.params.creativity || 0.65,
                  lighting: serverJob.params.lighting_prompt || "",
                  enhanceFace: serverJob.params.enhance_face ?? true
              } : { task: "upscale", engine: "generative", scale: 2, creativity: 0.65, lighting: "", enhanceFace: true };

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
                    error: serverJob.error || newJobs[existingIndex].error,
                    params: jobParams // Update params from server source of truth
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
                    error: serverJob.error,
                    params: jobParams
                 });
              }
           });
           
           return newJobs
             .filter(j => !deletedJobIds.current.has(j.id))
             .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        });
      }
    } catch (e) { console.error("History error", e); } 
    finally { setIsLoadingHistory(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    const hasProcessing = jobs.some(j => j.status === 'processing' || j.status === 'uploading');
    if (!hasProcessing) return;
    const interval = setInterval(() => fetchHistory(), 2000);
    return () => clearInterval(interval);
  }, [jobs, fetchHistory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // 1. Snapshot current settings
      const currentSettings: JobParams = {
          task,
          engine,
          scale,
          creativity,
          lighting,
          enhanceFace
      };

      // 2. Create Job Objects
      const newJobs: Job[] = Array.from(e.target.files).map((file) => {
        const url = URL.createObjectURL(file);
        const job: Job = { 
            id: Math.random().toString(36).substr(2, 9), 
            file, 
            status: "idle", 
            originalUrl: url, 
            feedback: null,
            params: { ...currentSettings }
        };
        const img = new Image();
        img.onload = () => updateJob(job.id, { originalDims: { w: img.width, h: img.height } });
        img.src = url;
        return job;
      });

      // 3. Add to State
      setJobs((prev) => [...newJobs, ...prev]);
    }

    // 🟢 CRITICAL FIX: Reset the input so the same file can be selected again
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const removeJob = async (id: string) => {
    deletedJobIds.current.add(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    try { await fetch(`/api/history?id=${id}`, { method: 'DELETE' }); } catch (e) {}
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
      
      updateJob(job.id, { status: "processing", step: "Queued...", originalUrl: publicUrl });

      // 🟢 USE JOB PARAMS (Snapshot), NOT GLOBAL STATE
      const enhanceRes = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          imageUrl: publicUrl,
          task: job.params.task, 
          engine: job.params.engine,
          scale_factor: job.params.scale,
          creativity: job.params.creativity,
          lighting_prompt: job.params.lighting,
          enhance_face: job.params.enhanceFace,
          uncrop_expansion: [0,0,0,0],
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
            <div className="grid grid-cols-1 gap-2">
              {ACTIVE_TASKS.map((t) => (
                <button key={t.id} onClick={() => setTask(t.id)} className={`flex items-center gap-3 p-3 rounded-md border transition-all ${task === t.id ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-background border-input hover:bg-muted text-muted-foreground"}`}>
                  <t.icon className="w-5 h-5" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground/80">{t.desc}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Coming Soon</div>
                <div className="grid grid-cols-3 gap-2 opacity-60">
                {COMING_SOON_TASKS.map((t) => (
                    <div key={t.id} className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-md border bg-muted/30 border-border text-muted-foreground cursor-not-allowed">
                        <t.icon className="w-4 h-4" /><span className="text-[10px] font-medium">{t.label}</span>
                    </div>
                ))}
                </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">Engine</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setEngine("generative")} className={`py-2 px-2 rounded text-xs font-medium border transition-all ${engine === "generative" ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20" : "bg-background border-input hover:bg-muted"}`}>Generative (Creative)</button>
                <button onClick={() => setEngine("fidelity")} className={`py-2 px-2 rounded text-xs font-medium border transition-all ${engine === "fidelity" ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20" : "bg-background border-input hover:bg-muted"}`}>Fidelity (Standard)</button>
              </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between"><label className="text-sm font-medium">Scale Factor</label><span className="text-xs text-muted-foreground font-mono">{scale}x</span></div>
                <input type="range" min="1" max="4" step="1" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"/>
                <div className="flex justify-between text-[10px] text-muted-foreground px-1"><span>1x</span><span>2x</span><span>3x</span><span>4x</span></div>
            </div>

            {engine === 'generative' && (
               <>
                <div className="space-y-3 pt-4 border-t border-dashed">
                    <div className="flex justify-between"><label className="text-sm font-medium">Texture Strength</label><span className="text-xs text-muted-foreground">{Math.round(creativity * 100)}%</span></div>
                    <input type="range" min="0.1" max="1.0" step="0.1" value={creativity} onChange={(e) => setCreativity(Number(e.target.value))} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"/>
                    <p className="text-[10px] text-muted-foreground">Controls how much new detail is added.</p>
                </div>
                <div className="space-y-3">
                    <label className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-3 h-3 text-amber-500"/> Optional Prompt</label>
                    <input type="text" placeholder="e.g. Leather texture, Film grain..." value={lighting} onChange={(e) => setLighting(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"/>
                </div>
               </>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col pt-14">
        <div className="flex items-center justify-between mb-6 bg-card border border-border p-3 rounded-lg shadow-sm">
           <div className="flex items-center gap-6 px-4">
              <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Queue</span><span className="text-sm font-mono font-medium text-foreground">{jobs.length}</span></div>
              <div className="w-px h-8 bg-border"></div>
              <div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Est. Time</span><span className="text-sm font-mono font-medium text-foreground">~{pendingJobs.length * 20}s</span></div>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-muted border border-input rounded-md text-sm font-medium transition-colors"><UploadCloud className="w-4 h-4" /> Add Photos</button>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
              <button onClick={runBatch} disabled={isBatchRunning || pendingJobs.length === 0 || credits <= 0} className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium transition-all shadow-sm ${credits <= 0 ? "bg-red-100 text-red-600 border border-red-200" : pendingJobs.length > 0 ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground"}`}>
                  {isBatchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {credits <= 0 ? "No Credits" : isBatchRunning ? "Processing..." : pendingJobs.length > 0 ? `Run Batch (${batchCost} Cr)` : "Run Batch"}
              </button>
           </div>
        </div>

        {isLoadingHistory ? (
           <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {jobs.map((job) => {
              const timeLeft = getTimeRemaining(job.createdAt);
              const isExpired = !timeLeft && job.status !== 'processing' && job.status !== 'uploading';

              return (
                <div key={job.id} className={`group flex flex-col bg-card border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all ${job.status === 'error' ? 'border-red-300' : 'border-border'}`}>
                  {/* CARD HEADER */}
                  <div className={`px-4 py-3 border-b flex justify-between items-center ${job.status === 'error' ? 'bg-red-50 border-red-100' : 'bg-muted/10 border-border'}`}>
                    <div className="flex flex-col min-w-0 gap-1">
                        <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{job.file?.name || `Job ${job.id.substr(0, 6)}`}</span>
                        <div className="flex items-center gap-2">
                          {job.status === 'error' ? (
                            <span className="text-[10px] font-medium text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Failed</span>
                          ) : (
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${job.status === 'processing' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                               {job.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                               {isExpired ? "EXPIRED" : job.status}
                            </div>
                          )}
                          {timeLeft && job.status === 'done' && (
                            <span className="flex items-center gap-1 text-[10px] font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100"><Clock className="w-3 h-3" />{timeLeft}</span>
                          )}
                        </div>
                    </div>
                    <JobActionMenu onDelete={() => removeJob(job.id)} />
                  </div>

                  {/* CARD BODY */}
                  <div className="relative aspect-[3/2] bg-muted/20 w-full flex items-center justify-center overflow-hidden border-b border-border">
                    {isExpired ? (
                      <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground"><Clock className="w-8 h-8 mb-2 opacity-50" /><span className="text-sm font-semibold">Image Expired</span><span className="text-xs text-muted-foreground/70">Deleted from secure storage</span></div>
                    ) : job.status === 'error' ? (
                      <div className="flex flex-col items-center justify-center text-center p-6 text-red-400"><AlertCircle className="w-8 h-8 mb-2 opacity-50" /><span className="text-sm font-semibold">Generation Failed</span></div>
                    ) : job.status === "done" && job.originalUrl && job.resultUrl ? (
                      <CompareSlider before={job.originalUrl} after={job.resultUrl} />
                    ) : (
                      <>
                        <img src={job.originalUrl} alt="Preview" className={`absolute inset-0 w-full h-full object-contain p-4 transition-all duration-700 ${job.status === 'idle' ? 'opacity-100' : 'opacity-50 blur-sm scale-95'}`}/>
                        {job.status === 'processing' && (
                          <div className="relative z-10 flex flex-col items-center gap-3 bg-card/90 backdrop-blur px-6 py-4 rounded-xl border border-border shadow-sm">
                             <div className="relative w-16 h-16 flex items-center justify-center"><div className="absolute inset-0 rounded-full border-4 border-muted/30"></div><Loader2 className="w-16 h-16 text-primary animate-spin absolute" /><span className="text-[10px] font-bold text-foreground z-10">{job.progress || 0}%</span></div>
                             <span className="text-xs font-medium text-foreground">Processing...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 🟢 FOOTER: Now shows specific params for THIS photo */}
                  <div className="p-3 bg-card flex justify-between items-center h-12">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-muted border border-border text-[10px] font-medium text-foreground">
                         <span className="uppercase text-muted-foreground">{job.params.engine}</span> 
                         <span className="text-border mx-1">|</span>
                         <span>{job.params.scale}x</span>
                         {job.params.engine === 'generative' && <><span className="text-border mx-1">|</span><span>{Math.round(job.params.creativity * 100)}%</span></>}
                      </div>
                    </div>
                    {job.status === 'done' && job.resultUrl && !isExpired && (
                      <div className="flex items-center gap-2">
                          <button onClick={() => setZoomedJob(job)} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"><Maximize2 className="w-4 h-4" /></button>
                          <button onClick={() => downloadImage(job.resultUrl!, job.file?.name || 'enhanced.png')} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"><Download className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
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