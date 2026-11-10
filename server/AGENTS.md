# AGENTS.md — Talkentra Server

Instructions for any coding agent (Cursor, Perplexity, ChatGPT, Copilot, …).
Cursor also mirrors these in `.cursor/rules/`.

## Role

Reference Chat API for the independent Talkentra SDK/platform (not a bank-specific backend).

The demos depend on the published `@talkentry` packages. This repository does not contain the SDK source.
This service grows History + realtime capabilities the SDK needs, without embedding host business rules.

Two humans may work in parallel; keep this file aligned with the SDK brief so any AI session knows the shared path.

## Where we are (update when stage changes)

**Goal:** reference backend for `@talkentry/react-native` — reproducible demo, not a product bank API.

### Done on `develop`

| Capability           | Notes                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| REST history         | `GET/POST /chats/:chatId/messages` — latest / before / after / around by `sequence`                                      |
| Send                 | persists + publishes in-process events                                                                                   |
| Idempotent send      | unique `(chat_id, local_id)`; retry returns same row, no duplicate fan-out                                               |
| Revisions / sequence | DTO fields `revision` + per-chat monotonic `sequence`                                                                    |
| Socket.IO realtime   | same origin `:3087` — `chat:join` / `chat:leave` / `chat:event`                                                          |
| Fan-out              | `ChatEventsService` → `ChatGateway` rooms `chat:{chatId}` (multi-client)                                                 |
| LAN bind             | listen `0.0.0.0` for Expo Go on a phone                                                                                  |
| Receipts             | `POST /chats/:chatId/receipts` — `delivered` / `read`; rank-only; fan-out `message.status`                               |
| Gaps                 | history pages may include `gaps[]` when consecutive `sequence` values skip                                               |
| Edit                 | `PATCH /chats/:chatId/messages/:messageId` — sender-only; bumps `revision`; `message.updated`                            |
| Reply                | `replyToId` on send; must reference a message in the same chat                                                           |
| Delete               | `DELETE /chats/:chatId/messages/:messageId` — sender-only hard delete; `message.removed`; sequence gap                   |
| Uploads              | `POST /uploads` multipart `file` → AttachmentDto; static `GET /uploads/:file` (demo disk, ≤5MB)                          |
| Reactions            | `POST …/messages/:id/reactions` any single emoji, one per user (same removes, other replaces); fan-out `message.updated` |
| Threads              | `threadId` on send; main history = roots only; `?threadId=` includes root + replies; `replyCount`                        |
| Window reconcile     | `POST …/messages/reconcile` — batch current state / removedIds for known ids (reconnect barrier)                         |
| Typing               | `POST …/typing` in-memory TTL; fan-out `typing.updated` `{ userIds }`                                                    |
| System messages      | `metadata.system` → DTO `system`; seed `Chat created` on first ensureChat                                                |
| Event journal        | table `chat_events`; `GET /chats/:id/events?afterCursor=`; cursor on durable fan-out                                     |

Reconnect: SDK prefers journal replay when `eventCursor` known; else catch-up via `loadAfter` at tip + window reconcile.

### Next (priority, with SDK)

1. Auth later (demo stays open); no bank-specific rules; journal retention budgets later

SDK already consumes Socket.IO in `TalkentraServerAdapter`; keep event DTOs aligned with SDK `ChatEvent`.

## Local infra

- API + Socket.IO: `3087` (`0.0.0.0`, events `chat:join` / `chat:leave` / `chat:event`)
- Postgres: `35432` (compose project `talkentra`)

Postgres 18+ Docker volume: mount `/var/lib/postgresql`, not `/var/lib/postgresql/data`.

## Migrations

Use only:

```bash
npm run migration:generate
npm run migration:migrate
```

If migrate fails, fix SQL/config/schema clash (e.g. `CREATE SCHEMA IF NOT EXISTS`). Do not add custom one-off migrate scripts.

The example process applies this folder on startup and, when chat `demo` has no dialogue, inserts 500 messages. Do not put that sample history into a migration, and do not tell demo users to run migrate.

## Style

- Arrow functions for helpers.
- Nest controllers/services stay as classes with methods (DI / `this`).

## Git

Base branch: `develop`. Changes only via PR. Commits/PRs only when the human asks.

### Branches

Latin `kebab-case`, short, one concern:

```text
feature/<short-name>
fix/<short-name>
chore/<short-name>
refactor/<short-name>
docs/<short-name>
```

Examples: `feature/chat-messages-api`, `fix/schema-if-not-exists`, `chore/postgres-18-volume`.

### Commits (Conventional Commits)

Format: `<type>(optional-scope): <short summary>`

- Subject ≤ ~72 chars, imperative mood, no trailing period
- One logical change per commit; no essay body unless needed for _why_
- Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`, `perf`, `style`

```text
feat(chat): add messages list and send endpoints
fix(db): use IF NOT EXISTS for talkentra schema
chore: pin compose project name talkentra
```

Bad: long vague messages (`update stuff`, `fix`, `WIP`), or multi-paragraph subjects.

## How to use with Perplexity / other tools

Attach or paste this file (or `@AGENTS.md`) at the start of the chat so the model follows the same rules as Cursor.
Also attach the SDK `docs/architecture.md` when changing history/realtime contracts.
Update the **Where we are** section when a milestone lands on `develop`.
