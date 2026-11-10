# Talkentry Web Example

Vite + React DOM demo for `@talkentry/web`. It does not use `@talkentry/react-native` or react-native-web.

## Setup and run

Start the talkentry-example server (API `3087`). From the repository root:

```bash
npm install --ignore-scripts
npm run docker:up
npm run server
npm run web
```

Open `http://127.0.0.1:5173`. By default the demo talks to the Vite origin and proxies `/chats`, `/uploads` and `/socket.io` to `http://127.0.0.1:3087`, so the browser does not need CORS on port 3087. Socket.IO is on the same origin (not REST polling). Override with `VITE_TALKENTRY_API_URL` only when that origin allows the page. Pass `realtimeUrl: false` only if the host cannot proxy WebSocket. The demo uses chat `demo` and user `user-1`.

A successful Vite start does not by itself prove the demo is ready for a production host.
