"use client";

import { useState, useRef, useCallback } from "react";
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Check,
  ScanLine,
  Upload,
} from "lucide-react";
import { analyzeMealImage, type MacroResult } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import type { LogEntry } from "@/lib/supabase";

interface MealScannerProps {
  onSuccess: (entry: LogEntry) => void;
  onError: (message: string) => void;
}

type ScanState = "idle" | "preview" | "scanning" | "review";

// Max dimension for the image sent to Gemini (keeps base64 small & fast)
const MAX_IMAGE_SIZE = 1024;
const JPEG_QUALITY = 0.8;

/**
 * Compress an image file to a manageable size using canvas.
 * Returns { base64, mime, objectUrl }.
 */
function compressImage(
  file: File
): Promise<{ base64: string; mime: string; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      // Calculate scaled dimensions
      let { width, height } = img;
      if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
        const ratio = Math.min(MAX_IMAGE_SIZE / width, MAX_IMAGE_SIZE / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw to canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64 JPEG
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];

      resolve({
        base64,
        mime: "image/jpeg",
        objectUrl,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load the image."));
    };

    img.src = objectUrl;
  });
}

export default function MealScanner({ onSuccess, onError }: MealScannerProps) {
  const [state, setState] = useState<ScanState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<MacroResult | null>(null);
  const [saving, setSaving] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const imageDataRef = useRef<{ base64: string; mime: string } | null>(null);

  const reset = useCallback(() => {
    // Clean up object URL to prevent memory leaks
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setState("idle");
    setPreviewUrl(null);
    setResult(null);
    imageDataRef.current = null;
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }, [previewUrl]);

  // ── Handle file from either camera or gallery ───────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept common image types
    if (!file.type.startsWith("image/")) {
      onError("Please select an image file (JPG, PNG, HEIC, etc.).");
      return;
    }

    try {
      const { base64, mime, objectUrl } = await compressImage(file);
      imageDataRef.current = { base64, mime };
      setPreviewUrl(objectUrl);
      setState("preview");
    } catch {
      onError("Failed to process the image. Please try another photo.");
    }
  }

  // ── Send to Gemini for analysis ─────────────────────────
  async function handleAnalyze() {
    if (!imageDataRef.current) return;

    setState("scanning");
    try {
      const macros = await analyzeMealImage(
        imageDataRef.current.base64,
        imageDataRef.current.mime
      );
      setResult(macros);
      setState("review");
    } catch {
      onError(
        "Could not analyze the image. Please try a clearer photo or enter details manually."
      );
      reset();
    }
  }

  function updateResult(field: keyof MacroResult, value: string) {
    if (!result) return;
    setResult({
      ...result,
      [field]:
        field === "food_name"
          ? value
          : isNaN(Number(value))
          ? 0
          : Number(value),
    });
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);

    let imageUrl: string | null = null;

    // Upload image to Supabase Storage (best-effort)
    if (imageDataRef.current) {
      try {
        const fileName = `meals/${Date.now()}.jpg`;
        const buffer = Uint8Array.from(
          atob(imageDataRef.current.base64),
          (c) => c.charCodeAt(0)
        );
        const { error: uploadError } = await supabase.storage
          .from("meal-images")
          .upload(fileName, buffer, {
            contentType: imageDataRef.current.mime,
          });

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("meal-images").getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      } catch {
        // Image upload is best-effort — don't block saving the log
      }
    }

    const { data, error } = await supabase
      .from("logs")
      .insert({
        food_name: result.food_name,
        calories: Math.round(result.calories),
        protein: parseFloat(result.protein.toFixed(1)),
        carbs: parseFloat(result.carbs.toFixed(1)),
        fats: parseFloat(result.fats.toFixed(1)),
        image_url: imageUrl,
      })
      .select()
      .single();

    setSaving(false);

    if (error || !data) {
      onError(error?.message ?? "Failed to save entry.");
      return;
    }

    onSuccess(data as LogEntry);
    reset();
  }

  const inputClasses =
    "w-full rounded-lg border border-card-border bg-card px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";

  // ──── Idle: two buttons — camera & gallery ──────────────
  if (state === "idle") {
    return (
      <div className="space-y-3">
        {/* Hidden file inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
          aria-hidden="true"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
          aria-hidden="true"
        />

        {/* Take Photo button — primary action */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-5 bg-accent text-white rounded-2xl active:scale-[0.98] transition-transform"
        >
          <Camera className="w-6 h-6" />
          <div className="text-left">
            <p className="font-medium text-sm">Take a Photo</p>
            <p className="text-xs text-white/70">
              Opens your camera to snap a meal
            </p>
          </div>
        </button>

        {/* Upload from gallery — secondary action */}
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-card-border rounded-2xl bg-card hover:border-accent/40 active:scale-[0.98] transition-transform"
        >
          <Upload className="w-5 h-5 text-muted" />
          <div className="text-left">
            <p className="font-medium text-sm">Upload from Gallery</p>
            <p className="text-xs text-muted">
              Pick an existing photo
            </p>
          </div>
        </button>
      </div>
    );
  }

  // ──── Preview: confirm before scanning ──────────────────
  if (state === "preview") {
    return (
      <div className="space-y-4">
        {previewUrl && (
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-card-border bg-black">
            <img
              src={previewUrl}
              alt="Meal to analyze"
              className="w-full h-full object-contain"
            />
          </div>
        )}
        <p className="text-center text-xs text-muted">
          Make sure the food is clearly visible
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-2 border border-card-border text-muted font-medium py-3 rounded-xl hover:bg-card active:scale-[0.98] transition-transform"
          >
            <RotateCcw className="w-4 h-4" />
            Retake
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            className="flex-1 flex items-center justify-center gap-2 bg-accent text-white font-medium py-3 rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-transform"
          >
            <ScanLine className="w-4 h-4" />
            Analyze Meal
          </button>
        </div>
      </div>
    );
  }

  // ──── Scanning: loading with preview thumbnail ──────────
  if (state === "scanning") {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        {previewUrl && (
          <div className="relative w-36 h-36 rounded-2xl overflow-hidden border border-card-border">
            <img
              src={previewUrl}
              alt="Meal being analyzed"
              className="w-full h-full object-cover"
            />
            {/* Scanning overlay */}
            <div className="absolute inset-0 bg-accent/10 flex items-center justify-center">
              <div className="w-20 h-20 border-2 border-accent/50 rounded-xl animate-pulse" />
            </div>
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-accent">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Analyzing your meal…</span>
          </div>
          <p className="text-xs text-muted">
            Estimating calories &amp; macros with AI
          </p>
        </div>
      </div>
    );
  }

  // ──── Review: editable results ──────────────────────────
  return (
    <div className="space-y-4">
      {previewUrl && (
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl overflow-hidden border border-card-border shrink-0">
            <img
              src={previewUrl}
              alt="Scanned meal"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-muted" />
              <span className="text-xs text-muted">AI Estimate</span>
            </div>
            <p className="text-sm font-medium mt-0.5">
              Review &amp; adjust the values below
            </p>
          </div>
        </div>
      )}

      {result && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
              Food Name
            </label>
            <input
              type="text"
              value={result.food_name}
              onChange={(e) => updateResult("food_name", e.target.value)}
              className={inputClasses}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Calories
              </label>
              <input
                type="number"
                min="0"
                value={result.calories}
                onChange={(e) => updateResult("calories", e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Protein (g)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={result.protein}
                onChange={(e) => updateResult("protein", e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Carbs (g)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={result.carbs}
                onChange={(e) => updateResult("carbs", e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Fats (g)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={result.fats}
                onChange={(e) => updateResult("fats", e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 border border-card-border text-muted font-medium py-3 rounded-xl hover:bg-card active:scale-[0.98] transition-transform"
            >
              <RotateCcw className="w-4 h-4" />
              Retake
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-white font-medium py-3 rounded-xl hover:bg-accent/90 disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
