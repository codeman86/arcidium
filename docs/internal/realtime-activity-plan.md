Realtime Activity Feed PoC (Plan)
====================================

Goal
----
Provide live updates to the admin activity sidebar without requiring manual refresh.

Options Comparison
------------------
1. File-System Watcher (FS Watcher)
   • Use chokidar or fs.watch to watch content/**/*.md for add/change events.
   • Pros: fits current markdown-on-disk setup; no database required.
   • Cons: file notifications can be flaky in WSL; doesn’t scale across multiple nodes without shared storage.

2. Database Event Stream
   • Persist articles to a database (Postgres, SQLite) and emit events via LISTEN/NOTIFY, triggers, or change data capture.
   • Pros: reliable, persistent history, works across cluster.
   • Cons: requires migrating persistence to DB first; more infra.

Recommendation
--------------
Short-term: implement a file watcher on the Node server and broadcast via Server-Sent Events (SSE). Long-term: when Arcidium adopts a DB, transition to DB event stream for resiliency.

PoC Tasks
---------
1. Create API route /api/activity/stream returning SSE responses.
2. Inside route, initialize chokidar watcher on content/**/*.md (store singleton in globalThis to avoid multiple instances in dev).
3. On each add/change, parse metadata (slug, title, updated timestamp) and emit SSE message (event: article-update, data: JSON).
4. Client-side (admin page): open EventSource, append received updates to locally tracked feed (and show toast).
5. Handle disconnect: auto-reconnect with backoff, show offline banner if stream down.
6. Fallback: if SSE unsupported, fall back to polling every N seconds (existing static fetch).
7. Add clean shutdown: close watchers on serverless revalidate or exit.

Next Steps After PoC
--------------------
- Authenticate SSE route once admin area requires login.
- Implement buffer to replay missed events for reconnecting clients.
- When DB adoption happens, replace watcher with DB notification pipeline.
