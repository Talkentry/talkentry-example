import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';

import { DRIZZLE } from './drizzle.provider';
import {
  buildDemoSeed,
  DEMO_CHAT_ID,
  DEMO_SEED_COUNT,
  DEMO_SYSTEM_MESSAGE_ID,
} from './demo-seed';
import * as schema from './schema';
import { chats, messages } from './schema';

@Injectable()
export class DemoDatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DemoDatabaseService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async onModuleInit(): Promise<void> {
    await migrate(this.db, {
      migrationsFolder: join(process.cwd(), 'drizzle', 'migrations'),
    });

    const inserted = await this.seedDemoChat();

    if (inserted) {
      this.logger.log(
        `Chat "${DEMO_CHAT_ID}" is ready with ${DEMO_SEED_COUNT} messages`,
      );
    }
  }

  /** Fills chat `demo` once. An existing conversation is left untouched. */
  private async seedDemoChat(): Promise<boolean> {
    const present = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, DEMO_CHAT_ID),
          ne(messages.id, DEMO_SYSTEM_MESSAGE_ID),
        ),
      )
      .limit(1);

    if (present[0]) {
      return false;
    }

    await this.db
      .insert(chats)
      .values({ id: DEMO_CHAT_ID, title: 'Demo' })
      .onConflictDoNothing();

    return this.db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(chats)
        .where(eq(chats.id, DEMO_CHAT_ID))
        .for('update')
        .limit(1);
      const chat = locked[0];

      if (!chat) {
        return false;
      }

      const again = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.chatId, DEMO_CHAT_ID),
            ne(messages.id, DEMO_SYSTEM_MESSAGE_ID),
          ),
        )
        .limit(1);

      if (again[0]) {
        return false;
      }

      const system = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.id, DEMO_SYSTEM_MESSAGE_ID))
        .limit(1);
      const seed = buildDemoSeed({
        nextSequence: chat.nextSequence,
        now: Date.now(),
        includeSystem: !system[0],
      });
      const now = new Date();

      await tx.insert(messages).values(seed.rows);
      await tx
        .update(chats)
        .set({ nextSequence: seed.nextSequence, updatedAt: now })
        .where(eq(chats.id, DEMO_CHAT_ID));

      return true;
    });
  }
}
