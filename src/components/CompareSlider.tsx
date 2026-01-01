"use client";

import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

export default function CompareSlider() {
  return (
    // Container: Portrait aspect ratio (3/4) to fit phone screenshots better
    <div className="relative w-full max-w-lg aspect-[3/4] rounded-xl overflow-hidden border border-white/10 shadow-2xl mx-auto">
      
      <ReactCompareSlider
        // 1. THIS IS THE FIX: Allows moving the slider just by hovering
        changePositionOnHover={true} 
        
        itemOne={
          <ReactCompareSliderImage 
            src="/before.jpg" 
            srcSet="/before.jpg" 
            alt="Original Image" 
          />
        }
        itemTwo={
          <ReactCompareSliderImage 
            src="/after.jpg" 
            srcSet="/after.jpg" 
            alt="Enhanced Image" 
          />
        }
        className="h-full w-full object-cover"
      />

      {/* Labels (Pinned to corners) */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 z-10 pointer-events-none">
        Original
      </div>

      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-black text-xs font-bold px-3 py-1.5 rounded-full border border-black/10 z-10 pointer-events-none">
        Lightbox AI
      </div>
    </div>
  );
}