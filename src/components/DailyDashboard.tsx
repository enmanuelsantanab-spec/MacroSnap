"use client";

import { Flame, Beef, Wheat, Droplets, Trash2 } from "lucide-react";
import type { LogEntry } from "@/lib/supabase";

interface DailyDashboardProps {
  logs: LogEntry[];
  calorieGoal?: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatsGoal?: number;
  onDelete: (id: string) => void;
}

export default function DailyDashboard({
  logs,
  calorieGoal = 2000,
  proteinGoal = 150,
  carbsGoal = 250,
  fatsGoal = 65,
  onDelete,
}: DailyDashboardProps) {
  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fats: acc.fats + log.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const calPercent = Math.min((totals.calories / calorieGoal) * 100, 100);
  const calRemaining = Math.max(calorieGoal - totals.calories, 0);

  return (
    <div className="space-y-5">
      {/* ── Calorie Ring ───────────────────────────────── */}
      <div className="bg-card border border-card-border rounded-2xl p-5">
        <div className="flex items-center gap-5">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={calPercent >= 100 ? "#ef4444" : "#6366f1"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${calPercent * 2.64} ${264 - calPercent * 2.64}`}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums leading-none">
                {totals.calories.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">
                kcal
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Today&apos;s Calories</span>
            </div>
            <p className="text-xs text-muted">
              {calRemaining > 0
                ? `${calRemaining.toLocaleString()} kcal remaining`
                : "Daily goal reached!"}
            </p>
            <p className="text-xs text-muted">
              Goal: {calorieGoal.toLocaleString()} kcal
            </p>
          </div>
        </div>
      </div>

      {/* ── Macro Progress Bars ────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <MacroCard
          label="Protein"
          current={totals.protein}
          goal={proteinGoal}
          unit="g"
          color="var(--protein)"
          bgColor="var(--accent-light)"
          icon={<Beef className="w-3.5 h-3.5" />}
        />
        <MacroCard
          label="Carbs"
          current={totals.carbs}
          goal={carbsGoal}
          unit="g"
          color="var(--carbs)"
          bgColor="var(--warning-light)"
          icon={<Wheat className="w-3.5 h-3.5" />}
        />
        <MacroCard
          label="Fats"
          current={totals.fats}
          goal={fatsGoal}
          unit="g"
          color="var(--fats)"
          bgColor="#fce7f3"
          icon={<Droplets className="w-3.5 h-3.5" />}
        />
      </div>

      {/* ── Daily History ──────────────────────────────── */}
      <div>
        <h3 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
          Today&apos;s Log ({logs.length} {logs.length === 1 ? "entry" : "entries"})
        </h3>
        {logs.length === 0 ? (
          <div className="bg-card border border-card-border rounded-2xl py-8 text-center">
            <p className="text-sm text-muted">
              No entries yet. Add a meal to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center gap-3 group"
              >
                {log.image_url && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-card-border shrink-0">
                    <img
                      src={log.image_url}
                      alt={log.food_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {log.food_name}
                  </p>
                  <p className="text-xs text-muted">
                    {log.calories} kcal · {log.protein}p · {log.carbs}c ·{" "}
                    {log.fats}f
                  </p>
                </div>
                <span className="text-xs text-muted tabular-nums shrink-0">
                  {new Date(log.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  onClick={() => onDelete(log.id)}
                  className="p-1.5 rounded-lg text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger-light transition-all shrink-0"
                  aria-label={`Delete ${log.food_name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Macro Card sub-component ─────────────────────────────────
function MacroCard({
  label,
  current,
  goal,
  unit,
  color,
  bgColor,
  icon,
}: {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}) {
  const percent = Math.min((current / goal) * 100, 100);
  return (
    <div className="bg-card border border-card-border rounded-xl p-3">
      <div
        className="flex items-center gap-1.5 mb-2"
        style={{ color }}
      >
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">
        {current.toFixed(0)}
        <span className="text-xs font-normal text-muted ml-0.5">
          / {goal}
          {unit}
        </span>
      </p>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: bgColor }}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
