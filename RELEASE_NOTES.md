# Arcidium v0.1.0 - Self-Hostable Knowledge Base

## Features

- WYSIWYG Editor (Tiptap) with autosave, draft mode, slug validation
- Full-Text Search (FlexSearch + SWR + `/api/search/index`)
- Realtime Sync (SSE at `/api/events` + backfill)
- Themes: Light / Dark / Dracula
- Admin UX: Recently saved, "New" badges, toast feedback
- Security: XSS/traversal audit, headers, Zod validation
- DX Pipeline: ESLint, Prettier, Husky v9, lint-staged

## Self-Host

```bash
git clone https://github.com/codeman86/arcidium
cd arcidium
npm install
npm run dev
```

## Next

- Docker + non-root
- GitHub Release + tag
