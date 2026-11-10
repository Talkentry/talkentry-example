import { Chat, defaultTheme, TalkentryProvider, type User } from '@talkentry/web';
import { appendWebUpload, TalkentryServerAdapter } from '../../../adapter/web';

import { resolveTalkentryApiUrl } from './apiUrl';

const apiUrl = resolveTalkentryApiUrl();
const adapter = new TalkentryServerAdapter({
  baseUrl: apiUrl,
  appendUpload: appendWebUpload,
});

const demoUsers: Readonly<Record<string, User>> = {
  'user-1': { id: 'user-1', name: 'You' },
  'user-2': { id: 'user-2', name: 'Alex' },
  other: { id: 'other', name: 'Alex' },
};

export const App = () => (
  <div style={styles.page}>
    <header style={styles.header}>
      <strong>Talkentry</strong>
      <span style={styles.meta}>{apiUrl} · chat demo · user-1</span>
    </header>
    <TalkentryProvider adapter={adapter} chatId="demo" currentUserId="user-1" scopeKey="web-demo">
      <Chat users={demoUsers} showGapMarkers={false} />
    </TalkentryProvider>
  </div>
);

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
    margin: 0,
    fontFamily: 'system-ui, sans-serif',
    background: defaultTheme.colors.canvas,
    color: defaultTheme.colors.text,
  },
  header: {
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    background: defaultTheme.colors.surface,
    borderBottom: `1px solid ${defaultTheme.colors.border}`,
  },
  meta: { color: defaultTheme.colors.textMuted, fontSize: 12 },
};
