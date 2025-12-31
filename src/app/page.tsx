import CompareSlider from "@/components/CompareSlider";
import Link from "next/link"; // <--- 1. Import Link

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
      
      {/* Nav */}
      <nav className="flex justify-between items-center p-6 border-b border-gray-900">
        <div className="font-bold text-xl tracking-tighter">Lightbox Labs</div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <a href="#" className="hover:text-white transition">Documentation</a>
          <a href="#" className="hover:text-white transition">Pricing</a>
          
          {/* 2. Change the button to a Link pointing to /dashboard */}
          <Link 
            href="/dashboard" 
            className="bg-white text-black px-4 py-2 rounded-full font-medium hover:bg-gray-200 transition"
          >
            Get API Keys
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-24 pb-20 px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
          The Identity-First<br />Upscaler API.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10">
          Stop using AI that hallucinates plastic faces. <br/>
          Restore texture, details, and truth with our B2B Developer API.
        </p>
        
        {/* The Slider */}
        <CompareSlider />
        
        {/* The Code Snippet (Developer Bait) */}
        <div className="mt-16 w-full max-w-2xl bg-gray-900/50 border border-gray-800 rounded-lg p-4 text-left font-mono text-sm overflow-x-auto">
          <div className="flex gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
          </div>
          <p className="text-purple-400">curl <span className="text-white">-X POST</span> https://api.lightboxlabs.org/v1/enhance \</p>
          <p className="text-gray-400 pl-4">-H <span className="text-green-400">"Authorization: Bearer sk_live_..."</span> \</p>
          <p className="text-gray-400 pl-4">-d <span className="text-yellow-200">'{"{"}"image": "...", "fidelity": 0.5{"}"}'</span></p>
        </div>
      </div>
    </main>
  );
}