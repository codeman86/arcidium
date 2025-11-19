# Arcidium

Arcidium is an open source, self-hostable knowledge base with a slick UI, full-text search, editor tools, and easy homelab deployment.

## Getting Started

```bash
npm install
npm run dev
```

Then visit [http://localhost:3000](http://localhost:3000) to see the app.

## Roadmap

- Markdown-first content storage with front matter metadata
- WYSIWYG editor that exports clean Markdown
- Rich search across tags, categories, and full document text
- Self-hosting recipes for Docker, Kubernetes, and bare-metal installs

## License

MIT © Cody (codeman86)

## Real-time Collaboration (Yjs demo)

- A basic collaborative editing demo lives at `/docs/test-collab`.
- Defaults to `wss://demos.yjs.dev` for the Yjs WebSocket server; override with `NEXT_PUBLIC_COLLAB_WEBSOCKET`.
- Room name defaults to `arcidium-test-collab`; override with `NEXT_PUBLIC_COLLAB_ROOM`.
- Open the page in multiple tabs to see shared text and cursor presence sync live.
