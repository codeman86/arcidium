---
title: "Getting Started with Arcidium"
summary: "Spin up the knowledge base locally, understand the project structure, and learn how Markdown content flows into the UI."
category: "Guides"
subcategory: "Introduction"
tags:
  - setup
  - overview
  - markdown
created: "2024-01-01"
updated: "2024-03-14"
---

# Welcome to Arcidium

Arcidium pairs a modern Next.js frontend with Markdown-first content. Each article you add to the `content/` directory becomes available in the UI and remains consumable as a raw `.md` file for automation, Git history, or offline viewing.

## Project Layout

- **`app/`** – Routes, layouts, and UI entry points.
- **`content/`** – Your knowledge base. Each category is a folder full of Markdown articles.
- **`components/`** – Reusable design system pieces (buttons, cards, layout primitives).
- **`lib/`** – Server-side utilities for loading Markdown, indexing, and search prep.

## Authoring Markdown

Front matter drives discoverability:

```yaml
---
title: "How we deploy Arcidium"
summary: "CI/CD workflows, environment secrets, and rollback strategies."
category: "Operations"
subcategory: "Deployment"
tags:
  - platform
  - automation
created: "2024-02-05"
updated: "2024-02-12"
---
```

Arcidium automatically parses this information, making it easy to filter and surface relevant knowledge.

## Next Steps

1. Add your first article under `content/<category>/<slug>.md`.
2. Commit the Markdown file to Git so the history doubles as a change log.
3. Sketch the taxonomy (categories, subcategories, tags) that matches how your team searches for answers.

When you run `npm run dev`, visit `http://localhost:3000` to see the feature grid and start wiring the reader/editor experience. More ingestion and search tooling is coming next.
