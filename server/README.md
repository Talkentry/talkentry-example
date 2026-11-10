# Talkentry Server

Reference Chat API for local Talkentry SDK development.

This service lives in `talkentry-example/server`, next to the Expo and Vite demos.
The demos install `@talkentry/core`, `@talkentry/web`, and `@talkentry/react-native` from npm. This server is the reference backend and is not part of those packages.

Local only for now. No Kubernetes deploy in this scaffold.

## Port map

| Service  | Port  |
| -------- | ----: |
| API      |  3087 |
| Postgres | 35432 |

No PgBouncer / Redis in the first scaffold. Add them later only when realtime scale or caching actually needs them.

## Stack

- NestJS
- PostgreSQL 18
- Drizzle ORM
- Socket.IO on the API origin (`chat:join`, `chat:leave`, `chat:event`)

## Quick start

```bash
cp .env.example .env
npm install
npm run docker:up
npm run start:dev
```

Check:

- API: http://localhost:3087
- Health: http://localhost:3087/health
- Swagger: http://localhost:3087/docs

Stop infra:

```bash
npm run docker:down
```

`docker:down` stops the container and keeps the named Postgres volume `talkentra_pg_data`.

## Project layout

```text
talkentry-server/
├── docker-compose.yml
├── drizzle/
├── src/
│   ├── chat/              # messages REST + in-process events
│   ├── database/
│   ├── health/
│   ├── app.module.ts
│   └── main.ts
└── README.md
```

## Chat API (v1)

Schema: `talkentra.chats`, `talkentra.messages`.

```http
GET  /chats/:chatId/messages?limit=30
GET  /chats/:chatId/messages?beforeId=<id>&limit=30
GET  /chats/:chatId/messages?afterId=<id>&limit=30
GET  /chats/:chatId/messages?aroundId=<id>&limit=30
POST /chats/:chatId/messages
PATCH /chats/:chatId/messages/:messageId
POST /chats/:chatId/receipts
```

Receipts body (status only advances `sent → delivered → read` on peer messages):

```json
{
  "actorId": "user-1",
  "status": "delivered",
  "messageIds": ["msg-id"],
  "upToMessageId": "optional-anchor-id"
}
```

Send body:

```json
{
  "senderId": "user-1",
  "text": "Hello",
  "localId": "optional-client-id"
}
```

Response page shape matches the SDK `MessagePage` (`messages` oldest → newest, `hasMoreBefore` / `hasMoreAfter`, `oldestId` / `newestId`). Each message includes monotonic `revision` and per-chat `sequence`. Pagination uses `sequence`. When consecutive messages in a page skip sequence values, the page includes `gaps: [{ afterId, beforeId, missingCount }]`. Repeating `POST` with the same `localId` in a chat is idempotent: the existing row is returned and realtime fan-out is not duplicated. Sender-only `PATCH` / `DELETE …/messages/:messageId` (body `{ "actorId" }`) edit or hard-delete a row; delete fans out `message.removed` and leaves a sequence hole. Demo media: `POST /uploads` (`multipart/form-data` field `file`, ≤5MB) returns an `AttachmentDto`; files are served from `GET /uploads/:file`. Set `PUBLIC_BASE_URL` (LAN API origin) so stored urls are absolute for phones; otherwise the SDK adapter prefixes its `baseUrl`.

After `docker:up`, `npm run start:dev` prepares the database. The first start fills chat `demo` with 500 messages. A later start leaves that chat unchanged.

Smoke:

```bash
curl -s -X POST http://localhost:3087/chats/demo/messages \
  -H "content-type: application/json" \
  -d "{\"senderId\":\"user-1\",\"text\":\"Hello\"}"

curl -s "http://localhost:3087/chats/demo/messages?limit=10"
```

Socket.IO realtime uses `chat:join` / `chat:leave` / `chat:event` on the same origin. Events fan out to every socket in `chat:{chatId}` (multi-client). Reconnect catch-up is handled by the SDK after transport invalidation; this API has no per-socket replay journal. Auth is not in this slice.

## Relationship to the SDK

```text
@talkentry/react-native
        │
        ▼
   ChatAdapter
        │
        ▼
 TalkentryServerAdapter  →  talkentry-server  (this service)
```

`ChatAdapter` stays universal. This service is one reference backend.
