import {
  bigint,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const talkentraSchema = pgSchema('talkentra');

export const chats = talkentraSchema.table('chats', {
  id: text('id').primaryKey(),
  title: text('title'),
  /** Next message sequence to allocate (last assigned value). */
  nextSequence: bigint('next_sequence', { mode: 'number' })
    .notNull()
    .default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messages = talkentraSchema.table(
  'messages',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull(),
    localId: text('local_id'),
    text: text('text'),
    status: text('status').notNull().default('sent'),
    replyToId: text('reply_to_id'),
    /**
     * Root message id when this row lives in a thread. Null = main channel spine.
     * Thread replies never appear in main history pages.
     */
    threadId: text('thread_id'),
    /** Aggregated reply count on a root (main-channel) message. */
    replyCount: integer('reply_count').notNull().default(0),
    /** Grouped reactions: [{ emoji, userIds }]. */
    reactions: jsonb('reactions')
      .$type<{ emoji: string; userIds: string[] }[]>()
      .notNull()
      .default([]),
    attachments: jsonb('attachments').$type<unknown[]>().notNull().default([]),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** Monotonic per-message version; bumps on content/status changes. */
    revision: integer('revision').notNull().default(1),
    /** Monotonic per-chat order; preferred over createdAt for pagination. */
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('messages_chat_id_local_id_uidx').on(
      table.chatId,
      table.localId,
    ),
    uniqueIndex('messages_chat_id_sequence_uidx').on(
      table.chatId,
      table.sequence,
    ),
  ],
);

/** Durable per-chat event journal for reconnect replay (not typing). */
export const chatEvents = talkentraSchema.table(
  'chat_events',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('chat_events_chat_id_id_idx').on(table.chatId, table.id)],
);
