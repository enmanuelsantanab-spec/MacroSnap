/**
 * Shared types for Gemini AI responses.
 * Actual API calls happen server-side via /api/analyze-meal and /api/food-lookup.
 */

export interface MacroResult {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * Send a meal image to the server-side Gemini endpoint for analysis.
 */
export async function analyzeMealImage(
  base64Data: string,
  mimeType: string
): Promise<MacroResult> {
  const res = await fetch("/api/analyze-meal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64: base64Data, mimeType }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to analyze meal image.");
  }

  return res.json();
}

/**
 * Search for foods by name and get suggested macros.
 */
export async function lookupFood(query: string): Promise<MacroResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const res = await fetch(
      `/api/food-lookup?q=${encodeURIComponent(query.trim())}`
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("food-lookup error:", res.status, body);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("food-lookup returned non-array:", data);
      return [];
    }
    return data;
  } catch (err) {
    console.error("food-lookup fetch failed:", err);
    return [];
  }
}
