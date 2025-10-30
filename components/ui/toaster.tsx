"use client";

import * as React from "react";
import { X } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === "destructive" ? "alert" : "status"}
          aria-live={toast.variant === "destructive" ? "assertive" : "polite"}
          className={cn(
            "pointer-events-auto flex w-full flex-col gap-2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur transition",
            toast.variant === "success" && "border-emerald-400/60 bg-emerald-950/20 text-emerald-100",
            toast.variant === "destructive" && "border-destructive/60 bg-destructive/15 text-destructive-foreground",
            toast.variant === "default" && "border-border/50 bg-muted/80 text-foreground"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              {toast.title ? (
                <p className="text-sm font-semibold leading-tight">
                  {toast.title}
                </p>
              ) : null}
              {toast.description ? (
                <p className="text-sm text-muted-foreground">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
