# Talkentry Example

Expo demo for the Talkentry SDK. The reference API and database live in `server/` of talkentry-example.

## Setup and run

From the talkentry-example root, with Node from `.nvmrc`:

```bash
npm install --ignore-scripts
npm run docker:up
npm run server
npm run mobile
```

Native runs need an environment/build that includes the used native modules. A JS bundle alone does not prove compatibility with a specific Expo Go version; native Android/iOS acceptance remains a separate gate.

The demo depends on `@talkentry/react-native` `0.0.1` from npm. `@talkentry/core` comes with that package.

## API URL

`apiUrl.ts` uses the LAN host reported by Expo, then `10.0.2.2` on the Android emulator or `localhost` on other platforms. The port is `3087`. A physical phone reaches the server through the same host Metro already uses.

## Verification

The demo uses chat `demo` and user `user-1`; this is not a real auth scheme. Provider and UI should cover send, history load, Latest, and reconnect against the test backend before a pilot.
