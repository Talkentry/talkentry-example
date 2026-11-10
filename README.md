# Talkentry Example

Local Talkentry chat you can run on your machine: a reference API, Postgres, a web demo, and an Expo demo.

The SDK packages (`@talkentry/core`, `@talkentry/web`, `@talkentry/react-native`) are not stored in this repository. This repo is the host that wires them to a database.

## Prerequisites

- [Node.js](https://nodejs.org/) 24.22.1 (see `.nvmrc`) and npm 11
- [Docker](https://docs.docker.com/get-docker/) with Compose, for Postgres

## Quick start

From the repository root:

```bash
cp server/.env.example server/.env
npm install --ignore-scripts
npm run docker:up
npm run server
```

Leave the API running, then in another terminal:

```bash
npm run web
```

Open <http://127.0.0.1:5173>. The page talks to the API through the Vite dev server, so the browser does not call port 3087 directly.

Optional native demo:

```bash
npm run mobile
```

## Try it

Both demos sign in as a fixed demo user. There is no authentication.

| Field   | Value    |
| ------- | -------- |
| Chat id | `demo`   |
| User id | `user-1` |

Chat `demo` already contains 500 messages the first time the server starts. Later starts leave that chat as it is, including anything you send. Reload, scroll up for older messages, and open a second client on the same chat to see a new line arrive.

## Services

| Service        | URL                                      |
| -------------- | ---------------------------------------- |
| Web demo       | <http://127.0.0.1:5173>                  |
| API            | <http://127.0.0.1:3087>                  |
| API docs       | <http://127.0.0.1:3087/docs>             |
| Health         | <http://127.0.0.1:3087/health>           |
| Postgres       | `localhost:35432` (`talkentra_db`)       |

Stop Postgres with `npm run docker:down`. That command stops the container and keeps the database volume.

## Configuration

Copy `server/.env.example` to `server/.env` before the first start. The sample uses database user `postgres`, password `example`, and schema `talkentra`. Change those values together with `server/docker-compose.yml` if you do not want the defaults.

| App        | Variable                 | Purpose                                         |
| ---------- | ------------------------ | ----------------------------------------------- |
| `apps/web` | `VITE_TALKENTRY_API_URL` | API origin. Leave unset to use the Vite proxy. |

The mobile demo uses the host Expo already reports, on port `3087`. A phone on the same Wi-Fi reaches the API through that LAN address. The Android emulator falls back to `http://10.0.2.2:3087`, and the iOS simulator to `http://localhost:3087`.

## Project layout

```text
server/          NestJS reference API and Docker Compose for Postgres
adapter/          reference client; native and web only differ in file upload
apps/web/        Vite + React demo of @talkentry/web
apps/mobile/     Expo demo of @talkentry/react-native
```

## Scripts

| Command                    | What it does                                      |
| -------------------------- | ------------------------------------------------- |
| `npm run docker:up`        | Start Postgres                                    |
| `npm run docker:down`      | Stop Postgres                                     |
| `npm run server`           | API with reload on port 3087                      |
| `npm run web`              | Web demo on port 5173                             |
| `npm run mobile`           | Expo demo                                         |
| `npm run typecheck`        | Typecheck the server and both demos               |

## SDK packages

`npm install` downloads the published packages. A sibling SDK checkout is not required.

| Demo | Package | Version |
| ---- | ------- | ------- |
| `apps/mobile` | `@talkentry/react-native` | `0.0.1` |
| `apps/web` | `@talkentry/web` | `0.0.1` |

`@talkentry/core` is installed with those packages. Metro and Vite resolve them from `node_modules`.

## License

[MIT](LICENSE)
