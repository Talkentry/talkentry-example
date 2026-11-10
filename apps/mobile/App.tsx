import {
  type Attachment,
  Chat,
  type Message,
  TalkentryProvider,
  TalkentryThemeProvider,
  type User,
  useTalkentryTheme,
} from '@talkentry/react-native';
import { appendNativeUpload, TalkentryServerAdapter } from '../../adapter/native';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { resolveTalkentryApiUrl } from './apiUrl';
import { pickLocalImage, uploadLocalImage } from './attach';

const apiUrl = resolveTalkentryApiUrl();
const adapter = new TalkentryServerAdapter({
  baseUrl: apiUrl,
  appendUpload: appendNativeUpload,
});

const onCopy = (message: Message) => {
  const text = message.text?.trim();
  if (!text) {
    return;
  }
  Clipboard.setStringAsync(text).catch(() => undefined);
};

const attachPickedImage = async (): Promise<Attachment | null> => {
  const image = await pickLocalImage();
  if (!image) {
    return null;
  }

  return uploadLocalImage(apiUrl, image);
};

const demoUsers: Readonly<Record<string, User>> = {
  'user-1': { id: 'user-1', name: 'You' },
  'user-2': {
    id: 'user-2',
    name: 'Alex',
    avatarUrl: 'https://i.pravatar.cc/128?u=alex',
  },
  other: {
    id: 'other',
    name: 'Alex',
    avatarUrl: 'https://i.pravatar.cc/128?u=alex',
  },
};

/** Built-in bubble, composer, and emoji sheet. No host render slots. */
const StockChat = () => {
  return (
    <Chat
      users={demoUsers}
      showGapMarkers={false}
      onCopy={onCopy}
      composerProps={{ onAttach: attachPickedImage }}
    />
  );
};

const DemoChrome = () => {
  const theme = useTalkentryTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.canvas }]}
      edges={['top', 'left', 'right']}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>Talkentry</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          built-in · {apiUrl}
        </Text>
      </View>
      <View style={styles.chat}>
        <TalkentryProvider adapter={adapter} chatId="demo" currentUserId="user-1">
          <StockChat />
        </TalkentryProvider>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
};

const App = () => (
  <SafeAreaProvider>
    <KeyboardProvider>
      <TalkentryThemeProvider>
        <DemoChrome />
      </TalkentryThemeProvider>
    </KeyboardProvider>
  </SafeAreaProvider>
);

export default App;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  chat: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
});
