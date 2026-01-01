"use client";

import { useState } from "react";

export function TestAiButton() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTestEnhance = async () => {
    setLoading(true);
    setResult("Starting generation...");
    
    // Use a dummy image for testing (Real-ESRGAN example)
    const testImage = "https://github.com/xinntao/Real-ESRGAN/raw/master/inputs/0030.jpg"; 
    
    try {
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: testImage }),
      });
      
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult("Error: " + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 p-6 border border-gray-800 rounded-xl bg-gray-900/50">
      <h3 className="font-semibold mb-4 text-white">Test Your Model</h3>
      <button 
        onClick={handleTestEnhance} 
        disabled={loading}
        className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50"
      >
        {loading ? "Processing..." : "Generate Test Image"}
      </button>
      
      {/* Result Display */}
      {result && (
        <div className="mt-4 bg-black p-4 rounded-lg border border-gray-800 overflow-x-auto">
          <pre className="text-xs text-green-400 font-mono">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}