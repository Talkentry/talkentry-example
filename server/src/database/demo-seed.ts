export const DEMO_CHAT_ID = 'demo';
export const DEMO_SEED_COUNT = 500;
export const DEMO_SYSTEM_MESSAGE_ID = `${DEMO_CHAT_ID}__system_created`;

const MINUTE_MS = 60_000;

const LINES = [
  'Hey, are you around?',
  'Yes. I just opened the chat.',
  'The history should already be here when the app starts.',
  'Scroll up — the older notes stay in order.',
  'I will send a few more so the tail keeps moving.',
  'Sounds good. I am reading from the other side.',
  'This one is short.',
  'And this one is a bit longer, so the bubble wraps on a phone.',
  'Can you still see the latest message after a reload?',
  'Yes. It comes back from the database, not from the screen.',
  'Try opening a second window on the same chat.',
  'The new line showed up there too.',
  'What about a message from yesterday?',
  'Those are the ones further up the list.',
  'Alright. I will leave the rest of the thread as it is.',
  'Caught up.',
] as const;

export type DemoSeedRow = {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  status: 'read';
  replyCount: number;
  reactions: [];
  attachments: [];
  metadata: Record<string, unknown>;
  revision: number;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
};

/** System notice first, then DEMO_SEED_COUNT dialogue rows. Sequences stay contiguous. */
export const buildDemoSeed = (input: {
  nextSequence: number;
  now: number;
  includeSystem: boolean;
}): { rows: DemoSeedRow[]; nextSequence: number } => {
  const rows: DemoSeedRow[] = [];
  let sequence = input.nextSequence;
  const dialogueStart = input.now - DEMO_SEED_COUNT * MINUTE_MS;

  if (input.includeSystem) {
    sequence += 1;
    const at = new Date(dialogueStart - MINUTE_MS);

    rows.push({
      id: DEMO_SYSTEM_MESSAGE_ID,
      chatId: DEMO_CHAT_ID,
      senderId: 'system',
      text: 'Chat created',
      status: 'read',
      replyCount: 0,
      reactions: [],
      attachments: [],
      metadata: { system: true },
      revision: 1,
      sequence,
      createdAt: at,
      updatedAt: at,
    });
  }

  for (let index = 1; index <= DEMO_SEED_COUNT; index += 1) {
    sequence += 1;
    const at = new Date(dialogueStart + (index - 1) * MINUTE_MS);
    const fromPeer = index % 2 === 1;

    rows.push({
      id: `demo-seed-${String(index).padStart(4, '0')}`,
      chatId: DEMO_CHAT_ID,
      senderId: fromPeer ? 'user-2' : 'user-1',
      text: LINES[(index - 1) % LINES.length],
      status: 'read',
      replyCount: 0,
      reactions: [],
      attachments: [],
      metadata: {},
      revision: 1,
      sequence,
      createdAt: at,
      updatedAt: at,
    });
  }

  return { rows, nextSequence: sequence };
};
