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

// 📏 FILE SIZE LIMITS (matching deploy.py)
const MAX_OUTPUT_SIZE_MB = {
  png: 250,
  jpeg: 100,
};

const MAX_OUTPUT_DIMENSION = {
  standard: 8192,
  pro: 12288,
};

// 📊 Size estimation utilities
const estimateOutputSize = (
  width: number,
  height: number,
  scale: number,
  format: string
): number => {
  const outputPixels = (width * scale) * (height * scale);
  const bytesPerPixel = format === 'png' ? 3 : 0.2;
  const estimatedMB = (outputPixels * bytesPerPixel) / 1_000_000;
  return Math.round(estimatedMB);
};

const getSizeWarning = (
  width: number,
  height: number,
  scale: number,
  format: string,
  proMode: boolean
): { type: 'error' | 'warning' | null; message: string; suggestJPEG?: boolean } => {
  const outputW = width * scale;
  const outputH = height * scale;
  const maxDim = MAX_OUTPUT_DIMENSION[proMode ? 'pro' : 'standard'];
  const estimatedMB = estimateOutputSize(width, height, scale, format);
  const maxMB = MAX_OUTPUT_SIZE_MB[format as keyof typeof MAX_OUTPUT_SIZE_MB];

  // Check dimension limits
  if (Math.max(outputW, outputH) > maxDim) {
    return {
      type: 'error',
      message: `Output (${outputW}x${outputH}) exceeds ${maxDim}px limit. Reduce scale to ${Math.floor(maxDim / Math.max(width, height))}x or less.`
    };
  }

  // Check file size limits
  if (estimatedMB > maxMB) {
    if (format === 'png') {
      const jpegMB = estimateOutputSize(width, height, scale, 'jpeg');
      return {
        type: 'error',
        message: `Output would be ~${estimatedMB}MB PNG (limit: ${maxMB}MB). Switch to JPEG (~${jpegMB}MB) or reduce scale.`,
        suggestJPEG: true
      };
    } else {
      return {
        type: 'error',
        message: `Output would be ~${estimatedMB}MB (limit: ${maxMB}MB). Reduce scale to ${scale - 1}x or less.`
      };
    }
  }

  // Warning for large files (>100MB)
  if (estimatedMB > 100) {
    return {
      type: 'warning',
      message: `Large output: ~${estimatedMB}MB ${format.toUpperCase()}. Download may take time.`
    };
  }

  return { type: null, message: '' };
};

// 🏛️ THE PANTHEON - Mythological Model Branding
const PANTHEON_MODELS = [
  {
    id: "apollo",
    name: "Apollo",
    icon: Zap,
    emoji: "⚡",
    subtitle: "Fast Upscaling",
    desc: "Quick 1x-4x resolution boost with Real-ESRGAN. Best for speed.",
    engine: "standard",
    task: "upscale",
    speed: "5-15s",
    color: "#FFD700"
  },
  {
    id: "athena",
    name: "Athena",
    icon: Sparkles,
    emoji: "🦉",
    subtitle: "AI Creative Upscaling",
    desc: "Premium upscaling with generative AI. Adds stunning detail & texture.",
    engine: "generative",
    task: "upscale",
    speed: "60-120s",
    color: "#9370DB"
  },
  {
    id: "hephaestus",
    name: "Hephaestus",
    icon: Wand2,
    emoji: "🔨",
    subtitle: "Motion Blur Removal",
    desc: "Fix blurry, out-of-focus photos. Restores sharpness.",
    engine: "standard",
    task: "deblur",
    speed: "15-30s",
    color: "#CD7F32"
  },
  {
    id: "osiris",
    name: "Osiris",
    icon: Sun,
    emoji: "🌅",
    subtitle: "B&W Colorization",
    desc: "Add realistic color to black & white photos using AI.",
    engine: "standard",
    task: "colorize",
    speed: "48-68s",
    color: "#FF6B35"
  },
  {
    id: "isis",
    name: "Isis",
    icon: Sparkles,
    emoji: "✨",
    subtitle: "Complete Restoration",
    desc: "Full cleanup: removes noise, fixes blur, enhances sharpness.",
    engine: "standard",
    task: "restore",
    speed: "20-40s",
    color: "#4ECDC4"
  },
];

const COMING_SOON_GODS = [
  { id: "chronos", label: "Chronos", icon: Clock, emoji: "⏳", desc: "Age Progression" },
  { id: "morpheus", label: "Morpheus", icon: Wand2, emoji: "🎨", desc: "Artistic Styles" },
  { id: "anubis", label: "Anubis", icon: Scissors, emoji: "🐺", desc: "Background Removal" },
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

interface JobParams {
    model: string; // Pantheon model ID (apollo, athena, etc.)
    task: string; // Internal task (upscale, deblur, colorize, restore)
    engine: string; // standard or generative
    scale: number;
    creativity: number;
    lighting: string;
    enhanceFace: boolean;
    sharpenAmount: number;
    denoiseAmount: number;
    proMode: boolean;
    // Colorization (Osiris)
    colorize: boolean;
    colorizeRenderFactor: number;
    // Deblur (Hephaestus)
    deblur: boolean;
    // Output
    outputFormat: string; // "png" or "jpeg"
    jpegQuality: number;
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
  params: JobParams;
}

export default function Playground({ initialCredits = 0 }: { initialCredits?: number }) {
  // 🏛️ PANTHEON MODEL CONTROLS
  const [selectedModel, setSelectedModel] = useState("apollo"); // apollo, athena, hephaestus, osiris, isis

  // Universal Parameters
  const [scale, setScale] = useState(2); // Magnitude (1x-4x)
  const [creativity, setCreativity] = useState(0.65); // Inspiration (Athena only)
  const [enhanceFace, setEnhanceFace] = useState(true); // Essence
  const [lighting, setLighting] = useState(""); // Optional prompt (Athena only)
  const [sharpenAmount, setSharpenAmount] = useState(0.0); // Clarity (0-1.0)
  const [denoiseAmount, setDenoiseAmount] = useState(0.0); // Purity (0-1.0)
  const [proMode, setProMode] = useState(false); // Pro Mode (35 steps)

  // Colorization (Osiris)
  const [colorizeRenderFactor, setColorizeRenderFactor] = useState(35); // Fidelity (10-40)

  // Output Format
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg">("png");
  const [jpegQuality, setJpegQuality] = useState(95); // 80-100
  
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
    return calculateCost(job.originalDims.w, job.originalDims.h, job.params.scale);
  };

  const pendingJobs = jobs.filter(j => j.status === 'idle');
  const batchCost = pendingJobs.reduce((sum, job) => sum + getJobCost(job), 0);

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
              
              // 🏛️ Try to get model from client_meta first, then params, then existing job
              const existingJob = existingIndex !== -1 ? newJobs[existingIndex] : null;
              const modelFromServer = serverJob.client_meta?.model || serverJob.params?.model;
              const modelToUse = modelFromServer || existingJob?.params.model || "apollo";

              const jobParams: JobParams = serverJob.params ? {
                  model: modelToUse,
                  task: serverJob.task || existingJob?.params.task || "upscale",
                  engine: serverJob.engine || existingJob?.params.engine || "generative",
                  scale: serverJob.scale || existingJob?.params.scale || 2,
                  creativity: serverJob.params.creativity ?? existingJob?.params.creativity ?? 0.65,
                  lighting: serverJob.params.lighting_prompt || existingJob?.params.lighting || "",
                  enhanceFace: serverJob.params.enhance_face ?? existingJob?.params.enhanceFace ?? true,
                  sharpenAmount: serverJob.params.sharpen_amount ?? existingJob?.params.sharpenAmount ?? 0,
                  denoiseAmount: serverJob.params.denoise_amount ?? existingJob?.params.denoiseAmount ?? 0,
                  proMode: serverJob.params.pro_mode ?? existingJob?.params.proMode ?? false,
                  colorize: serverJob.params.colorize ?? existingJob?.params.colorize ?? false,
                  colorizeRenderFactor: serverJob.params.colorize_render_factor ?? existingJob?.params.colorizeRenderFactor ?? 35,
                  deblur: serverJob.params.deblur ?? existingJob?.params.deblur ?? false,
                  outputFormat: serverJob.params.output_format || existingJob?.params.outputFormat || "png",
                  jpegQuality: serverJob.params.jpeg_quality ?? existingJob?.params.jpegQuality ?? 95
              } : existingJob?.params || {
                  model: "apollo",
                  task: "upscale",
                  engine: "generative",
                  scale: 2,
                  creativity: 0.65,
                  lighting: "",
                  enhanceFace: true,
                  sharpenAmount: 0,
                  denoiseAmount: 0,
                  proMode: false,
                  colorize: false,
                  colorizeRenderFactor: 35,
                  deblur: false,
                  outputFormat: "png",
                  jpegQuality: 95
              };

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
                    params: jobParams
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
      const model = PANTHEON_MODELS.find(m => m.id === selectedModel);
      if (!model) return;

      const currentSettings: JobParams = {
          model: selectedModel,
          task: model.task,
          engine: model.engine,
          scale,
          creativity,
          lighting,
          enhanceFace,
          sharpenAmount,
          denoiseAmount,
          proMode,
          colorize: model.task === "colorize",
          colorizeRenderFactor,
          deblur: model.task === "deblur",
          outputFormat,
          jpegQuality
      };

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

      setJobs((prev) => [...newJobs, ...prev]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          sharpen_amount: job.params.sharpenAmount,
          denoise_amount: job.params.denoiseAmount,
          pro_mode: job.params.proMode,
          // Colorization (Osiris)
          colorize: job.params.colorize,
          colorize_render_factor: job.params.colorizeRenderFactor,
          // Deblur (Hephaestus)
          deblur: job.params.deblur,
          // Output format
          output_format: job.params.outputFormat,
          jpeg_quality: job.params.jpegQuality,
          client_meta: {
            model: job.params.model,
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Playground <span className="text-lg">🏛️</span>
          </h1>
          <p className="text-muted-foreground text-sm">The Pantheon of Image Enhancement</p>
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
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4"/> The Pantheon
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {PANTHEON_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`flex items-center gap-3 p-3 rounded-md border transition-all ${
                    selectedModel === model.id
                      ? "bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/20"
                      : "bg-background border-input hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <div className="text-2xl">{model.emoji}</div>
                  <div className="flex flex-col items-start flex-1">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-sm font-semibold">{model.name}</span>
                      <span className="text-[9px] text-muted-foreground/70 ml-auto">{model.speed}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/80">{model.subtitle}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* 🏛️ Show detailed description for selected model */}
            {(() => {
              const model = PANTHEON_MODELS.find(m => m.id === selectedModel);
              if (!model) return null;
              return (
                <div className="p-3 rounded-md bg-muted/30 border border-border">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">{model.emoji} {model.name}:</span> {model.desc}
                  </p>
                </div>
              );
            })()}
            <div className="pt-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">Coming Soon</div>
                <div className="grid grid-cols-3 gap-2 opacity-60">
                {COMING_SOON_GODS.map((god) => (
                    <div key={god.id} className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-md border bg-muted/30 border-border text-muted-foreground cursor-not-allowed">
                        <div className="text-lg">{god.emoji}</div>
                        <span className="text-[10px] font-medium">{god.label}</span>
                    </div>
                ))}
                </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-6">
            {(() => {
              const model = PANTHEON_MODELS.find(m => m.id === selectedModel);
              if (!model) return null;

              return (
                <>
                  {/* 🏛️ APOLLO & ATHENA - Upscale Parameters */}
                  {(selectedModel === 'apollo' || selectedModel === 'athena') && (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-sm font-medium">Magnitude</label>
                        <span className="text-xs text-muted-foreground font-mono">{scale}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        value={scale}
                        onChange={(e) => setScale(Number(e.target.value))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                        <span>1x</span><span>2x</span><span>3x</span><span>4x</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Upscaling strength</p>
                    </div>
                  )}

                  {/* 🏛️ ATHENA - Generative Controls */}
                  {selectedModel === 'athena' && (
                    <>
                      <div className="space-y-3 pt-4 border-t border-dashed">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Inspiration</label>
                          <span className="text-xs text-muted-foreground">{Math.round(creativity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.1"
                          value={creativity}
                          onChange={(e) => setCreativity(Number(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-[10px] text-muted-foreground">AI creativity level</p>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enhanceFace}
                            onChange={(e) => setEnhanceFace(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">Essence (Face Enhancement)</span>
                        </label>
                        <p className="text-[10px] text-muted-foreground">Eye protection + skin texture</p>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Sparkles className="w-3 h-3 text-amber-500"/> Optional Prompt
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. golden hour, film grain..."
                          value={lighting}
                          onChange={(e) => setLighting(e.target.value)}
                          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={proMode}
                            onChange={(e) => setProMode(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">Pro Mode</span>
                        </label>
                        <p className="text-[10px] text-muted-foreground">35 steps + higher guidance (slower)</p>
                      </div>
                    </>
                  )}

                  {/* 🏛️ OSIRIS - Colorization */}
                  {selectedModel === 'osiris' && (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <label className="text-sm font-medium">Fidelity</label>
                        <span className="text-xs text-muted-foreground font-mono">{colorizeRenderFactor}</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="40"
                        step="1"
                        value={colorizeRenderFactor}
                        onChange={(e) => setColorizeRenderFactor(Number(e.target.value))}
                        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-[10px] text-muted-foreground">Higher = better quality, slower processing</p>
                    </div>
                  )}

                  {/* 🏛️ ISIS - Restoration (Full Pipeline) */}
                  {selectedModel === 'isis' && (
                    <>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Purity (Denoise)</label>
                          <span className="text-xs text-muted-foreground">{Math.round(denoiseAmount * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.1"
                          value={denoiseAmount}
                          onChange={(e) => setDenoiseAmount(Number(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-[10px] text-muted-foreground">Remove noise and grain</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Clarity (Sharpen)</label>
                          <span className="text-xs text-muted-foreground">{Math.round(sharpenAmount * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.1"
                          value={sharpenAmount}
                          onChange={(e) => setSharpenAmount(Number(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-[10px] text-muted-foreground">Enhance edge details</p>
                      </div>
                    </>
                  )}

                  {/* 🏛️ Universal - Output Format */}
                  <div className="space-y-3 pt-4 border-t border-dashed">
                    <label className="text-sm font-medium">Output Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setOutputFormat("png")}
                        className={`py-2 px-2 rounded text-xs font-medium border transition-all ${
                          outputFormat === "png"
                            ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20"
                            : "bg-background border-input hover:bg-muted"
                        }`}
                      >
                        PNG (Lossless)
                      </button>
                      <button
                        onClick={() => setOutputFormat("jpeg")}
                        className={`py-2 px-2 rounded text-xs font-medium border transition-all ${
                          outputFormat === "jpeg"
                            ? "bg-primary/10 border-primary text-primary ring-1 ring-primary/20"
                            : "bg-background border-input hover:bg-muted"
                        }`}
                      >
                        JPEG (Smaller)
                      </button>
                    </div>
                    {outputFormat === "jpeg" && (
                      <div className="space-y-2 mt-2">
                        <div className="flex justify-between">
                          <label className="text-xs text-muted-foreground">JPEG Quality</label>
                          <span className="text-xs text-muted-foreground font-mono">{jpegQuality}%</span>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max="100"
                          step="5"
                          value={jpegQuality}
                          onChange={(e) => setJpegQuality(Number(e.target.value))}
                          className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    )}

                    {/* 📏 Size limits info */}
                    <div className="mt-3 p-2 bg-muted/30 rounded text-[10px] text-muted-foreground">
                      <div className="font-medium mb-1">File Size Limits:</div>
                      <div className="space-y-0.5">
                        <div>• PNG: 250MB max</div>
                        <div>• JPEG: 100MB max</div>
                        <div>• Max dimension: {proMode ? '12K' : '8K'} {proMode && '(Pro Mode)'}</div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
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
              <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileSelect} />
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

                        {/* 🏛️ Show settings preview when idle (queued) */}
                        {job.status === 'idle' && (() => {
                          const model = PANTHEON_MODELS.find(m => m.id === job.params.model);
                          if (!model) return null;
                          return (
                            <div className="absolute top-3 left-3 right-3 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{model.emoji}</span>
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-foreground">{model.name}</div>
                                  <div className="text-[10px] text-muted-foreground">{model.subtitle}</div>
                                </div>
                                <div className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded">{model.speed}</div>
                              </div>
                              <div className="flex flex-wrap gap-1.5 text-[10px]">
                                {job.params.task === 'upscale' && (
                                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{job.params.scale}x Scale</span>
                                )}
                                {job.params.model === 'athena' && (
                                  <>
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{Math.round(job.params.creativity * 100)}% Inspiration</span>
                                    {job.params.enhanceFace && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Face Enhancement</span>}
                                    {job.params.proMode && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Pro Mode</span>}
                                  </>
                                )}
                                {job.params.model === 'osiris' && (
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">Fidelity {job.params.colorizeRenderFactor}</span>
                                )}
                                {job.params.model === 'isis' && (
                                  <>
                                    {job.params.denoiseAmount > 0 && <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full font-medium">{Math.round(job.params.denoiseAmount * 100)}% Purity</span>}
                                    {job.params.sharpenAmount > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{Math.round(job.params.sharpenAmount * 100)}% Clarity</span>}
                                  </>
                                )}
                                <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium uppercase">{job.params.outputFormat}</span>

                                {/* 📏 Size warning/estimate */}
                                {job.originalDims && job.params.task === 'upscale' && (() => {
                                  const warning = getSizeWarning(
                                    job.originalDims.w,
                                    job.originalDims.h,
                                    job.params.scale,
                                    job.params.outputFormat,
                                    job.params.proMode
                                  );
                                  const estimatedMB = estimateOutputSize(
                                    job.originalDims.w,
                                    job.originalDims.h,
                                    job.params.scale,
                                    job.params.outputFormat
                                  );

                                  if (warning.type === 'error') {
                                    return (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        ~{estimatedMB}MB - Too large!
                                      </span>
                                    );
                                  } else if (warning.type === 'warning') {
                                    return (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        ~{estimatedMB}MB
                                      </span>
                                    );
                                  } else if (estimatedMB > 10) {
                                    // Show size for anything over 10MB
                                    return (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                                        ~{estimatedMB}MB
                                      </span>
                                    );
                                  }
                                })()}
                              </div>

                              {/* 🚨 Size warning message with JPEG suggestion */}
                              {job.originalDims && job.params.task === 'upscale' && (() => {
                                const warning = getSizeWarning(
                                  job.originalDims.w,
                                  job.originalDims.h,
                                  job.params.scale,
                                  job.params.outputFormat,
                                  job.params.proMode
                                );

                                if (warning.type) {
                                  return (
                                    <div className={`mt-2 p-2 rounded text-[10px] ${
                                      warning.type === 'error'
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                      <div className="font-medium mb-1">{warning.message}</div>
                                      {warning.suggestJPEG && (
                                        <button
                                          onClick={() => setOutputFormat('jpeg')}
                                          className="px-2 py-1 bg-white border border-current rounded text-[9px] font-semibold hover:bg-red-100 transition-colors"
                                        >
                                          Switch to JPEG
                                        </button>
                                      )}
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          );
                        })()}

                        {job.status === 'processing' && (
                          <div className="relative z-10 flex flex-col items-center gap-3 bg-card/90 backdrop-blur px-6 py-4 rounded-xl border border-border shadow-sm">
                             <div className="relative w-16 h-16 flex items-center justify-center"><div className="absolute inset-0 rounded-full border-4 border-muted/30"></div><Loader2 className="w-16 h-16 text-primary animate-spin absolute" /><span className="text-[10px] font-bold text-foreground z-10">{job.progress || 0}%</span></div>
                             <span className="text-xs font-medium text-foreground">Processing...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="p-3 bg-card flex justify-between items-center h-12">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-muted border border-border text-[10px] font-medium text-foreground">
                         {/* 🏛️ Show Pantheon model name */}
                         {(() => {
                           const model = PANTHEON_MODELS.find(m => m.id === job.params.model);
                           if (model) {
                             return (
                               <>
                                 <span>{model.emoji}</span>
                                 <span className="font-semibold">{model.name}</span>
                                 {job.params.task === 'upscale' && (
                                   <>
                                     <span className="text-border mx-1">|</span>
                                     <span>{job.params.scale}x</span>
                                   </>
                                 )}
                                 {job.params.model === 'athena' && (
                                   <>
                                     <span className="text-border mx-1">|</span>
                                     <span>{Math.round(job.params.creativity * 100)}% Inspiration</span>
                                   </>
                                 )}
                                 {job.params.model === 'osiris' && (
                                   <>
                                     <span className="text-border mx-1">|</span>
                                     <span>F{job.params.colorizeRenderFactor}</span>
                                   </>
                                 )}
                               </>
                             );
                           }
                           // Fallback for old jobs
                           return <span className="uppercase text-muted-foreground">{job.params.task}</span>;
                         })()}
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