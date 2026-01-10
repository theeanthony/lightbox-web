# Web Editor Integration Guide
## Integrating Lightbox Engine with an Image Editor

**Created:** January 10, 2026
**Purpose:** Gameplan for integrating an existing web image editor with the Lightbox Engine deployment

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Integration Approaches](#integration-approaches)
3. [API Integration Patterns](#api-integration-patterns)
4. [UI/UX Patterns](#uiux-patterns)
5. [Code Examples](#code-examples)
6. [Migration Strategy](#migration-strategy)
7. [Best Practices](#best-practices)

---

## 🏗️ Architecture Overview

### Current Stack
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Playground  │  │  Web Editor  │  │   Dashboard  │  │
│  │  Component   │  │  (Your UI)   │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────┬────────────────────────────────────────────┘
             │ HTTP POST
             ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (/api/enhance)          │
│  • Authentication (Session/API Key)                     │
│  • Rate Limiting (10 req/min)                          │
│  • Credit Deduction                                     │
│  • Job Creation (Firestore)                            │
└────────────┬────────────────────────────────────────────┘
             │ HTTP POST (async)
             ▼
┌─────────────────────────────────────────────────────────┐
│           Modal Serverless (Lightbox Engine)            │
│  🏛️ The Pantheon of Image Enhancement                  │
│  ┌───────────────────────────────────────────────────┐ │
│  │ ⚡ Apollo       - StandardUpscaleEngine (5-15s)  │ │
│  │ 🦉 Athena       - GenerativeUpscaleEngine (60s)  │ │
│  │ 🔨 Hephaestus   - DeblurEngine (15-30s)          │ │
│  │ 🌅 Osiris       - ColorizeEngine (48-68s)        │ │
│  │ ✨ Isis         - RestorationEngine (20-40s)     │ │
│  └───────────────────────────────────────────────────┘ │
└────────────┬────────────────────────────────────────────┘
             │ Webhook (result)
             ▼
┌─────────────────────────────────────────────────────────┐
│         Next.js API (/api/webhooks/modal)               │
│  • Updates Firestore with result                       │
│  • Stores R2 URL                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🔌 Integration Approaches

### **Option 1: Embedded Enhancement (Recommended)**
Integrate Pantheon models as enhancement tools **within** your existing editor.

**Use Case:** You have a Photopea/Figma-style editor where users can apply AI enhancements to layers.

**Pros:**
- Seamless UX (no context switching)
- Editor state preserved
- Can combine manual edits + AI
- Layer-aware processing

**Cons:**
- More complex integration
- Need to handle async operations in editor

**Example Flow:**
```
User edits image → Clicks "Enhance with Athena" →
Image sent to API → Result returned as new layer →
User continues editing
```

---

### **Option 2: Pre-Processing Pipeline**
Use Pantheon models as a **pre-processing** step before entering the editor.

**Use Case:** You want to upscale/restore images before users edit them.

**Pros:**
- Simple integration
- Clear separation of concerns
- Fast editor performance (processed images ready)

**Cons:**
- Can't apply enhancements to edited images
- Users must choose enhancements upfront

**Example Flow:**
```
User uploads → Selects Pantheon model → Processing →
Enhanced image loaded into editor → User edits
```

---

### **Option 3: Post-Processing Export**
Apply Pantheon models as **export filters** when users save/export.

**Use Case:** Users edit normally, then choose enhancement on export.

**Pros:**
- Non-destructive workflow
- Preserve original edits
- Multiple export variants

**Cons:**
- Slower export process
- May surprise users with wait time

**Example Flow:**
```
User edits → Clicks "Export" → Selects "Upscale 4x with Apollo" →
Processing → Download enhanced result
```

---

### **Option 4: Hybrid Approach** ⭐ **RECOMMENDED**
Combine all three approaches with smart UX.

**Implementation:**
- **Pre-process:** Offer upscale on upload
- **Embedded:** Add "Enhance Layer" tool in editor
- **Post-process:** Enhancement options in export dialog

---

## 📡 API Integration Patterns

### **Pattern 1: Direct API Calls (Simple)**

**When to use:** Small editor, low complexity

```typescript
// In your editor component
async function enhanceImage(imageBlob: Blob, model: string) {
  // 1. Upload to R2
  const uploadRes = await fetch('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ fileType: imageBlob.type })
  });
  const { url, filename } = await uploadRes.json();

  await fetch(url, {
    method: 'PUT',
    body: imageBlob,
    headers: { 'Content-Type': imageBlob.type }
  });

  const publicUrl = `https://pub-07de09a82f474da9b43b3ffbb54fb5f5.r2.dev/${filename}`;

  // 2. Trigger enhancement
  const enhanceRes = await fetch('/api/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: publicUrl,
      task: PANTHEON_MODELS.find(m => m.id === model).task,
      engine: PANTHEON_MODELS.find(m => m.id === model).engine,
      scale_factor: 2,
      creativity: 0.65,
      // ... other params based on model
    })
  });

  const { jobId } = await enhanceRes.json();

  // 3. Poll for result
  return pollForResult(jobId);
}

async function pollForResult(jobId: string) {
  const interval = setInterval(async () => {
    const res = await fetch('/api/history');
    const { jobs } = await res.json();
    const job = jobs.find(j => j.id === jobId);

    if (job?.status === 'done') {
      clearInterval(interval);
      return job.resultUrl;
    }
  }, 2000);
}
```

---

### **Pattern 2: React Hook (Reusable)**

**When to use:** Multiple editor components, consistent UX

```typescript
// hooks/useLightboxEnhance.ts
import { useState, useCallback } from 'react';

interface EnhanceOptions {
  model: 'apollo' | 'athena' | 'hephaestus' | 'osiris' | 'isis';
  scale?: number;
  creativity?: number;
  outputFormat?: 'png' | 'jpeg';
}

export function useLightboxEnhance() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const enhance = useCallback(async (
    imageBlob: Blob,
    options: EnhanceOptions
  ): Promise<string | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      // 1. Upload
      setProgress(10);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ fileType: imageBlob.type })
      });
      const { url, filename } = await uploadRes.json();

      setProgress(20);
      await fetch(url, {
        method: 'PUT',
        body: imageBlob,
        headers: { 'Content-Type': imageBlob.type }
      });

      const publicUrl = `https://pub-07de09a82f474da9b43b3ffbb54fb5f5.r2.dev/${filename}`;

      // 2. Trigger processing
      setProgress(30);
      const modelConfig = PANTHEON_MODELS.find(m => m.id === options.model);

      const enhanceRes = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: publicUrl,
          task: modelConfig.task,
          engine: modelConfig.engine,
          scale_factor: options.scale || 2,
          creativity: options.creativity || 0.65,
          output_format: options.outputFormat || 'png',
          // Auto-populate based on model
          colorize: modelConfig.task === 'colorize',
          deblur: modelConfig.task === 'deblur',
          client_meta: { model: options.model }
        })
      });

      const { jobId } = await enhanceRes.json();

      // 3. Poll for result
      setProgress(40);
      const resultUrl = await pollForCompletion(jobId, (p) => {
        setProgress(40 + (p * 0.6)); // 40% to 100%
      });

      setProgress(100);
      setIsProcessing(false);
      return resultUrl;

    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
      return null;
    }
  }, []);

  return { enhance, isProcessing, progress, error };
}

// Helper function
async function pollForCompletion(
  jobId: string,
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/history');
        const { jobs } = await res.json();
        const job = jobs.find(j => j.id === jobId);

        if (!job) return;

        if (job.progress) {
          onProgress(job.progress / 100);
        }

        if (job.status === 'done' && job.resultUrl) {
          clearInterval(interval);
          resolve(job.resultUrl);
        } else if (job.status === 'error') {
          clearInterval(interval);
          reject(new Error(job.error || 'Processing failed'));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 2000);
  });
}
```

**Usage in Editor:**
```tsx
function ImageEditor() {
  const { enhance, isProcessing, progress } = useLightboxEnhance();
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  const handleEnhance = async () => {
    // Get current canvas as blob
    const canvas = canvasRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });

    // Enhance with Athena
    const resultUrl = await enhance(blob, {
      model: 'athena',
      scale: 2,
      creativity: 0.75,
      outputFormat: 'png'
    });

    if (resultUrl) {
      // Load result into editor
      loadImageIntoCanvas(resultUrl);
    }
  };

  return (
    <div>
      <canvas ref={canvasRef} />
      <button onClick={handleEnhance} disabled={isProcessing}>
        {isProcessing ? `Enhancing... ${progress}%` : 'Enhance with Athena'}
      </button>
    </div>
  );
}
```

---

### **Pattern 3: Context Provider (Global State)**

**When to use:** Complex editor with multiple components needing enhancement

```typescript
// contexts/LightboxContext.tsx
import { createContext, useContext, useState } from 'react';

interface LightboxContextValue {
  jobs: Job[];
  enhance: (blob: Blob, options: EnhanceOptions) => Promise<string>;
  cancelJob: (jobId: string) => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);

  const enhance = async (blob: Blob, options: EnhanceOptions) => {
    // Implementation...
    const newJob = { id: uuid(), status: 'processing', ... };
    setJobs(prev => [...prev, newJob]);
    // ... process and update job
  };

  return (
    <LightboxContext.Provider value={{ jobs, enhance, cancelJob }}>
      {children}
    </LightboxContext.Provider>
  );
}

export const useLightbox = () => {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error('useLightbox must be used within LightboxProvider');
  return ctx;
};
```

---

## 🎨 UI/UX Patterns

### **Pattern 1: Inline Enhancement Panel**

Add a Pantheon panel to your editor toolbar:

```tsx
<EditorToolbar>
  <ToolSection name="Pantheon">
    <ModelSelector
      models={PANTHEON_MODELS}
      selected={selectedModel}
      onChange={setSelectedModel}
    />
    <Button onClick={enhanceCurrentLayer}>
      Enhance Layer
    </Button>
  </ToolSection>
</EditorToolbar>
```

**Visual Design:**
```
┌─────────────────────────────────────────────┐
│ Editor Toolbar                              │
│ ┌─────────┬─────────┬─────────┬──────────┐ │
│ │  Brush  │ Select  │ Text    │ 🏛️ Pantheon │ │
│ └─────────┴─────────┴─────────┴──────────┘ │
│                                             │
│ Pantheon Panel:                             │
│ ┌──────────────────────────────────────┐   │
│ │ ⚡ Apollo  (Fast Upscale)      5-15s │   │
│ │ 🦉 Athena  (AI Creative)      60s   ◀─── │
│ │ 🔨 Hephaestus (Deblur)        15-30s│   │
│ │ 🌅 Osiris (Colorize)          48s   │   │
│ │ ✨ Isis   (Restoration)       20s   │   │
│ └──────────────────────────────────────┘   │
│                                             │
│ Parameters:                                 │
│ Scale: [====●====] 2x                       │
│ Creativity: [========●==] 75%               │
│                                             │
│ [Enhance Current Layer]                     │
└─────────────────────────────────────────────┘
```

---

### **Pattern 2: Layer Effects**

Treat enhancements as non-destructive layer effects:

```tsx
interface Layer {
  id: string;
  image: ImageData;
  effects: LayerEffect[];
}

interface LayerEffect {
  type: 'pantheon';
  model: 'apollo' | 'athena' | ...;
  params: EnhanceOptions;
  resultUrl?: string;
  status: 'pending' | 'processing' | 'done';
}

// In your layer panel
<Layer>
  <LayerImage src={layer.image} />
  <Effects>
    {layer.effects.map(effect => (
      <EffectBadge key={effect.id}>
        {effect.type === 'pantheon' && (
          <PantheonBadge model={effect.model} status={effect.status} />
        )}
      </EffectBadge>
    ))}
  </Effects>
</Layer>
```

---

### **Pattern 3: Export Dialog Integration**

Add Pantheon to export options:

```tsx
<ExportDialog>
  <Section>
    <h3>Enhancement (Optional)</h3>
    <RadioGroup>
      <Radio value="none">No Enhancement</Radio>
      <Radio value="apollo">⚡ Upscale 2x (Apollo) +5s</Radio>
      <Radio value="athena">🦉 AI Upscale 4x (Athena) +60s</Radio>
    </RadioGroup>
  </Section>

  <Section>
    <h3>Format</h3>
    <RadioGroup>
      <Radio value="png">PNG (Lossless)</Radio>
      <Radio value="jpeg">JPEG (Smaller file)</Radio>
    </RadioGroup>
  </Section>

  <Button onClick={handleExport}>
    Export {enhancement !== 'none' && '& Enhance'}
  </Button>
</ExportDialog>
```

---

## 💻 Code Examples

### **Example 1: Canvas Editor Integration**

```typescript
// ImageEditor.tsx
import { useRef, useState } from 'react';
import { useLightboxEnhance } from '@/hooks/useLightboxEnhance';

export function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { enhance, isProcessing, progress } = useLightboxEnhance();
  const [selectedModel, setSelectedModel] = useState<string>('apollo');

  // Load enhanced result back into canvas
  const loadImageIntoCanvas = (url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
    };
    img.src = url;
  };

  // Get current canvas state as blob
  const getCanvasBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      canvasRef.current?.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to get canvas blob'));
      }, 'image/png');
    });
  };

  const handleEnhance = async () => {
    const blob = await getCanvasBlob();
    const model = PANTHEON_MODELS.find(m => m.id === selectedModel);

    const resultUrl = await enhance(blob, {
      model: selectedModel as any,
      scale: 2,
      creativity: model?.engine === 'generative' ? 0.75 : 0,
      outputFormat: 'png'
    });

    if (resultUrl) {
      loadImageIntoCanvas(resultUrl);
    }
  };

  return (
    <div className="editor-container">
      <div className="toolbar">
        <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
          {PANTHEON_MODELS.map(model => (
            <option key={model.id} value={model.id}>
              {model.emoji} {model.name} ({model.speed})
            </option>
          ))}
        </select>
        <button onClick={handleEnhance} disabled={isProcessing}>
          {isProcessing ? `Enhancing... ${Math.round(progress)}%` : 'Enhance'}
        </button>
      </div>

      <canvas ref={canvasRef} className="editor-canvas" />

      {isProcessing && (
        <div className="progress-overlay">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>Processing with {selectedModel}...</span>
        </div>
      )}
    </div>
  );
}
```

---

### **Example 2: Layer-Based Editor**

```typescript
// LayerEditor.tsx
import { useState } from 'react';
import { useLightboxEnhance } from '@/hooks/useLightboxEnhance';

interface Layer {
  id: string;
  name: string;
  imageUrl: string;
  pantheonEffect?: {
    model: string;
    resultUrl?: string;
    status: 'processing' | 'done' | 'error';
  };
}

export function LayerEditor() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const { enhance } = useLightboxEnhance();

  const applyPantheonToLayer = async (layerId: string, model: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    // Update layer to show processing
    setLayers(prev => prev.map(l =>
      l.id === layerId
        ? { ...l, pantheonEffect: { model, status: 'processing' } }
        : l
    ));

    // Fetch image as blob
    const response = await fetch(layer.imageUrl);
    const blob = await response.blob();

    // Enhance
    const resultUrl = await enhance(blob, { model: model as any });

    // Update layer with result
    if (resultUrl) {
      setLayers(prev => prev.map(l =>
        l.id === layerId
          ? {
              ...l,
              pantheonEffect: { model, resultUrl, status: 'done' },
              imageUrl: resultUrl // Replace layer image
            }
          : l
      ));
    }
  };

  return (
    <div className="layer-editor">
      <div className="layers-panel">
        {layers.map(layer => (
          <div
            key={layer.id}
            className={`layer ${selectedLayerId === layer.id ? 'selected' : ''}`}
            onClick={() => setSelectedLayerId(layer.id)}
          >
            <img src={layer.imageUrl} alt={layer.name} />
            <span>{layer.name}</span>
            {layer.pantheonEffect && (
              <span className="effect-badge">
                {PANTHEON_MODELS.find(m => m.id === layer.pantheonEffect!.model)?.emoji}
                {layer.pantheonEffect.status === 'processing' && ' ⏳'}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="pantheon-panel">
        <h3>🏛️ Enhance Layer</h3>
        {PANTHEON_MODELS.map(model => (
          <button
            key={model.id}
            onClick={() => selectedLayerId && applyPantheonToLayer(selectedLayerId, model.id)}
            disabled={!selectedLayerId}
          >
            {model.emoji} {model.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 🚀 Migration Strategy

### **Phase 1: Standalone Integration (Week 1)**
- [ ] Add Pantheon as a separate tab/page in your app
- [ ] Use existing Playground component as-is
- [ ] No editor changes needed
- [ ] Users can process images separately, then import to editor

### **Phase 2: Simple Export Integration (Week 2)**
- [ ] Add "Enhance on Export" checkbox to export dialog
- [ ] Integrate `useLightboxEnhance` hook
- [ ] Show progress during export
- [ ] Download enhanced file

### **Phase 3: Embedded Enhancement (Week 3-4)**
- [ ] Add Pantheon panel to editor toolbar
- [ ] Implement layer enhancement
- [ ] Handle async processing in editor state
- [ ] Add progress indicators

### **Phase 4: Advanced Features (Week 5+)**
- [ ] Non-destructive layer effects
- [ ] Batch processing
- [ ] Auto-enhancement suggestions
- [ ] Model comparison (A/B testing)

---

## ✅ Best Practices

### **1. Always Show Processing Time Estimates**
Users need to know if they're waiting 5 seconds or 60 seconds.

```tsx
<Button>
  Enhance with Athena (⏱️ ~60-120s)
</Button>
```

---

### **2. Provide Cancel/Undo Options**
Long-running tasks need escape hatches.

```tsx
{isProcessing && (
  <Button onClick={cancelEnhancement}>Cancel</Button>
)}
```

---

### **3. Cache Results Locally**
Don't re-process the same image with same settings.

```typescript
const cacheKey = `${imageHash}_${model}_${scale}`;
const cached = localStorage.getItem(cacheKey);
if (cached) return cached;
```

---

### **4. Handle Errors Gracefully**
Network issues, insufficient credits, processing failures.

```tsx
{error && (
  <Alert variant="error">
    Enhancement failed: {error}
    <Button onClick={retry}>Retry</Button>
  </Alert>
)}
```

---

### **5. Preserve Edit History**
Let users undo Pantheon enhancements.

```typescript
const history: EditorState[] = [];

function applyEnhancement(result: string) {
  history.push(getCurrentState());
  loadImage(result);
}

function undo() {
  const prev = history.pop();
  if (prev) restoreState(prev);
}
```

---

### **6. Smart Model Suggestions**
Recommend the right god based on image analysis.

```typescript
function suggestModel(image: ImageData): string {
  const { width, height, isBlurry, isGrayscale } = analyzeImage(image);

  if (isGrayscale) return 'osiris'; // Colorize B&W
  if (isBlurry) return 'hephaestus'; // Fix blur
  if (width < 512) return 'apollo'; // Quick upscale
  return 'athena'; // Default to best quality
}
```

---

## 📞 Support & Resources

- **API Endpoint:** `https://theeanthony--lightbox-engine-upscale-router.modal.run`
- **Frontend Integration Guide:** `/lightbox-web/FRONTEND_INTEGRATION_GUIDE.md`
- **Production Readiness Report:** `/lightbox-engine/PRODUCTION_READINESS_REPORT.md`
- **Modal Logs:** `modal logs lightbox-engine`

---

## 🎯 Quick Start Checklist

- [ ] Read this guide
- [ ] Choose integration approach (Option 1-4)
- [ ] Install `useLightboxEnhance` hook
- [ ] Add Pantheon UI to your editor
- [ ] Test with a sample image
- [ ] Handle errors and edge cases
- [ ] Deploy to production

**Estimated Time:** 1-4 weeks depending on integration complexity

---

**Questions?** Check the FRONTEND_INTEGRATION_GUIDE.md for detailed API examples and parameter explanations.
