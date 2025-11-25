'use client';

import type { ChangeEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

type AwarenessCursor = { from: number; to: number };
type AwarenessUser = { name?: string; color?: string };
type AwarenessState = {
  user?: AwarenessUser;
  cursor?: AwarenessCursor;
};

type PeerPresence = {
  id: number;
  name: string;
  color: string;
  cursor?: AwarenessCursor;
};

const DEFAULT_ENDPOINT =
  process.env.NEXT_PUBLIC_COLLAB_WEBSOCKET || "ws://localhost:1234";
const DEFAULT_ROOM = process.env.NEXT_PUBLIC_COLLAB_ROOM || "arcidium-test-collab";

const pickColor = () => {
  const palette = [
    "#0ea5e9",
    "#a855f7",
    "#22c55e",
    "#f97316",
    "#e11d48",
    "#14b8a6",
  ];
  return palette[Math.floor(Math.random() * palette.length)];
};

export default function RealtimeCollabPage() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const [peers, setPeers] = useState<PeerPresence[]>([]);

  const textRef = useRef<Y.Text | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const valueRef = useRef("");

  const userColor = useMemo(() => pickColor(), []);
  const userName = useMemo(
    () => `User-${crypto.randomUUID().slice(0, 4)}`,
    [],
  );

  const updateLocalCursor = (cursor: AwarenessCursor) => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.awareness.setLocalStateField("cursor", cursor);
  };

  useEffect(() => {
    const endpoint =
      process.env.NEXT_PUBLIC_COLLAB_WEBSOCKET?.trim() || DEFAULT_ENDPOINT;
    const room =
      process.env.NEXT_PUBLIC_COLLAB_ROOM?.trim() || DEFAULT_ROOM;

    const doc = new Y.Doc();
    const provider = new WebsocketProvider(endpoint, room, doc, {
      connect: true,
      // quicker reconnects for dev/demo use
      resyncInterval: 5_000,
    });

    providerRef.current = provider;

    const yText = doc.getText("content");
    textRef.current = yText;

    const applyText = () => {
      const content = yText.toString();
      valueRef.current = content;
      setValue(content);
    };

    const handleTextUpdate = () => applyText();
    yText.observe(handleTextUpdate);
    applyText();

    const handleAwarenessUpdate = () => {
      const states = provider.awareness.getStates();
      const present: PeerPresence[] = [];

      states.forEach((state: AwarenessState, clientId: number) => {
        if (!state?.user) return;
        present.push({
          id: clientId,
          name: state.user.name ?? `User-${clientId}`,
          color: state.user.color ?? "#0ea5e9",
          cursor: state.cursor,
        });
      });

      setPeers(present);
    };

    const handleStatus = (event: { status: "connected" | "disconnected" }) =>
      setStatus(event.status);

    provider.on("status", handleStatus);
    provider.awareness.on("update", handleAwarenessUpdate);

    provider.awareness.setLocalState({
      user: { name: userName, color: userColor },
      cursor: { from: 0, to: 0 },
    });

    return () => {
      yText.unobserve(handleTextUpdate);
      provider.awareness.off("update", handleAwarenessUpdate);
      provider.off("status", handleStatus);
      provider.destroy();
      doc.destroy();
    };
  }, [userColor, userName]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    const yText = textRef.current;
    if (!yText) return;

    const selectionStart = e.target.selectionStart ?? nextValue.length;
    const selectionEnd = e.target.selectionEnd ?? selectionStart;

    yText.doc?.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, nextValue);
    });

    valueRef.current = nextValue;
    setValue(nextValue);
    updateLocalCursor({ from: selectionStart, to: selectionEnd });
  };

  const handleSelectionChange = (e: SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    updateLocalCursor({
      from: target.selectionStart ?? 0,
      to: target.selectionEnd ?? target.selectionStart ?? 0,
    });
  };

  const otherPeers = peers.filter((peer) => peer.name !== userName);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 py-12">
      <div className="rounded-2xl border bg-card/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Experimental
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Real-time Collaboration (Yjs)
            </h1>
            <p className="text-muted-foreground">
              Shared text state synced through a Yjs document with cursor awareness via
              y-websocket. Default server: {DEFAULT_ENDPOINT}. Override with
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
                NEXT_PUBLIC_COLLAB_WEBSOCKET
              </code>
              .
            </p>
          </div>
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              status === "connected"
                ? "bg-green-500/10 text-green-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status === "connected" ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            {status === "connected" ? "Live" : "Reconnecting..."}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <p className="text-sm font-medium text-muted-foreground">
                You ({userName})
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Room: {process.env.NEXT_PUBLIC_COLLAB_ROOM ?? DEFAULT_ROOM}
            </p>
          </div>

          <textarea
            value={value}
            onChange={handleChange}
            onSelect={handleSelectionChange}
            className="h-80 w-full rounded-xl border bg-background p-4 font-mono text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Start typing to sync with other peers..."
          />
        </div>

        <div className="rounded-2xl border bg-card/70 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Presence</h2>
            <span className="text-xs text-muted-foreground">
              {peers.length} online
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {otherPeers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other peers connected yet. Open this page in another tab to see
                cursors and edits sync live.
              </p>
            ) : (
              otherPeers.map((peer) => (
                <div
                  key={peer.id}
                  className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: peer.color }}
                    />
                    <span className="text-sm font-medium">{peer.name}</span>
                  </div>
                  {peer.cursor ? (
                    <span className="text-xs text-muted-foreground">
                      Cursor: {peer.cursor.from}
                      {peer.cursor.to !== peer.cursor.from
                        ? `–${peer.cursor.to}`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No cursor</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
