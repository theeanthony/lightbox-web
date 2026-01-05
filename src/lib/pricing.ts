export function calculateCost(width: number, height: number, scale: number): number {
    // 1. Calculate Target Megapixels
    const targetW = width * scale;
    const targetH = height * scale;
    const megapixels = (targetW * targetH) / 1_000_000;
  
    // 2. Pricing Strategy: 1 Credit per Megapixel
    // Minimum 1 credit, rounded up.
    // Example: 1080p (2MP) -> 2 Credits
    // Example: 4K (8.3MP) -> 9 Credits
    return Math.max(1, Math.ceil(megapixels));
  }