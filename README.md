# Arcidium v0.2.0 — Real-time + Offline-first Knowledge Base

Self-hostable, privacy-first knowledge base with real-time collaborative editing (Yjs), offline persistence, and full-text search.

Runs anywhere — gaming PC, Framework laptop, Raspberry Pi, or cloud VM.

## Features

- Real-time collaborative editing (multi-user, live cursors)
- Offline-first — works without internet
- Full-text search across your notes
- Multi-arch Docker (x86_64 + ARM64)
- Zero external services
- Built with Next.js + Yjs + SQLite

## Quick Start (Docker — 30 seconds)

```bash
docker run -d \
  --name arcidium \
  -p 3000:3000 \
  -v arcidium-data:/app/data \
  --restart unless-stopped \
  ghcr.io/codeman86/arcidium:latest
```
