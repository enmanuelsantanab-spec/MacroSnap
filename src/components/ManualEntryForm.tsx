"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { lookupFood, type MacroResult } from "@/lib/gemini";
import type { LogEntry } from "@/lib/supabase";

interface ManualEntryFormProps {
  onSuccess: (entry: LogEntry) => void;
  onError: (message: string) => void;
}

interface FormData {
  food_name: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
}

const initialForm: FormData = {
  food_name: "",
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
};

export default function ManualEntryForm({
  onSuccess,
  onError,
}: ManualEntryFormProps) {
  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);

  // ── Food search state ──────────────────────────────────
  const [suggestions, setSuggestions] = useState<MacroResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFromSuggestion, setSelectedFromSuggestion] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));

    // If they're editing the food name after selecting a suggestion, allow new search
    if (field === "food_name") {
      setSelectedFromSuggestion(false);
    }
  }

  // ── Debounced food search ──────────────────────────────
  const searchFood = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const results = await lookupFood(query);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    // Don't search if they just picked a suggestion
    if (selectedFromSuggestion) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (form.food_name.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchFood(form.food_name);
      }, 500);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form.food_name, searchFood, selectedFromSuggestion]);

  // ── Close dropdown on outside click ────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Select a suggestion ────────────────────────────────
  function selectSuggestion(item: MacroResult) {
    setSelectedFromSuggestion(true);
    setForm({
      food_name: item.food_name,
      calories: String(Math.round(item.calories)),
      protein: String(parseFloat(item.protein.toFixed(1))),
      carbs: String(parseFloat(item.carbs.toFixed(1))),
      fats: String(parseFloat(item.fats.toFixed(1))),
    });
    setSuggestions([]);
    setShowDropdown(false);
  }

  function clearFoodName() {
    setForm(initialForm);
    setSelectedFromSuggestion(false);
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  function validate(): string | null {
    if (!form.food_name.trim()) return "Please enter a food name.";
    const nums = {
      calories: Number(form.calories),
      protein: Number(form.protein),
      carbs: Number(form.carbs),
      fats: Number(form.fats),
    };
    for (const [key, val] of Object.entries(nums)) {
      if (isNaN(val) || val < 0) return `${key} must be a positive number.`;
    }
    if (nums.calories === 0) return "Calories must be greater than zero.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      onError(error);
      return;
    }

    setSaving(true);
    const { data, error: dbError } = await supabase
      .from("logs")
      .insert({
        food_name: form.food_name.trim(),
        calories: Math.round(Number(form.calories)),
        protein: parseFloat(Number(form.protein).toFixed(1)),
        carbs: parseFloat(Number(form.carbs).toFixed(1)),
        fats: parseFloat(Number(form.fats).toFixed(1)),
      })
      .select()
      .single();

    setSaving(false);

    if (dbError || !data) {
      onError(dbError?.message ?? "Failed to save entry.");
      return;
    }

    onSuccess(data as LogEntry);
    setForm(initialForm);
    setSelectedFromSuggestion(false);
  }

  const inputClasses =
    "w-full rounded-lg border border-card-border bg-card px-3 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── Food Name with Search ──────────────────────── */}
      <div className="relative">
        <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
          Food Name
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for a food (e.g. Banana, Chicken Breast)"
            value={form.food_name}
            onChange={(e) => update("food_name", e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0 && !selectedFromSuggestion) {
                setShowDropdown(true);
              }
            }}
            className={`${inputClasses} pl-9 pr-9`}
            autoComplete="off"
          />
          {form.food_name && (
            <button
              type="button"
              onClick={clearFoodName}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searching && (
            <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-accent animate-spin" />
          )}
        </div>

        {/* ── Suggestions Dropdown ─────────────────────── */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-card border border-card-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="px-3 py-1.5 bg-accent-light/20 border-b border-card-border">
              <p className="text-[10px] font-medium text-muted uppercase tracking-wider">
                Suggested foods
              </p>
            </div>
            {suggestions.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectSuggestion(item)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent-light/20 active:bg-accent-light/30 transition-colors border-b border-card-border last:border-b-0"
              >
                <p className="text-sm font-medium">{item.food_name}</p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[11px] text-muted">
                    <span className="font-medium text-foreground">
                      {Math.round(item.calories)}
                    </span>{" "}
                    cal
                  </span>
                  <span className="text-[11px] text-muted">
                    <span className="font-medium text-foreground">
                      {item.protein.toFixed(1)}g
                    </span>{" "}
                    protein
                  </span>
                  <span className="text-[11px] text-muted">
                    <span className="font-medium text-foreground">
                      {item.carbs.toFixed(1)}g
                    </span>{" "}
                    carbs
                  </span>
                  <span className="text-[11px] text-muted">
                    <span className="font-medium text-foreground">
                      {item.fats.toFixed(1)}g
                    </span>{" "}
                    fat
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Macro Fields ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
            Calories
          </label>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={form.calories}
            onChange={(e) => update("calories", e.target.value)}
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
            placeholder="0"
            value={form.protein}
            onChange={(e) => update("protein", e.target.value)}
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
            placeholder="0"
            value={form.carbs}
            onChange={(e) => update("carbs", e.target.value)}
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
            placeholder="0"
            value={form.fats}
            onChange={(e) => update("fats", e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium py-3 rounded-xl hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {saving ? "Saving…" : "Add Entry"}
      </button>
    </form>
  );
}
