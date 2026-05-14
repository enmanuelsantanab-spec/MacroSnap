import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export async function POST(req: NextRequest) {
  try {
    const { base64, mimeType } = await req.json();

    if (!base64 || !mimeType) {
      return NextResponse.json(
        { error: "Missing base64 or mimeType" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a professional nutritionist. Analyze this image and identify the food. Estimate the portion size and provide the total Calories, Protein (g), Carbs (g), and Fats (g). Return the data ONLY in a strict JSON format like this: {"food_name": "string", "calories": number, "protein": number, "carbs": number, "fats": number}. Do not include any other text, markdown, or code fences — just the raw JSON object.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
    ]);

    const text = result.response.text().trim();

    // Extract JSON from the response — Gemini sometimes wraps it in markdown
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse nutritional data from the AI response." },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (
      typeof parsed.food_name !== "string" ||
      typeof parsed.calories !== "number" ||
      typeof parsed.protein !== "number" ||
      typeof parsed.carbs !== "number" ||
      typeof parsed.fats !== "number"
    ) {
      return NextResponse.json(
        { error: "AI returned data in an unexpected format." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("analyze-meal error:", message);
    return NextResponse.json(
      { error: `Failed to analyze image: ${message}` },
      { status: 500 }
    );
  }
}
