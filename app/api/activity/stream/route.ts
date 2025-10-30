import { NextRequest } from "next/server";

import { getActivityWatcher } from "@/lib/activity/watcher";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const encoder = new TextEncoder();

  const watcher = getActivityWatcher();

  const unsubscribe = watcher.subscribe((payload) => {
    const data = encoder.encode(
      `event: article-update\ndata: ${JSON.stringify(payload)}\n\n`
    );
    writer.write(data).catch((error) => {
      console.error("[ActivityStream] Failed to write SSE payload", error);
    });
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

  _request.signal.addEventListener("abort", close, { once: true });
  writer.closed.then(close).catch(() => close());

  return response;
}
