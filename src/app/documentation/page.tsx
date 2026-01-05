import Link from "next/link";

export default function Documentation() {
  return (
    <div className="min-h-screen bg-black text-gray-200 p-8 md:p-12 font-sans selection:bg-purple-900">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="border-b border-gray-800 pb-8">
            <Link href="/dashboard" className="text-sm text-purple-400 hover:text-purple-300 mb-4 inline-block">&larr; Back to Dashboard</Link>
            <h1 className="text-4xl font-bold text-white mb-2">Documentation</h1>
            <p className="text-xl text-gray-400">Integrate standard-setting upscaling into your app.</p>
        </div>

        {/* Auth Section */}
        <section id="auth" className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Authentication</h2>
            <p>All API requests require your secret API key in the header.</p>
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 font-mono text-sm overflow-x-auto">
                <span className="text-purple-400">Authorization</span>: Bearer <span className="text-yellow-200">sk_live_123...</span>
            </div>
        </section>

        {/* Endpoint Section */}
        <section id="endpoint" className="space-y-6">
            <h2 className="text-2xl font-semibold text-white">Enhance Image</h2>
            <div className="flex items-center gap-3">
                <span className="bg-green-900/30 text-green-400 px-3 py-1 rounded text-xs font-bold border border-green-900">POST</span>
                {/* 🟢 UPDATED: Correct Platform URL */}
                <code className="bg-gray-900 px-3 py-1 rounded text-sm text-gray-300">https://platform.lightboxlabs.org/api/enhance</code>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div>
                    <h3 className="font-medium text-white mb-3">Body Parameters</h3>
                    <ul className="space-y-4">
                        <li className="space-y-1">
                            <div className="flex justify-between">
                                {/* 🟢 UPDATED: imageUrl */}
                                <code className="text-purple-400 text-sm">imageUrl</code>
                                <span className="text-xs text-gray-500 uppercase">Required</span>
                            </div>
                            <p className="text-sm text-gray-400">Public HTTP URL of the image you want to upscale. Supports PNG, JPG, WEBP.</p>
                        </li>
                        <li className="space-y-1">
                            <div className="flex justify-between">
                                <code className="text-purple-400 text-sm">scale</code>
                                <span className="text-xs text-gray-500">Optional</span>
                            </div>
                            <p className="text-sm text-gray-400">Number between 1-4. Factor to upscale by. Default is 2.</p>
                        </li>
                        <li className="space-y-1">
                            <div className="flex justify-between">
                                <code className="text-purple-400 text-sm">mode</code>
                                <span className="text-xs text-gray-500">Optional</span>
                            </div>
                            <p className="text-sm text-gray-400">Either <code>"universal"</code> (fidelity) or <code>"face"</code> (generative).</p>
                        </li>
                    </ul>
                </div>

                {/* Example Request */}
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-sm font-mono leading-relaxed overflow-x-auto">
<pre className="text-gray-300">
{/* 🟢 UPDATED: Correct cURL with imageUrl */}
{`curl -X POST https://platform.lightboxlabs.org/api/enhance \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "imageUrl": "https://example.com/photo.jpg",
    "scale": 2,
    "mode": "face"
  }'`}
</pre>
                </div>
            </div>
        </section>

        {/* Response Section */}
        <section id="response" className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Response</h2>
            <p className="text-gray-400 text-sm">The API is asynchronous. You will receive a Job ID immediately.</p>
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 text-sm font-mono leading-relaxed">
{/* 🟢 UPDATED: Correct Async Response */}
<pre className="text-green-400">
{`{
  "success": true,
  "jobId": "8x9s0f...",
  "status": "queued"
}`}
</pre>
            </div>
        </section>

      </div>
    </div>
  );
}