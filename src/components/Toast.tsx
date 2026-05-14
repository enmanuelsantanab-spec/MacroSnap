"use client";

import { useEffect } from "react";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error";

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onClose: () => void;
}

export default function Toast({ message, type, visible, onClose }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  const styles =
    type === "success"
      ? "bg-success-light text-green-800 border-success"
      : "bg-danger-light text-red-800 border-danger";

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-sm animate-[slideDown_300ms_ease-out]">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles}`}
      >
        {type === "success" ? (
          <CheckCircle className="w-5 h-5 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 shrink-0" />
        )}
        <p className="text-sm font-medium flex-1">{message}</p>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-black/5 shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -12px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
}
