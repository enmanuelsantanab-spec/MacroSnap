"use client";

import { useState, useEffect, useCallback } from "react";
import { Utensils, Camera as CameraIcon } from "lucide-react";
import { supabase, type LogEntry } from "@/lib/supabase";
import ManualEntryForm from "@/components/ManualEntryForm";
import MealScanner from "@/components/MealScanner";
import DailyDashboard from "@/components/DailyDashboard";
import Toast, { type ToastType } from "@/components/Toast";

type Tab = "manual" | "scan";

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    visible: boolean;
  }>({ message: "", type: "success", visible: false });

  // ── Fetch today's logs ───────────────────────────────
  const fetchLogs = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLogs(data as LogEntry[]);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Handlers ─────────────────────────────────────────
  function showToast(message: string, type: ToastType) {
    setToast({ message, type, visible: true });
  }

  function handleSuccess(entry: LogEntry) {
    setLogs((prev) => [entry, ...prev]);
    showToast(`${entry.food_name} added!`, "success");
  }

  function handleError(message: string) {
    showToast(message, "error");
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("logs").delete().eq("id", id);
    if (error) {
      showToast("Failed to delete entry.", "error");
      return;
    }
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <>
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <div className="flex-1 flex flex-col">
        {/* ── Header ──────────────────────────────────── */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-card-border">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <CameraIcon className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">MacroSnap</h1>
            </div>
            <p className="text-xs text-muted">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </header>

        {/* ── Main Content ────────────────────────────── */}
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-5">
          {/* Dashboard */}
          <DailyDashboard logs={logs} onDelete={handleDelete} />

          {/* Entry Tabs */}
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <div className="flex border-b border-card-border">
              <button
                onClick={() => setActiveTab("scan")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "scan"
                    ? "text-accent border-b-2 border-accent bg-accent-light/30"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <CameraIcon className="w-4 h-4" />
                Scan Meal
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "manual"
                    ? "text-accent border-b-2 border-accent bg-accent-light/30"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Utensils className="w-4 h-4" />
                Manual Entry
              </button>
            </div>

            <div className="p-4">
              {activeTab === "scan" ? (
                <MealScanner onSuccess={handleSuccess} onError={handleError} />
              ) : (
                <ManualEntryForm
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
