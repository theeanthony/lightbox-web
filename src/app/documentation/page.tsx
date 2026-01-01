import Link from "next/link";

export default function Documentation() {
  return (
    // 1. OUTER WRAPPER: Full width and height, Black Background
    <div className="min-h-screen w-full bg-black text-white">
      
      {/* 2. INNER CONTAINER: Centered, Limited Width for reading */}
      <div className="max-w-4xl mx-auto p-12">
        
        <Link href="/" className="text-gray-400 hover:text-white mb-8 block">
          ← Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold mb-6">API Documentation</h1>
        
        <div className="space-y-8">
          <section className="p-6 border border-gray-800 rounded-xl bg-gray-900/30">
            <h2 className="text-2xl font-semibold mb-3 text-purple-400">1. Authentication</h2>
            <p className="text-gray-400 mb-4">Include your API key in the Authorization header.</p>
            <div className="bg-black p-4 rounded-lg overflow-x-auto border border-gray-800 font-mono text-sm">
              <code>Authorization: Bearer sk_live_...</code>
            </div>
          </section>

          <section className="p-6 border border-gray-800 rounded-xl bg-gray-900/30">
            <h2 className="text-2xl font-semibold mb-3 text-purple-400">2. Enhance Image</h2>
            <p className="text-gray-400 mb-4">Send a POST request to upscale an image.</p>
            <div className="bg-black p-4 rounded-lg overflow-x-auto border border-gray-800 font-mono text-sm">
              <code>POST https://lightboxlabs.org/api/enhance</code>
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}