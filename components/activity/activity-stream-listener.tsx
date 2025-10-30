"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { ACTIVITY_EVENT_NAME, type ActivityStreamPayload } from "@/lib/activity/stream";

type ActivityStreamListenerProps = {
  debounceMs?: number;
};

export function ActivityStreamListener({ debounceMs = 750 }: ActivityStreamListenerProps = {}) {
  const router = useRouter();
  const searchTimestampRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null || cancelled) {
        return;
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (cancelled) {
          return;
        }
        router.refresh();
      }, debounceMs);
    };

    const handleUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as ActivityStreamPayload;
        if (!payload || !payload.slug) {
          return;
        }
        if (payload.type !== "article:saved" && payload.type !== "article:deleted") {
          return;
        }
        const nextGeneratedAt = payload.searchGeneratedAt ?? null;
        if (typeof nextGeneratedAt === "number") {
          const lastTimestamp = searchTimestampRef.current;
          if (typeof lastTimestamp === "number" && nextGeneratedAt <= lastTimestamp) {
            return;
          }
          searchTimestampRef.current = nextGeneratedAt;
        }
        scheduleRefresh();
      } catch (error) {
        console.error("[ActivityStreamListener] Failed to parse event", error);
      }
    };

    const connect = () => {
      if (source) {
        source.close();
      }
      source = new EventSource("/api/events");
      source.addEventListener(ACTIVITY_EVENT_NAME, handleUpdate as EventListener);
      source.onerror = () => {
        source?.close();
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
        }
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (source) {
        source.close();
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [debounceMs, router]);

  return null;
}
