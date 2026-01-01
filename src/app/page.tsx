import Link from "next/link";
import CompareSlider from "@/components/CompareSlider";
import { Zap, Shield, ScanFace } from "lucide-react"; 

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-purple-500/30">
      
      {/* --- NAV --- */}
      <nav className="flex justify-between items-center p-6 border-b border-gray-900 sticky top-0 bg-black/80 backdrop-blur-md z-50">
        <div className="font-bold text-xl tracking-tighter">Lightbox Labs</div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href="/documentation" className="hover:text-white transition">
            Documentation
          </Link>
          <Link href="/#pricing" className="hover:text-white transition">
            Pricing
          </Link>
          <Link 
            href="/dashboard" 
            className="bg-white text-black px-4 py-2 rounded-full font-medium hover:bg-gray-200 transition"
          >
            Get API Keys
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <div className="flex flex-col items-center justify-center pt-24 pb-20 px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
          The Identity-First<br />Upscaler API.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10">
          Stop using AI that hallucinates plastic faces. <br/>
          Restore texture, details, and truth with our B2B Developer API.
        </p>
        
        {/* Slider Component */}
        <CompareSlider />
        
        {/* Code Snippet */}
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

{/* --- FEATURES GRID --- */}
<div className="py-32 bg-neutral-900/30 border-y border-neutral-800">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-20 text-center md:text-left">
            
            {/* Feature 1 */}
            <div className="space-y-6">
              <ScanFace className="text-purple-400 mx-auto md:mx-0" size={48} />
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">True Identity Preservation</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  Most upscalers hallucinate new faces. Our model locks onto facial landmarks to ensure the person in the after photo looks exactly like the person in the before photo.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="space-y-6">
              <Zap className="text-blue-400 mx-auto md:mx-0" size={48} />
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Lightning Fast API</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  Built for scale. Process thousands of images per hour with our distributed GPU clusters. Average response time under 3 seconds.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="space-y-6">
              <Shield className="text-green-400 mx-auto md:mx-0" size={48} />
              <div className="space-y-4">
                <h3 className="text-2xl font-bold">Enterprise Security</h3>
                <p className="text-gray-400 leading-relaxed text-lg">
                  Your data is yours. Images are processed in ephemeral containers and deleted immediately after delivery. We never train on your data.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* --- PRICING SECTION --- */}
      <div id="pricing" className="py-24 px-4 border-b border-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Simple, transparent pricing.</h2>
          <p className="text-gray-400 text-center mb-16 max-w-lg mx-auto">
            Start for free, scale as you grow. No hidden fees.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Tier */}
            <div className="p-8 rounded-2xl border border-gray-800 bg-gray-900/20 hover:border-gray-700 transition">
              <h3 className="text-xl font-bold mb-2">Hobby</h3>
              <div className="text-3xl font-bold mb-6">$0 <span className="text-base font-normal text-gray-500">/mo</span></div>
              <ul className="space-y-4 text-gray-400 text-sm mb-8">
                <li className="flex gap-2">✓ <span className="text-white">50 Credits</span> one-time</li>
                <li className="flex gap-2">✓ Standard Processing Speed</li>
                <li className="flex gap-2">✓ 2 Concurrent Requests</li>
              </ul>
              <Link href="/dashboard" className="block w-full text-center py-2.5 rounded-lg border border-gray-700 hover:bg-gray-800 transition text-sm font-medium">
                Start Building
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="p-8 rounded-2xl border border-purple-500/30 bg-purple-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
              <h3 className="text-xl font-bold mb-2 text-white">Pro</h3>
              <div className="text-3xl font-bold mb-6">$10 <span className="text-base font-normal text-gray-500">/credit pack</span></div>
              <ul className="space-y-4 text-gray-400 text-sm mb-8">
                <li className="flex gap-2">✓ <span className="text-white">500 Credits</span> per pack</li>
                <li className="flex gap-2">✓ <span className="text-purple-400">Prioritized GPU Access</span></li>
                <li className="flex gap-2">✓ Commercial License</li>
                <li className="flex gap-2">✓ Email Support</li>
              </ul>
              <Link href="/dashboard" className="block w-full text-center py-2.5 rounded-lg bg-white text-black hover:bg-gray-200 transition text-sm font-medium">
                Buy Credits
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* --- FAQ SECTION --- */}
      <div className="max-w-3xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        
        <div className="space-y-6">
          <details className="group bg-neutral-900/50 p-6 rounded-xl border border-neutral-800 cursor-pointer">
            <summary className="font-semibold list-none flex justify-between items-center">
              <span>Can I use the images commercially?</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <p className="text-gray-400 mt-4 leading-relaxed">
              Yes! You own 100% of the commercial rights to any image you upscale using Lightbox Labs, even on the free tier.
            </p>
          </details>

          <details className="group bg-neutral-900/50 p-6 rounded-xl border border-neutral-800 cursor-pointer">
            <summary className="font-semibold list-none flex justify-between items-center">
              <span>What happens to my uploaded photos?</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <p className="text-gray-400 mt-4 leading-relaxed">
              Privacy is paramount. We store images only for the duration of the processing (usually seconds) and then permanently delete them.
            </p>
          </details>

          <details className="group bg-neutral-900/50 p-6 rounded-xl border border-neutral-800 cursor-pointer">
            <summary className="font-semibold list-none flex justify-between items-center">
              <span>Do you offer volume discounts?</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <p className="text-gray-400 mt-4 leading-relaxed">
              Absolutely. If you need to process more than 10,000 images per month, contact us for enterprise pricing API keys.
            </p>
          </details>
        </div>
      </div>

      {/* --- FINAL CTA --- */}
      <div className="py-24 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
          Ready to restore clarity?
        </h2>
        <p className="text-gray-400 text-lg mb-8">
          Get 50 free credits when you sign up today. No credit card required.
        </p>
        <Link 
          href="/dashboard" 
          className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition inline-block"
        >
          Get Started for Free
        </Link>
      </div>

      {/* --- FOOTER --- */}
      <footer className="py-10 text-center text-gray-600 text-sm border-t border-gray-900">
        &copy; {new Date().getFullYear()} Lightbox Labs. All rights reserved.
      </footer>

    </main>
  );
}