export const resolveTalkentryApiUrl = (): string =>
  import.meta.env.VITE_TALKENTRY_API_URL ?? window.location.origin;
