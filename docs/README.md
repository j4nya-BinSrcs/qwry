# QWRY Documentation

QWRY is a self-hosted search and research engine. This index links every piece of documentation.
Start with [Getting Started](getting-started.md) if you are new, or the
[README](../README.md) for a quick overview.

---

## User guides

| Doc | What it covers |
|---|---|
| [Getting Started](getting-started.md) | Prerequisites, first run, verifying the stack |
| [Usage Guide](usage.md) | Search, workspaces, station, canvas, reader, chat |
| [Configuration](configuration.md) | Environment variables, engine CLI, qwry.toml |

## Developer reference

| Doc | What it covers |
|---|---|
| [Architecture](architecture.md) | System design, data flow, service topology |
| [Server](server.md) | FastAPI backend: services, session model, cache |
| [Engine](engine.md) | Rust crawler, Tantivy indexer, search modes, HTTP API |
| [Client](client.md) | React frontend: views, stores, drag-and-drop |
| [Database](database.md) | Models, relationships, migration state |
| [API Reference](api-reference.md) | Every REST endpoint, grouped |
| [Development](development.md) | Running tests, linting, contributing |

## Operations & security

| Doc | What it covers |
|---|---|
| [SearXNG](searxng.md) | SearXNG integration, Docker Compose, settings |
| [Deployment](deployment.md) | Production setup, reverse proxy, backups |
| [Security](security.md) | Session model, ownership model, known gaps |
| [Troubleshooting](troubleshooting.md) | Common issues and fixes |
| [Known Issues](known-issues.md) | Current bugs and limitations |

## Media

Screenshots live in [assets/screenshots](assets/screenshots/) and demo videos in
[assets/videos](assets/videos/). Items marked `<TBD: screenshot>` / `<TBD: video>` in the docs are
placeholders waiting for media to be captured.

## Conventions

- Plain Markdown, rendered on GitHub.
- Diagrams use inline [Mermaid](https://mermaid.js.org/) blocks.
- Media is referenced with relative paths from the referencing doc.
- See [templates/doc-template.md](templates/doc-template.md) for the doc format.
