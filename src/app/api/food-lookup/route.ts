import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a nutrition database. The user is searching for "${query}".
Return up to 5 common food items that match this search, with typical serving sizes and their macros.
Return ONLY a JSON array in this exact format, no other text:
[{"food_name": "Banana (medium, 118g)", "calories": 105, "protein": 1.3, "carbs": 27, "fats": 0.4}, ...]
Each item must have: food_name (string with portion size), calories (number), protein (number in grams), carbs (number in grams), fats (number in grams).
Use realistic USDA-style nutritional values. Do not include any markdown, code fences, or explanation — just the raw JSON array.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON array from response
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      return NextResponse.json([]);
    }

    const parsed = JSON.parse(arrayMatch[0]);

    // Validate the array
    if (!Array.isArray(parsed)) {
      return NextResponse.json([]);
    }

    const validated = parsed
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.food_name === "string" &&
          typeof item.calories === "number" &&
          typeof item.protein === "number" &&
          typeof item.carbs === "number" &&
          typeof item.fats === "number"
      )
      .slice(0, 5);

    return NextResponse.json(validated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("food-lookup error:", message);
    return NextResponse.json(
      { error: `Food lookup failed: ${message}` },
      { status: 500 }
    );
  }
}
