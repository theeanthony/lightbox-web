"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";

export default function CompareSlider() {
  const [sliderPosition, setSliderPosition] = useState(50);

  return (
    <div className="relative w-full max-w-3xl h-[400px] overflow-hidden rounded-xl border border-gray-800 cursor-ew-resize select-none"
         onMouseMove={(e) => {
           const rect = e.currentTarget.getBoundingClientRect();
           setSliderPosition(((e.clientX - rect.left) / rect.width) * 100);
         }}>
      
      {/* Background Layer (After / Enhanced) */}
      <img src="/after.jpg" alt="Enhanced" className="absolute inset-0 w-full h-full object-cover" />
      
      {/* Foreground Layer (Before / Blurry) - Clipped */}
      <div className="absolute inset-0 w-full h-full object-cover" 
           style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}>
        <img src="/before.jpg" alt="Original" className="absolute inset-0 w-full h-full object-cover" />
      </div>

      {/* The Handle */}
      <div className="absolute top-0 bottom-0 w-1 bg-white/50 backdrop-blur-md z-10"
           style={{ left: `${sliderPosition}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-black p-1 rounded-full shadow-lg">
          <GripVertical size={20} />
        </div>
      </div>
      
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 text-xs rounded">Original</div>
      <div className="absolute top-4 right-4 bg-white/90 text-black px-2 py-1 text-xs rounded font-bold">Lightbox AI</div>
    </div>
  );
}