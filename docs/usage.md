# Usage Guide

> **Audience:** users | **Status:** complete
> **Source of truth:** `client/src/context/*`, `client/src/panels/*`

This guide explains how to use QWRY day to day: searching, saving results, organizing them in
workspaces, and using the research tools (reader, summarizer, chat, canvas). First run is covered in
[getting-started](getting-started.md).

---

## Home screen

The home screen shows a quick-search bar and your list of workspaces. Choose or create a profile,
pick a workspace, or jump straight into a search.

![Home view](../assets/screenshots/home-view.png)
*<TBD: screenshot>*

![Home full-page view](../assets/screenshots/home-fullpage.png)
*<TBD: screenshot>*

## Searching

1. Type a query in the search bar (suggestions appear as you type) and press **Enter**.
2. Results stream in from the configured provider. Web results show in the **Sources** panel;
   images, videos, news, and infoboxes show in the **Discovery** panel.
3. Use the category filter and **Load more** to paginate through results.

![Search results](../assets/screenshots/search-results.png)
*<TBD: screenshot>*

### AI overview

The **SearchAssist** tab generates an AI overview for the current query (Ollama). Three modes:

| Mode | What it produces |
|---|---|
| Short | A 1–2 sentence direct answer |
| Elaborate | A comprehensive structured overview from model knowledge |
| Study | A report synthesized from the top search results (reads the pages) |

![AI overview](../assets/screenshots/search-overview.png)
*<TBD: screenshot>*

Overviews are cached per query, so revisiting a query is instant.

## Saving results into a workspace

- **Drag and drop** a result card onto the active workspace (drop anywhere — the drop target is
  currently not validated).
- **Click +** on any result card to add it immediately.
- **Transfer all** moves every current result (web, image, video, news) at once; a summary reports
  how many were created, duplicated, or rejected.

> Demo: <video controls width="720" src="../assets/videos/search-drag-drop.mp4">
>   <a href="../assets/videos/search-drag-drop.mp4">Download drag-and-drop demo</a>
> </video>
> *<TBD: video>*

## Workspaces

A workspace is a named collection of saved items. Create one from the home screen, then:

- **Rename / delete / switch** workspaces from the workspace header.
- **Reorder** items by dragging them.
- **Summarize** an item inline (LLM summary saved to the item).
- **Chat** about the workspace — ask questions grounded in your saved items.

![Workspace view](../assets/screenshots/workspace.png)
*<TBD: screenshot>*

## Station

The Station tab organizes each workspace's material into collections:

| Collection | Purpose |
|---|---|
| Items | Saved pages (sources) |
| Reads | Reading list with `unread / reading / completed` status |
| Highlights | Annotated quotes (create/edit/delete via API) |
| Notes | Free-form research notes (pin, edit, delete) |
| Images / Videos | Saved media |
| Tags | Label items and filter by them |
| Comparisons | Side-by-side source comparison |
| Timeline | Activity log of created entities |

![Station view](../assets/screenshots/station.png)
*<TBD: screenshot>*

![Compare panel](../assets/screenshots/station-compare.png)
*<TBD: screenshot>*

## Canvas

The Canvas tab renders your workspace as a visual mind-map:

- **Nodes** are created automatically from station items (sources, notes, images, videos).
- **Drag** nodes to position them, **pan** the viewport, **wheel** to zoom.
- **Connect** nodes to show relationships; add inline notes directly on the canvas.
- Use the minimap and **fit-to-screen** to navigate.

![Canvas view](../assets/screenshots/canvas.png)
*<TBD: screenshot>*

> Demo: <video controls width="720" src="../assets/videos/canvas-interaction.mp4">
>   <a href="../assets/videos/canvas-interaction.mp4">Download canvas demo</a>
> </video>
> *<TBD: video>*

## Reader

Open any link in the Reader tab to extract its readable content. The reader detects content type:

- **Articles** — text extracted with `trafilatura`.
- **Images** — shown directly.
- **YouTube videos** — meta description + thumbnail.

![Reader view](../assets/screenshots/reader.png)
*<TBD: screenshot>*

Reads are saved to your reading history.

## Summarizer

Paste a URL into the Summarizer tab to get an LLM summary. Summaries are content-aware (article /
image / video prompts differ) and saved to your summary history.

![Summarizer view](../assets/screenshots/summarizer.png)
*<TBD: screenshot>*

## Workspace chat

The **Chat** button in a workspace opens a chat grounded in that workspace's items. The assistant
reads up to five items (articles fetched and truncated) and answers with numbered source
citations. Chat history is persisted and reloaded on open.

![Chat modal](../assets/screenshots/chat.png)
*<TBD: screenshot>*

> Demo: <video controls width="720" src="../assets/videos/chat-citations.mp4">
>   <a href="../assets/videos/chat-citations.mp4">Download chat demo</a>
> </video>
> *<TBD: video>*

## Profiles, history & settings

- **Profiles** — per-session identity; create/switch profiles from the settings popup. Profile
  holds username, theme, and default search provider.
- **History** — search history, reading list, summary list, and activity log are available via the
  API (partial UI).
- **Theme** — toggle light/dark; the choice is stored on your profile.

![Settings popup](../assets/screenshots/settings.png)
*<TBD: screenshot>*

## Related documentation

- [Getting Started](getting-started.md) — setup and first run
- [Configuration](configuration.md) — providers, models, cache
- [Troubleshooting](troubleshooting.md) — common issues
