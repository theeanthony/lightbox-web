"use client";
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

interface CompareSliderProps {
  before?: string;
  after?: string;
  className?: string;
  isModal?: boolean; // 🟢 NEW PROP: Controls scaling logic
}

export default function CompareSlider({ 
  before = "/placeholder.jpg", 
  after = "/placeholder.jpg", 
  className = "",
  isModal = false 
}: CompareSliderProps) {
  return (
    // 1. Remove hardcoded aspect-ratio. Let 'className' prop control dimensions.
    <div className={`relative rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl mx-auto ${className}`}>
      <ReactCompareSlider
        changePositionOnHover={true}
        // 2. Dynamic Object Fit: 'cover' for cards (clean), 'contain' for modal (accurate)
        itemOne={
          <ReactCompareSliderImage 
            src={before} 
            alt="Original" 
            style={{ objectFit: isModal ? 'contain' : 'cover', width: '100%', height: '100%' }} 
          />
        }
        itemTwo={
          <ReactCompareSliderImage 
            src={after} 
            alt="Enhanced" 
            style={{ objectFit: isModal ? 'contain' : 'cover', width: '100%', height: '100%' }} 
          />
        }
        className="h-full w-full"
      />
      
      {/* Labels */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full z-10 pointer-events-none border border-white/10">
        Original
      </div>
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-black text-[10px] font-bold px-3 py-1.5 rounded-full z-10 pointer-events-none shadow-lg">
        Enhanced
      </div>
    </div>
  );
}