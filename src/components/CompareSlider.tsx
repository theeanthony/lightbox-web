"use client";
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

interface CompareSliderProps {
  before?: string; // Optional prop
  after?: string;  // Optional prop
}

export default function CompareSlider({ before = "/before.jpg", after = "/after.jpg" }: CompareSliderProps) {
  return (
    <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-white/10 shadow-2xl mx-auto bg-black">
      <ReactCompareSlider
        changePositionOnHover={true}
        itemOne={<ReactCompareSliderImage src={before} alt="Original" />}
        itemTwo={<ReactCompareSliderImage src={after} alt="Enhanced" />}
        className="h-full w-full object-cover"
      />
      {/* Labels */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full z-10">Original</div>
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-black text-xs font-bold px-3 py-1.5 rounded-full z-10">Enhanced</div>
    </div>
  );
}