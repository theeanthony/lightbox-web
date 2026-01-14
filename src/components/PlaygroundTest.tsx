"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Upload, Download, Settings, Zap, Sparkles, Sun, Wand2,
  Info, AlertCircle, Check, Loader2, X, ChevronDown, Image as ImageIcon,
  Undo, Redo, Clock, ChevronRight, ZoomIn, ZoomOut, Maximize2 as ZoomReset,
  SlidersHorizontal, Columns2, Coins
} from "lucide-react";
import CompareSlider from "./CompareSlider";
import { calculateCost } from "@/lib/pricing";

// 🔧 CONFIGURATION
const R2_PUBLIC_DOMAIN = "https://pub-07de09a82f474da9b43b3ffbb54fb5f5.r2.dev";

// 🏛️ PANTHEON MODELS
const PANTHEON_MODELS = [
  {
    id: "apollo",
    name: "Apollo",
    emoji: "⚡",
    subtitle: "Fast Upscaling",
    description: "Quick 1x-4x resolution boost with Real-ESRGAN. Best for speed.",
    color: "from-amber-500 to-yellow-500",
    task: "upscale",
    engine: "standard",
  },
  {
    id: "athena",
    name: "Athena",
    emoji: "🦉",
    subtitle: "AI Creative Upscaling",
    description: "Premium upscaling with generative AI. Adds stunning detail & texture.",
    color: "from-purple-500 to-indigo-500",
    task: "upscale",
    engine: "generative",
  },
  {
    id: "hephaestus",
    name: "Hephaestus",
    emoji: "🔨",
    subtitle: "Motion Blur Removal",
    description: "Fix blurry, out-of-focus photos. Restores sharpness.",
    color: "from-orange-500 to-red-500",
    task: "deblur",
    engine: "deblur",
  },
  {
    id: "osiris",
    name: "Osiris",
    emoji: "🌅",
    subtitle: "B&W Colorization",
    description: "Add realistic color to black & white photos using AI.",
    color: "from-pink-500 to-rose-500",
    task: "colorize",
    engine: "standard",
  },
  {
    id: "isis",
    name: "Isis",
    emoji: "✨",
    subtitle: "Complete Restoration",
    description: "Full cleanup: removes noise, fixes blur, enhances sharpness.",
    color: "from-cyan-500 to-teal-500",
    task: "restore",
    engine: "standard",
  },
];

// 📏 FILE SIZE UTILITIES
const estimateOutputSize = (w: number, h: number, scale: number, format: string) => {
  const outputPixels = (w * scale) * (h * scale);
  const bytesPerPixel = format === 'png' ? 3 : 0.2;
  return Math.round((outputPixels * bytesPerPixel) / 1_000_000);
};

// 🔒 DIMENSION SANITIZATION
// Prevents NaN from propagating through the system
const sanitizeDimensions = (dims: { w: number; h: number } | null | undefined, fallback: { w: number; h: number }): { w: number; h: number } => {
  if (!dims || !dims.w || !dims.h || isNaN(dims.w) || isNaN(dims.h) || dims.w <= 0 || dims.h <= 0) {
    return fallback;
  }
  return dims;
};

// 📜 HISTORY SYSTEM TYPES
interface HistoryEntry {
  id: string;
  imageUrl: string;
  modelId: string;
  params: {
    scale?: number;
    creativity?: number;
    enhanceFace?: boolean;
    proMode?: boolean;
    outputFormat: string;
    colorizeRenderFactor?: number;
    denoiseAmount?: number;
    sharpenAmount?: number;
  };
  timestamp: Date;
  label: string; // e.g., "Original", "Apollo 2x", "Athena + Sharpen"
  parentId: string | null; // Points to parent entry for tree structure
  branchName?: string; // "Main", "Branch A", "Branch B", etc.
  children: string[]; // IDs of child entries
  outputDims?: { w: number; h: number }; // Output dimensions after processing
  status?: "processing" | "done" | "failed" | "error"; // Job status
  error?: string; // Error message if failed
}

interface Project {
  id: string;
  name: string;
  originalUrl: string;
  originalDims: { w: number; h: number };
  history: HistoryEntry[];
  currentIndex: number;
  createdAt: Date;
}

export default function PlaygroundTest({ initialCredits = 0 }: { initialCredits?: number }) {
  // State - Projects & History
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // For immediate button feedback

  // 💰 CREDIT MANAGEMENT
  // SECURITY NOTE: Client-side credit display is for UX only.
  // Server-side Firebase validation is the source of truth.
  const [credits, setCredits] = useState(initialCredits);

  // Sync credits when prop updates (from Firebase)
  useEffect(() => {
    setCredits(initialCredits);
  }, [initialCredits]);

  // Parameters
  const [selectedModel, setSelectedModel] = useState("apollo");
  const [scale, setScale] = useState(2);
  const [creativity, setCreativity] = useState(0.65);
  const [enhanceFace, setEnhanceFace] = useState(true);
  const [proMode, setProMode] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg">("png");
  const [colorizeRenderFactor, setColorizeRenderFactor] = useState(35);
  // ✅ FIX: Match Playground.tsx defaults (0.3/0.5 caused "plastic" look)
  const [denoiseAmount, setDenoiseAmount] = useState(0.0);
  const [sharpenAmount, setSharpenAmount] = useState(0.0);

  // Zoom and comparison state
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 0.5 = 50%, 2 = 200%
  const [comparisonMode, setComparisonMode] = useState<"slider" | "sidebyside">("slider");

  // Panning state for zoomed images
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // 🔄 HISTORY POLLING FOR JOB UPDATES
  // SECURITY NOTE: Backend validates auth and only returns user's own jobs
  const fetchJobUpdates = useCallback(async () => {
    try {
      const res = await fetch("/api/history", {
        cache: 'no-store',
        next: { revalidate: 0 } as any
      });

      if (!res.ok) return;

      const data = await res.json();

      // Update projects with job results
      setProjects(prevProjects => {
        return prevProjects.map(project => {
          let updatedHistory = [...project.history];
          let hasUpdates = false;

          // Check each history entry for job updates
          data.jobs.forEach((serverJob: any) => {
            const entryIndex = updatedHistory.findIndex(e => e.id === serverJob.id);

            if (entryIndex !== -1) {
              const entry = updatedHistory[entryIndex];

              // Update entry if job is complete and we have a result
              if (serverJob.status === 'done' && serverJob.resultUrl) {
                updatedHistory[entryIndex] = {
                  ...entry,
                  imageUrl: serverJob.resultUrl,
                  outputDims: serverJob.resultDims || entry.outputDims,
                  status: "done",
                };
                hasUpdates = true;

                // Update progress to 100% if this is the current entry
                if (entryIndex === project.currentIndex) {
                  setProgress(100);
                }
              }

              // Handle errors: Update status and reset dims to parent's dims
              if (serverJob.status === 'failed' || serverJob.status === 'error') {
                // Find parent entry to get correct input dimensions
                const parentEntry = entry.parentId
                  ? updatedHistory.find(e => e.id === entry.parentId)
                  : null;
                const parentDims = parentEntry?.outputDims || project.originalDims;

                updatedHistory[entryIndex] = {
                  ...entry,
                  status: "failed",
                  error: serverJob.error || "Enhancement failed",
                  // Reset outputDims to parent's dims (what it TRIED to process)
                  outputDims: sanitizeDimensions(parentDims, project.originalDims),
                };
                hasUpdates = true;

                if (entryIndex === project.currentIndex) {
                  setError(serverJob.error || "Enhancement failed");
                }
              }

              // Update progress
              if (serverJob.progress && entryIndex === project.currentIndex) {
                setProgress(Math.min(90, serverJob.progress));
              }
            }
          });

          return hasUpdates ? { ...project, history: updatedHistory } : project;
        });
      });
    } catch (err) {
      console.error("Failed to fetch job updates:", err);
    }
  }, []);

  // 🔄 PROCESSING STATE: Compute if ANY entry is processing (for polling)
  const hasProcessingEntries = useMemo(() => {
    return projects.some(project =>
      project.history.some(entry => entry.status === "processing")
    );
  }, [projects]);

  // Poll for updates while ANY entry is processing
  useEffect(() => {
    if (!hasProcessingEntries) return;

    const interval = setInterval(() => {
      fetchJobUpdates();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [hasProcessingEntries, fetchJobUpdates]);

  // Computed values
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const currentEntry = activeProject?.history[activeProject.currentIndex];
  const originalImage = activeProject?.originalUrl || null;
  const currentImage = currentEntry?.imageUrl || null; // Current viewing image
  const resultImage = currentEntry?.imageUrl || null;
  const originalDims = activeProject?.originalDims || null;

  // 🔒 SANITIZE DIMENSIONS: Prevent NaN from breaking cost calculations
  const safeFallback = originalDims || { w: 1000, h: 1000 };
  const currentDims = sanitizeDimensions(
    currentEntry?.outputDims || originalDims,
    safeFallback
  );

  // Check if current entry is processing
  const isCurrentEntryProcessing = currentEntry?.status === "processing";

  const canUndo = activeProject ? activeProject.currentIndex > 0 : false;
  const canRedo = activeProject ? activeProject.currentIndex < activeProject.history.length - 1 : false;

  const model = PANTHEON_MODELS.find((m) => m.id === selectedModel)!;
  const estimatedSize = originalDims
    ? estimateOutputSize(originalDims.w, originalDims.h, scale, outputFormat)
    : 0;

  // 💰 Calculate enhancement cost
  // SECURITY NOTE: This is UI display only. Backend validates cost with Firebase.
  const getEnhancementCost = () => {
    if (!currentDims) return 1;
    return calculateCost(currentDims.w, currentDims.h, scale);
  };
  const enhancementCost = getEnhancementCost();

  // 🚫 Check if current entry is failed (disable processing from failed state)
  const isCurrentEntryFailed = currentEntry?.status === "failed" || currentEntry?.status === "error";
  const canEnhance = originalImage && !isCurrentEntryProcessing && !isSubmitting && credits >= enhancementCost && !isCurrentEntryFailed;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🔒 SECURITY: Client-side file type validation
    // NOTE: This is UX only. Backend MUST re-validate file type.
    if (!file.type.startsWith('image/')) {
      setError("Please select a valid image file");
      return;
    }

    // 🔒 SECURITY: File size limit (client-side check for UX)
    // NOTE: Backend enforces actual limits
    const MAX_FILE_SIZE_MB = 50;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum ${MAX_FILE_SIZE_MB}MB allowed.`);
      return;
    }

    const url = URL.createObjectURL(file);
    setError(null);

    // Get dimensions
    const img = new Image();
    img.onload = () => {
      const projectId = Math.random().toString(36).substr(2, 9);
      const newProject: Project = {
        id: projectId,
        name: file.name,
        originalUrl: url,
        originalDims: { w: img.width, h: img.height },
        history: [
          {
            id: Math.random().toString(36).substr(2, 9),
            imageUrl: url,
            modelId: "original",
            params: { outputFormat: "png" },
            timestamp: new Date(),
            label: "Original",
            parentId: null,
            branchName: "Main",
            children: [],
            outputDims: { w: img.width, h: img.height },
          },
        ],
        currentIndex: 0,
        createdAt: new Date(),
      };

      setProjects((prev) => [newProject, ...prev]);
      setActiveProjectId(projectId);
    };
    img.src = url;
  };

  const handleEnhance = async () => {
    if (!activeProject || !currentImage || !currentDims) return;

    // 🔒 SECURITY: Validate credit balance BEFORE starting
    // NOTE: This is optimistic UI. Backend validates with Firebase (source of truth).
    const cost = enhancementCost;
    if (credits < cost) {
      setError("Insufficient credits. Please top up your balance.");
      return;
    }

    // 🔒 VALIDATE: Check dimension limits to prevent backend errors
    if (selectedModel === "apollo" || selectedModel === "athena") {
      const outputW = currentDims.w * scale;
      const outputH = currentDims.h * scale;
      const maxDim = 8192; // Standard mode limit (Pro mode: 12288)

      if (Math.max(outputW, outputH) > maxDim) {
        const maxScale = Math.floor(maxDim / Math.max(currentDims.w, currentDims.h));
        setError(
          `Output dimensions (${outputW}×${outputH}) would exceed ${maxDim}px limit. ` +
          `Reduce scale to ${maxScale}x or less.`
        );
        return;
      }
    }

    setIsSubmitting(true); // Disable button immediately
    setProgress(0);
    setError(null);

    // 💰 Optimistically deduct credits (will be refunded on error)
    // SECURITY NOTE: Actual deduction happens in Firebase on backend
    setCredits(prev => Math.max(0, prev - cost));

    try {
      // 🔒 STEP 1: Get the current entry's File object
      // We need to re-upload the current image if it's been processed
      // For now, we'll use the original file from the project
      const originalFile = activeProject.history[0].imageUrl;

      // Check if we have an actual file or just a URL
      let fileToUpload: Blob;
      if (currentImage.startsWith('blob:')) {
        // It's a blob URL, fetch it
        const response = await fetch(currentImage);
        fileToUpload = await response.blob();
      } else if (currentImage.startsWith('http')) {
        // It's already uploaded to R2, can use directly
        // Skip upload step
        fileToUpload = null as any; // Will use currentImage URL directly
      } else {
        throw new Error("Invalid image source");
      }

      let publicUrl = currentImage;

      // 🔒 STEP 2: Upload to R2 if needed (only for blob URLs)
      if (fileToUpload) {
        setProgress(10);

        // Get signed upload URL from backend
        // SECURITY: Backend validates auth token and generates time-limited signed URL
        const signRes = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileType: fileToUpload.type || "image/jpeg"
          }),
        });

        if (!signRes.ok) {
          const error = await signRes.json();
          throw new Error(error.error || "Failed to get upload URL");
        }

        const { url: signedUrl, filename } = await signRes.json();

        setProgress(20);

        // Upload file to R2 using signed URL
        // SECURITY: Uses pre-signed URL with expiration, no credentials exposed
        await fetch(signedUrl, {
          method: "PUT",
          body: fileToUpload,
          headers: { "Content-Type": fileToUpload.type || "image/jpeg" },
        });

        publicUrl = `${R2_PUBLIC_DOMAIN}/${filename}`;
        setProgress(30);
      }

      setProgress(40);

      // 🔒 STEP 3: Call enhancement API
      // SECURITY: Backend validates:
      // - Firebase auth token
      // - Credit balance in Firestore
      // - Parameter ranges (scale, creativity, etc.)
      // - Image URL is from trusted domain (R2)
      const enhanceRes = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: publicUrl,
          task: model.task,
          engine: model.engine,
          scale_factor: scale,
          creativity,
          lighting_prompt: "",
          enhance_face: enhanceFace,
          sharpen_amount: sharpenAmount,
          denoise_amount: denoiseAmount,
          pro_mode: proMode,
          // Model-specific params
          colorize: selectedModel === "osiris",
          colorize_render_factor: colorizeRenderFactor,
          deblur: selectedModel === "hephaestus",
          // Output format
          output_format: outputFormat,
          jpeg_quality: 95,
          // Metadata
          client_meta: {
            model: selectedModel,
            originalWidth: currentDims.w,
            originalHeight: currentDims.h,
          }
        }),
      });

      if (!enhanceRes.ok) {
        const error = await enhanceRes.json();
        throw new Error(error.error || "Enhancement failed");
      }

      const { jobId } = await enhanceRes.json();

      setProgress(50);

      // Create label for this edit
      const modelName = model.name;
      let label = modelName;
      if (selectedModel === "apollo" || selectedModel === "athena") {
        label += ` ${scale}x`;
      }
      if (selectedModel === "osiris") {
        label += ` F${colorizeRenderFactor}`;
      }

      // 🌳 BRANCHING LOGIC
      const currentEntryId = activeProject.history[activeProject.currentIndex].id;
      const isEditingFromMiddle = activeProject.currentIndex < activeProject.history.length - 1;

      // Determine branch name
      let newBranchName: string;
      if (isEditingFromMiddle) {
        // Creating a new branch - count existing branches from this point
        const existingBranches = activeProject.history
          .filter(e => e.parentId === currentEntryId)
          .map(e => e.branchName)
          .filter((name): name is string => name !== undefined);

        const branchLetters = existingBranches
          .map(name => name.replace('Branch ', ''))
          .filter(letter => letter.match(/^[A-Z]$/));

        // Find next available letter
        const nextLetter = String.fromCharCode(
          65 + (branchLetters.length === 0 ? 0 : Math.max(...branchLetters.map(l => l.charCodeAt(0) - 64)))
        );
        newBranchName = `Branch ${nextLetter}`;
      } else {
        // Continuing on current branch
        newBranchName = activeProject.history[activeProject.currentIndex].branchName || "Main";
      }

      // Calculate output dimensions based on CURRENT dimensions, not original
      const outputDims = (selectedModel === "apollo" || selectedModel === "athena")
        ? { w: currentDims.w * scale, h: currentDims.h * scale }
        : currentDims; // For other models, dimensions stay the same

      // Create new entry with jobId for tracking
      const newEntryId = jobId; // Use server job ID
      const newEntry: HistoryEntry = {
        id: newEntryId,
        imageUrl: publicUrl, // Will be updated when job completes
        modelId: selectedModel,
        params: {
          scale,
          creativity,
          enhanceFace,
          proMode,
          outputFormat,
          colorizeRenderFactor,
          denoiseAmount,
          sharpenAmount,
        },
        timestamp: new Date(),
        label,
        parentId: currentEntryId,
        branchName: newBranchName,
        children: [],
        outputDims,
        status: "processing", // Mark as processing initially
      };

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== activeProjectId) return p;

          // Add new entry to history
          const updatedHistory = [...p.history, newEntry];

          // Update parent's children array
          const parentIndex = updatedHistory.findIndex(e => e.id === currentEntryId);
          if (parentIndex !== -1) {
            updatedHistory[parentIndex] = {
              ...updatedHistory[parentIndex],
              children: [...updatedHistory[parentIndex].children, newEntryId],
            };
          }

          return {
            ...p,
            history: updatedHistory,
            currentIndex: updatedHistory.length - 1, // Move to new entry
          };
        })
      );

      // Job submitted successfully - will poll for updates
      setProgress(60);
      setIsSubmitting(false); // Re-enable button (entry status will keep it disabled if still processing)

    } catch (err: any) {
      console.error("Enhancement error:", err);

      // 💰 Refund credits on error (optimistic UI rollback)
      // SECURITY NOTE: If backend already deducted, Firebase will handle refund
      setCredits(prev => prev + cost);

      setError(err.message || "Enhancement failed. Please try again.");
      setIsSubmitting(false); // Re-enable button on error
    }
  };

  const handleUndo = () => {
    if (!canUndo || !activeProject) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, currentIndex: p.currentIndex - 1 } : p
      )
    );
  };

  const handleRedo = () => {
    if (!canRedo || !activeProject) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, currentIndex: p.currentIndex + 1 } : p
      )
    );
  };

  const jumpToHistoryEntry = (index: number) => {
    if (!activeProject) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, currentIndex: index } : p))
    );
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement("a");
    link.href = resultImage;
    link.download = `enhanced_${selectedModel}.${outputFormat}`;
    link.click();
  };

  // Pan handlers for zoomed images
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return; // Only enable panning when zoomed in
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;

    // Calculate new offset
    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;

    // Calculate max pan distance to prevent showing white space
    // When zoomed in, we can pan up to (zoom - 1) * 50% of container size
    const container = imageContainerRef.current;
    if (container) {
      const maxPanX = (container.offsetWidth * (zoomLevel - 1)) / 2;
      const maxPanY = (container.offsetHeight * (zoomLevel - 1)) / 2;

      // Clamp the offset
      setPanOffset({
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Reset pan offset when zoom changes or history changes
  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    if (newZoom <= 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Reset pan when navigating history
  const jumpToHistoryEntryWithReset = (index: number) => {
    setPanOffset({ x: 0, y: 0 });
    jumpToHistoryEntry(index);
  };

  const handleUndoWithReset = () => {
    setPanOffset({ x: 0, y: 0 });
    handleUndo();
  };

  const handleRedoWithReset = () => {
    setPanOffset({ x: 0, y: 0 });
    handleRedo();
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Custom Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-100%); }
          50% { transform: translateY(100vh); }
          100% { transform: translateY(100vh); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
      `}} />

      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏛️</div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Lightbox Pantheon
                </h1>
                <p className="text-xs text-slate-400">AI Image Enhancement</p>
              </div>
            </div>

            {/* 💰 Credit Balance Display */}
            {/* SECURITY NOTE: Display only. Backend validates actual balance via Firebase. */}
            <div className={`px-4 py-2 rounded-lg border flex items-center gap-3 transition-colors ${
              credits > 0
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-red-500/10 border-red-500/30"
            }`}>
              <div className={`p-1.5 rounded-full ${
                credits > 0 ? "bg-emerald-500/20" : "bg-red-500/20"
              }`}>
                <Coins className={`w-4 h-4 ${
                  credits > 0 ? "text-emerald-400" : "text-red-400"
                }`} />
              </div>
              <div>
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Balance
                </div>
                <div className="text-sm font-bold text-white">
                  {credits} <span className="text-xs font-normal text-slate-400">Cr</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Upload New Photo Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload New
            </button>

            {resultImage && activeProject && activeProject.currentIndex > 0 && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 transition-all text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Model Selector - NARROW LEFT COLUMN */}
        <div className="w-24 border-r border-slate-800/50 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center py-6 gap-2 relative z-50">
          {PANTHEON_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              title={m.name}
              className={`group relative w-16 h-16 rounded-xl flex items-center justify-center transition-all ${
                selectedModel === m.id
                  ? `bg-gradient-to-br ${m.color} shadow-lg scale-110`
                  : "bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600"
              }`}
            >
              <div className={`text-3xl transition-transform ${selectedModel === m.id ? 'scale-110' : 'group-hover:scale-105'}`}>
                {m.emoji}
              </div>
              {selectedModel === m.id && (
                <div className="absolute -right-1 -top-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              {/* Tooltip on hover */}
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] shadow-xl">
                <div className="text-sm font-semibold text-white">{m.name}</div>
                <div className="text-xs text-slate-400">{m.subtitle}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Parameters Panel - MIDDLE COLUMN */}
        <div className="w-80 border-r border-slate-800/50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Model Header & Description */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${model.color} flex items-center justify-center shadow-lg`}>
                  <div className="text-2xl">{model.emoji}</div>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">{model.name}</h2>
                  <p className="text-xs text-slate-400">{model.subtitle}</p>
                </div>
                {/* Image Dimensions */}
                {originalDims && (
                  <div className="text-right">
                    <div className="text-sm font-mono text-slate-300">
                      {originalDims.w} × {originalDims.h}
                    </div>
                    <div className="text-xs text-slate-500">
                      {Math.round((originalDims.w * originalDims.h) / 1_000_000)}MP
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {model.description}
                </p>
              </div>
            </div>

            {/* Parameters */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Parameters
              </h3>

              {/* Upscale Models */}
              {(selectedModel === "apollo" || selectedModel === "athena") && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-slate-300">Scale Factor</label>
                    <span className="text-sm font-mono text-slate-400">{scale}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="w-full accent-slate-400"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
                    <span>1x</span>
                    <span>2x</span>
                    <span>3x</span>
                    <span>4x</span>
                  </div>
                  {/* Show dimension limit warning */}
                  {currentDims && (() => {
                    const outputW = currentDims.w * scale;
                    const outputH = currentDims.h * scale;
                    const maxDim = 8192;
                    const wouldExceed = Math.max(outputW, outputH) > maxDim;

                    if (wouldExceed) {
                      const maxScale = Math.floor(maxDim / Math.max(currentDims.w, currentDims.h));
                      return (
                        <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                          <div className="flex items-center gap-1.5 text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-[10px]">
                              Output would be {outputW}×{outputH} (max: {maxDim}px). Reduce to {maxScale}x.
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Athena Specific */}
              {selectedModel === "athena" && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm text-slate-300">Creativity</label>
                      <span className="text-sm font-mono text-slate-400">
                        {Math.round(creativity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={creativity}
                      onChange={(e) => setCreativity(Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                  </div>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={enhanceFace}
                      onChange={(e) => setEnhanceFace(e.target.checked)}
                      className="w-4 h-4 rounded accent-purple-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-slate-200 font-medium">
                        Face Enhancement
                      </div>
                      <div className="text-xs text-slate-400">
                        Preserve eye identity, enhance skin
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 cursor-pointer hover:bg-slate-800/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={proMode}
                      onChange={(e) => setProMode(e.target.checked)}
                      className="w-4 h-4 rounded accent-amber-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-slate-200 font-medium">
                        Pro Mode
                      </div>
                      <div className="text-xs text-slate-400">
                        35 steps, slower but higher quality
                      </div>
                    </div>
                  </label>
                </>
              )}

              {/* Osiris Specific */}
              {selectedModel === "osiris" && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-slate-300">Fidelity</label>
                    <span className="text-sm font-mono text-slate-400">
                      {colorizeRenderFactor}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    step="1"
                    value={colorizeRenderFactor}
                    onChange={(e) => setColorizeRenderFactor(Number(e.target.value))}
                    className="w-full accent-pink-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Higher = better quality, slower
                  </p>
                </div>
              )}

              {/* Isis Specific */}
              {selectedModel === "isis" && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm text-slate-300">
                        Noise Reduction
                      </label>
                      <span className="text-sm font-mono text-slate-400">
                        {Math.round(denoiseAmount * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={denoiseAmount}
                      onChange={(e) => setDenoiseAmount(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm text-slate-300">Sharpening</label>
                      <span className="text-sm font-mono text-slate-400">
                        {Math.round(sharpenAmount * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={sharpenAmount}
                      onChange={(e) => setSharpenAmount(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>
                </>
              )}

              {/* Output Format */}
              <div className="pt-4 border-t border-slate-800">
                <label className="text-sm text-slate-300 mb-3 block">
                  Output Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOutputFormat("png")}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      outputFormat === "png"
                        ? "bg-slate-700 text-white ring-2 ring-slate-500"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => setOutputFormat("jpeg")}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                      outputFormat === "jpeg"
                        ? "bg-slate-700 text-white ring-2 ring-slate-500"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    JPEG
                  </button>
                </div>
              </div>

              {/* Size Estimate */}
              {originalDims && (selectedModel === "apollo" || selectedModel === "athena") && (
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Output Size:</span>
                      <span className="font-mono">
                        {originalDims.w * scale} × {originalDims.h * scale}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Est. File Size:</span>
                      <span
                        className={`font-mono ${
                          estimatedSize > 100
                            ? "text-amber-400"
                            : estimatedSize > 250
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                      >
                        ~{estimatedSize}MB
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Failed Entry Warning */}
            {isCurrentEntryFailed && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Enhancement Failed</span>
                </div>
                <p className="text-xs text-red-300">
                  {currentEntry?.error || "This enhancement failed. Navigate to a successful entry or the original to try again."}
                </p>
              </div>
            )}

            {/* Cost Estimate */}
            {currentDims && !isCurrentEntryFailed && (
              <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Estimated Cost:</div>
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span className={`text-sm font-bold font-mono ${
                      credits >= enhancementCost ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {enhancementCost} Cr
                    </span>
                  </div>
                </div>
                {credits < enhancementCost && (
                  <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Insufficient credits
                  </div>
                )}
              </div>
            )}

            {/* Enhance Button */}
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleEnhance}
                disabled={!canEnhance}
                className={`w-full py-4 rounded-xl font-semibold text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  isCurrentEntryProcessing || isSubmitting
                    ? "bg-slate-700"
                    : `bg-gradient-to-r ${model.color} hover:shadow-2xl hover:scale-[1.02]`
                }`}
              >
                {isCurrentEntryProcessing || isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isSubmitting ? "Submitting..." : "Processing..."}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5" />
                    Enhance with {model.name}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Image Viewer - RIGHT SIDE */}
        <div
          ref={imageContainerRef}
          className="flex-1 flex items-center justify-center bg-slate-950/50 relative overflow-hidden"
          style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {!originalImage ? (
            <div className="text-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="group relative"
              >
                <div className="w-64 h-64 rounded-2xl border-2 border-dashed border-slate-700 hover:border-slate-500 transition-all flex flex-col items-center justify-center gap-4 bg-slate-900/50 hover:bg-slate-800/50 cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-200">
                      Upload Image
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      or drag and drop
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <>
              <div className="absolute inset-0 p-8 flex items-center justify-center overflow-hidden">
                {/* Show comparison modes only if we have a result AND not currently processing */}
                {resultImage && activeProject && activeProject.currentIndex > 0 && !isCurrentEntryProcessing ? (
                  <div className="w-full h-full relative flex items-center justify-center">
                    {comparisonMode === "slider" ? (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                          transformOrigin: 'center center',
                          transition: isPanning ? 'none' : 'transform 0.2s'
                        }}
                      >
                        <CompareSlider
                          before={originalImage}
                          after={resultImage}
                          isModal={false}
                        />
                      </div>
                    ) : (
                      <div
                        className="w-full h-full flex gap-2 items-center justify-center"
                        style={{
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                          transformOrigin: 'center center',
                          transition: isPanning ? 'none' : 'transform 0.2s'
                        }}
                      >
                        <div className="flex-1 flex items-center justify-center max-h-full">
                          <img
                            src={originalImage}
                            alt="Before"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                          />
                        </div>
                        <div className="flex-1 flex items-center justify-center max-h-full">
                          <img
                            src={resultImage}
                            alt="After"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {currentImage && (
                      <img
                        src={currentImage}
                        alt="Current"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        style={{
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                          transformOrigin: 'center center',
                          transition: isPanning ? 'none' : 'transform 0.2s',
                          userSelect: 'none',
                          pointerEvents: isPanning ? 'none' : 'auto'
                        }}
                      />
                    )}
                    {isCurrentEntryProcessing && (
                      <div className="absolute inset-0 rounded-lg overflow-hidden">
                        {/* Animated Background Overlay */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm">
                          {/* Scanning Line Animation */}
                          <div className="absolute inset-0 overflow-hidden">
                            <div
                              className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${model.color} opacity-20 animate-scan`}
                            />
                          </div>

                          {/* Pulsing Grid Overlay */}
                          <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/20 animate-pulse" />
                          </div>

                          {/* Shimmer Effect */}
                          <div className="absolute inset-0 overflow-hidden opacity-30">
                            <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent w-1/2 animate-shimmer" />
                          </div>
                        </div>

                        {/* Center Progress Indicator */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center bg-slate-900/80 backdrop-blur-md px-8 py-6 rounded-2xl border border-slate-700/50 shadow-2xl">
                            <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-white" />
                            <div className="text-lg font-semibold mb-2">
                              Enhancing with {model.name}...
                            </div>
                            <div className="text-sm text-slate-300 mb-4">
                              {progress}% complete
                            </div>
                            <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${model.color} transition-all duration-300 shadow-lg`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dimension Labels Overlay - Bottom Right */}
              {currentDims && (
                <div className="absolute bottom-8 right-8 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg px-4 py-2 shadow-xl z-10">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-sm font-mono text-white font-medium">
                        {currentDims.w} × {currentDims.h}
                      </div>
                      <div className="text-xs text-slate-400">
                        {Math.round((currentDims.w * currentDims.h) / 1_000_000)}MP
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Floating Control Panel - Bottom */}
              {originalImage && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                  <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg p-2 shadow-2xl">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 px-2 border-r border-slate-700">
                      <button
                        onClick={() => handleZoomChange(Math.max(0.5, zoomLevel - 0.25))}
                        disabled={zoomLevel <= 0.5}
                        className="p-2 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono min-w-[3rem] text-center text-slate-300">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        onClick={() => handleZoomChange(Math.min(3, zoomLevel + 0.25))}
                        disabled={zoomLevel >= 3}
                        className="p-2 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleZoomChange(1)}
                        className="p-2 hover:bg-slate-800 rounded transition-colors"
                        title="Reset Zoom"
                      >
                        <ZoomReset className="w-4 h-4" />
                      </button>
                    </div>

                    {/* History Navigation */}
                    {activeProject && (
                      <div className="flex items-center gap-1 px-2 border-r border-slate-700">
                        <button
                          onClick={handleUndoWithReset}
                          disabled={!canUndo}
                          className="p-2 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Previous Edit"
                        >
                          <Undo className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono min-w-[2.5rem] text-center text-slate-400">
                          {activeProject.currentIndex + 1}/{activeProject.history.length}
                        </span>
                        <button
                          onClick={handleRedoWithReset}
                          disabled={!canRedo}
                          className="p-2 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Next Edit"
                        >
                          <Redo className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Comparison Mode Toggle (only show if we have a result) */}
                    {resultImage && activeProject && activeProject.currentIndex > 0 && !isCurrentEntryProcessing && (
                      <div className="flex items-center gap-1 px-2">
                        <button
                          onClick={() => setComparisonMode("slider")}
                          className={`p-2 rounded transition-colors ${
                            comparisonMode === "slider"
                              ? "bg-slate-700 text-white"
                              : "hover:bg-slate-800 text-slate-400"
                          }`}
                          title="Slider Comparison"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setComparisonMode("sidebyside")}
                          className={`p-2 rounded transition-colors ${
                            comparisonMode === "sidebyside"
                              ? "bg-slate-700 text-white"
                              : "hover:bg-slate-800 text-slate-400"
                          }`}
                          title="Side by Side"
                        >
                          <Columns2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Overlay */}
              {error && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-md rounded-lg px-6 py-4 border border-red-400/50 shadow-xl max-w-md z-10">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold mb-1">Enhancement Failed</div>
                      <div className="text-sm text-red-100">{error}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* History Sidebar - RIGHT COLUMN */}
        {activeProject && showHistory && (
          <div className="w-64 border-l border-slate-800/50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
            <div className="p-3 space-y-4">
              {/* Project Info */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Edit History
                  </h3>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 hover:bg-slate-800 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                <div className="text-xs text-slate-400 mb-1 truncate" title={activeProject.name}>
                  {activeProject.name}
                </div>
                <div className="text-xs text-slate-500">
                  {activeProject.originalDims.w} × {activeProject.originalDims.h}
                </div>
              </div>

              {/* History Timeline - Simplified Linear View (Figma-style) */}
              <div className="space-y-1.5">
                {(() => {
                  // Branch color mapping
                  const branchColors: Record<string, string> = {
                    "Main": "bg-slate-500",
                    "Branch A": "bg-purple-500",
                    "Branch B": "bg-blue-500",
                    "Branch C": "bg-pink-500",
                    "Branch D": "bg-cyan-500",
                    "Branch E": "bg-orange-500",
                  };

                  // Flatten tree into linear order using depth-first traversal
                  const flattenTree = (entryId: string): HistoryEntry[] => {
                    const entry = activeProject.history.find(e => e.id === entryId);
                    if (!entry) return [];

                    const result: HistoryEntry[] = [entry];

                    // Add children in order
                    entry.children.forEach(childId => {
                      result.push(...flattenTree(childId));
                    });

                    return result;
                  };

                  // Start from root and flatten
                  const root = activeProject.history.find(e => e.parentId === null);
                  const flatHistory = root ? flattenTree(root.id) : [];

                  // Group by branch for visual separation
                  let currentBranch = "";

                  return flatHistory.map((entry, idx) => {
                    const index = activeProject.history.indexOf(entry);
                    const isCurrent = index === activeProject.currentIndex;
                    const modelData = PANTHEON_MODELS.find((m) => m.id === entry.modelId);
                    const branchColor = branchColors[entry.branchName || "Main"] || "bg-slate-500";
                    const showBranchHeader = entry.branchName !== currentBranch && entry.branchName !== "Main" && idx > 0;
                    const isFailed = entry.status === "failed" || entry.status === "error";
                    const isProcessing = entry.status === "processing";

                    if (entry.branchName) {
                      currentBranch = entry.branchName;
                    }

                    return (
                      <div key={entry.id}>
                        {/* Branch Header (Figma-style section) */}
                        {showBranchHeader && (
                          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                            <div className={`w-2 h-2 rounded-full ${branchColor}`}></div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              {entry.branchName}
                            </div>
                            <div className="flex-1 h-px bg-slate-800"></div>
                          </div>
                        )}

                        {/* History Entry */}
                        <button
                          onClick={() => jumpToHistoryEntryWithReset(index)}
                          className={`w-full text-left p-2.5 rounded-lg transition-all group ${
                            isFailed
                              ? "bg-red-500/10 border border-red-500/30 hover:bg-red-500/20"
                              : isCurrent
                              ? "bg-slate-700/80 shadow-sm"
                              : "hover:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {/* Icon/Emoji */}
                            <div className="flex-shrink-0 w-8 h-8 rounded-md bg-slate-800/50 flex items-center justify-center text-base group-hover:scale-105 transition-transform">
                              {modelData ? modelData.emoji : "📷"}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Entry Name */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-medium truncate ${
                                  isCurrent ? "text-white" : "text-slate-300"
                                }`}>
                                  {entry.label}
                                </span>
                                {isFailed && (
                                  <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-red-500/20 text-red-400 rounded border border-red-500/30">
                                    FAILED
                                  </span>
                                )}
                                {isProcessing && (
                                  <Loader2 className="flex-shrink-0 w-3 h-3 text-slate-400 animate-spin" />
                                )}
                                {isCurrent && !isFailed && !isProcessing && (
                                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                )}
                              </div>

                              {/* Metadata Row */}
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                {/* Dimensions */}
                                {entry.outputDims && (
                                  <span className="font-mono">
                                    {entry.outputDims.w} × {entry.outputDims.h}
                                  </span>
                                )}

                                {/* Separator */}
                                {entry.outputDims && (
                                  <span>•</span>
                                )}

                                {/* Time */}
                                <span>
                                  {entry.timestamp.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              {/* Branch Badge (inline, Figma-style) */}
                              {entry.branchName && entry.branchName !== "Main" && (
                                <div className="flex items-center gap-1 mt-1">
                                  <div className={`px-1.5 py-0.5 rounded ${branchColor} bg-opacity-20 flex items-center gap-1`}>
                                    <div className={`w-1 h-1 rounded-full ${branchColor}`}></div>
                                    <span className="text-[9px] font-medium text-slate-300">
                                      {entry.branchName}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Project Switcher (if multiple projects) */}
              {projects.length > 1 && (
                <div className="pt-4 border-t border-slate-800">
                  <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Other Projects
                  </div>
                  <div className="space-y-1">
                    {projects
                      .filter((p) => p.id !== activeProjectId)
                      .slice(0, 3)
                      .map((project) => (
                        <button
                          key={project.id}
                          onClick={() => setActiveProjectId(project.id)}
                          className="w-full text-left p-2 rounded hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="text-xs text-slate-300 truncate">
                            {project.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {project.history.length} edit{project.history.length !== 1 ? 's' : ''}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Show History Toggle (when hidden) */}
        {activeProject && !showHistory && (
          <button
            onClick={() => setShowHistory(true)}
            className="absolute right-4 top-24 p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors shadow-lg"
          >
            <Clock className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

