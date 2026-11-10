import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/drizzle.provider';
import * as schema from '../database/schema';
import { chatEvents } from '../database/schema';
import type { ChatEventDto, ChatEventsPageDto } from './chat.types';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const isDurable = (event: ChatEventDto): boolean =>
  event.type !== 'typing.updated';

@Injectable()
export class EventJournalService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Persist a durable event and return it with journal cursor.
   * Typing is ephemeral — returned unchanged without a cursor.
   */
  async append(chatId: string, event: ChatEventDto): Promise<ChatEventDto> {
    if (!isDurable(event)) return event;
    const [row] = await this.db
      .insert(chatEvents)
      .values({
        chatId,
        type: event.type,
        payload: event,
      })
      .returning();
    if (!row) return event;
    return { ...event, cursor: row.id } as ChatEventDto;
  }

  async tipCursor(chatId: string): Promise<number | undefined> {
    const rows = await this.db
      .select({ id: chatEvents.id })
      .from(chatEvents)
      .where(eq(chatEvents.chatId, chatId))
      .orderBy(sql`${chatEvents.id} desc`)
      .limit(1);
    return rows[0]?.id;
  }

  async loadAfter(
    chatId: string,
    afterCursor = 0,
    limit = DEFAULT_LIMIT,
  ): Promise<ChatEventsPageDto> {
    const take =
      !limit || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
    const rows = await this.db
      .select()
      .from(chatEvents)
      .where(and(eq(chatEvents.chatId, chatId), gt(chatEvents.id, afterCursor)))
      .orderBy(asc(chatEvents.id))
      .limit(take + 1);

    const hasMore = rows.length > take;
    const pageRows = hasMore ? rows.slice(0, take) : rows;
    const events = pageRows.map((row) => {
      const payload = row.payload as ChatEventDto;
      return { ...payload, cursor: row.id } as ChatEventDto;
    });
    const latestCursor =
      pageRows.length > 0 ? pageRows[pageRows.length - 1].id : afterCursor;

    return { events, latestCursor, hasMore };
  }
}
