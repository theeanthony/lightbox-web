"use client";

import { Zap } from "lucide-react";
import { useState } from "react";

export function BuyButton() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/checkout", {
        method: "POST",
      });
      
      const data = await response.json();
      
      // Redirect user to the Stripe URL
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout failed", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCheckout}
      disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Zap size={18} className="fill-white" />
      {loading ? "Processing..." : "Buy Credits ($10)"}
    </button>
  );
}