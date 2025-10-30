import { NextRequest } from "next/server";

import { getActivityWatcher, type ActivityUpdate } from "@/lib/activity/watcher";
import { ACTIVITY_EVENT_NAME } from "@/lib/activity/stream";

type ActivityEvent = {
  type: "article:saved" | "article:deleted";
  slug: string;
  timestamp: string;
  meta?: {
    title?: string;
    category?: string;
    updatedAt?: string;
    createdAt?: string;
    isDraft?: boolean;
  };
  searchGeneratedAt?: number;
};

export const runtime = "nodejs";

const MAX_RECENT_EVENTS = 10;
const recentEvents: ActivityEvent[] = [];
let lastEventSignature: string | null = null;

export async function GET(request: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const encoder = new TextEncoder();
  const watcher = getActivityWatcher();

  const pushEventToBacklog = (event: ActivityEvent) => {
    const signature = createEventSignature(event);
    if (lastEventSignature === signature) {
      return;
    }
    lastEventSignature = signature;
    recentEvents.push(event);
    if (recentEvents.length > MAX_RECENT_EVENTS) {
      recentEvents.shift();
    }
  };

  const writeEvent = (eventPayload: ActivityEvent) => {
    const data = encoder.encode(
      `event: ${ACTIVITY_EVENT_NAME}\ndata: ${JSON.stringify(eventPayload)}\n\n`,
    );
    writer.write(data).catch((error) => {
      console.error("[EventsStream] Failed to write SSE payload", error);
    });
  };

  const unsubscribe = watcher.subscribe((payload) => {
    const eventPayload = mapActivityToEvent(payload);
    pushEventToBacklog(eventPayload);
    writeEvent(eventPayload);
  });

  const heartbeat = () => {
    writer.write(encoder.encode(`: heartbeat ${Date.now()}\n\n`)).catch(() => {});
  };

  const heartbeatInterval = setInterval(heartbeat, 25000);
  heartbeat();

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    clearInterval(heartbeatInterval);
    writer.close().catch(() => {});
  };

  const response = new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  request.signal.addEventListener("abort", close, { once: true });
  writer.closed.then(close).catch(() => close());

  for (const event of recentEvents) {
    writeEvent(event);
  }

  return response;
}

function createEventSignature(event: ActivityEvent) {
  return `${event.type}:${event.slug}:${event.timestamp}`;
}

function mapActivityToEvent(payload: ActivityUpdate): ActivityEvent {
  const type = payload.type === "delete" ? "article:deleted" : "article:saved";
  const timestamp = payload.updatedAt ?? payload.createdAt ?? new Date().toISOString();

  const meta =
    type === "article:saved"
      ? {
          title: payload.title,
          category: payload.category,
          updatedAt: payload.updatedAt,
          createdAt: payload.createdAt,
          isDraft: payload.isDraft,
        }
      : undefined;

  return {
    type,
    slug: payload.slug,
    timestamp,
    meta,
    searchGeneratedAt: payload.searchGeneratedAt,
  };
}
