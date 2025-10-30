# Global Activity Sidebar – Concept Note

## Goals
- Provide a persistent, glanceable feed of recent knowledge base changes across Arcidium.
- Highlight brand-new additions and resurfaced documents so admins and readers can spot updates quickly.
- Reuse existing filesystem/Markdown metadata today, while leaving room for realtime backends later.

## Proposed UX
- **Placement**: Right-hand sidebar on large screens (≥1024 px). Collapsible overlay for smaller breakpoints or mobile.
- **Content**:
  - Title + count of surfaced items.
  - List of the latest 5–8 articles sorted by `updated` (falling back to `created`).
  - Each row shows title (links to article), slug, category, relative time (`Updated 14 minutes ago`), quick “View” and “Download” actions.
  - Badge “New” for items updated within the last 72 hours.
  - Footer text indicating data freshness + future realtime plans.
- **Integration**: First-class on `/admin` (ships today), optional `Cmd+K` overlay or mini-panel on `/docs` later.

## Data Flow
1. Use existing `listArticleMetadata()` to collect slug, title, category, tags, created/updated timestamps.
2. Sort by `updated ?? created`, take the top N.
3. Compute `isNew` by comparing timestamp to `Date.now()` (configurable threshold).
4. Render on the server for deterministic HTML; enhance with toasts when saves occur client-side.
5. Long-term: swap for API endpoint fed by file watchers (fsnotify) or database triggers, enabling realtime updates without full rerender.

## Implementation Status (Prototype)
- `components/activity/activity-sidebar.tsx`: server component generating the list (top 8) with badges and relative time.
- `lib/date/format-distance.ts`: tiny helper around `Intl.RelativeTimeFormat`.
- `/admin` layout now renders the sidebar beside the editor (with `Suspense` fallback skeleton).
- Recent saves recorded client-side in `AdminEditorShell` seed the sidebar with a local feed; body copy explains scope.

## Next Iterations
1. **Global roll-out**: expose toggle in header to open the sidebar on any page.
2. **Filters**: filter by category/tag, optionally feed search index.
3. **Realtime**: stream updates from file-system watchers or DB events to avoid refresh.
4. **Notifications**: integrate with toast center when teammates publish or update articles.

## Open Questions
- Should drafts (marked `draft: true`) appear in the feed by default?
- How many items should the global feed show before linking to a dedicated “Activity” page?
- Would teams want per-category notifications for updates?
