import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DeleteMessageDto } from './dto/delete-message.dto';
import type { EditMessageDto } from './dto/edit-message.dto';
import type { ReactMessageDto } from './dto/react-message.dto';
import type { ReconcileMessagesDto } from './dto/reconcile-messages.dto';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { DRIZZLE } from '../database/drizzle.provider';
import * as schema from '../database/schema';
import { chats, messages } from '../database/schema';
import { ChatEventsService } from './chat-events.service';
import type {
  ChatEventDto,
  MessageDto,
  MessagePageDto,
  MessageStatus,
  ReactionDto,
  ReconcileMessagesResultDto,
} from './chat.types';
import type { SendMessageDto } from './dto/send-message.dto';
import type { UpdateReceiptsDto } from './dto/update-receipts.dto';
import { EventJournalService } from './event-journal.service';
import { applyReactionToggle, isSingleEmoji } from './reactions';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MAX_RECEIPT_BATCH = 100;
const MAX_RECONCILE_BATCH = 200;
const statusRank: Record<MessageStatus, number> = {
  sending: 0,
  failed: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly chatEvents: ChatEventsService,
    private readonly journal: EventJournalService,
  ) {}

  async ensureChat(chatId: string, title?: string): Promise<void> {
    await this.db
      .insert(chats)
      .values({
        id: chatId,
        title: title ?? chatId,
      })
      .onConflictDoNothing();
    await this.ensureSystemCreatedNotice(chatId);
  }

  async loadEvents(
    chatId: string,
    afterCursor?: number,
    limit?: number,
  ): Promise<import('./chat.types').ChatEventsPageDto> {
    await this.ensureChatExistsOrEmpty(chatId);
    return this.journal.loadAfter(chatId, afterCursor ?? 0, limit);
  }

  async loadLatest(
    chatId: string,
    limit = DEFAULT_LIMIT,
    threadId?: string,
  ): Promise<MessagePageDto> {
    await this.ensureChatExistsOrEmpty(chatId);
    const take = this.normalizeLimit(limit);

    const rows = await this.db
      .select()
      .from(messages)
      .where(this.scopeWhere(chatId, threadId))
      .orderBy(desc(messages.sequence), desc(messages.id))
      .limit(take + 1);

    const hasMoreBefore = rows.length > take;
    const pageRows = hasMoreBefore ? rows.slice(0, take) : rows;
    pageRows.reverse();

    return this.toPage(chatId, pageRows, hasMoreBefore, false);
  }

  async loadBefore(
    chatId: string,
    beforeId: string,
    limit = DEFAULT_LIMIT,
    threadId?: string,
  ): Promise<MessagePageDto> {
    const anchor = await this.requireMessage(chatId, beforeId);
    const take = this.normalizeLimit(limit);
    const scope = threadId ?? anchor.threadId ?? undefined;

    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          this.scopeWhere(chatId, scope),
          lt(messages.sequence, anchor.sequence),
        ),
      )
      .orderBy(desc(messages.sequence), desc(messages.id))
      .limit(take + 1);

    const hasMoreBefore = rows.length > take;
    const pageRows = hasMoreBefore ? rows.slice(0, take) : rows;
    pageRows.reverse();

    return this.toPage(chatId, pageRows, hasMoreBefore, true);
  }

  async loadAfter(
    chatId: string,
    afterId: string,
    limit = DEFAULT_LIMIT,
    threadId?: string,
  ): Promise<MessagePageDto> {
    const anchor = await this.requireMessage(chatId, afterId);
    const take = this.normalizeLimit(limit);
    const scope = threadId ?? anchor.threadId ?? undefined;

    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          this.scopeWhere(chatId, scope),
          gt(messages.sequence, anchor.sequence),
        ),
      )
      .orderBy(asc(messages.sequence), asc(messages.id))
      .limit(take + 1);

    const hasMoreAfter = rows.length > take;
    const pageRows = hasMoreAfter ? rows.slice(0, take) : rows;

    return this.toPage(chatId, pageRows, true, hasMoreAfter);
  }

  /**
   * Window centered on `aroundId` (oldest → newest), including the anchor.
   * `limit` is the max page size; roughly half the neighbors are before/after.
   */
  async loadAround(
    chatId: string,
    aroundId: string,
    limit = DEFAULT_LIMIT,
    threadId?: string,
  ): Promise<MessagePageDto> {
    const anchor = await this.requireMessage(chatId, aroundId);
    const take = this.normalizeLimit(limit);
    const scope = threadId ?? anchor.threadId ?? undefined;
    const beforeTake = Math.floor((take - 1) / 2);
    const afterTake = take - 1 - beforeTake;

    const beforeRows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          this.scopeWhere(chatId, scope),
          lt(messages.sequence, anchor.sequence),
        ),
      )
      .orderBy(desc(messages.sequence), desc(messages.id))
      .limit(beforeTake + 1);

    const hasMoreBefore = beforeRows.length > beforeTake;
    const beforePage = (
      hasMoreBefore ? beforeRows.slice(0, beforeTake) : beforeRows
    ).reverse();

    const afterRows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          this.scopeWhere(chatId, scope),
          gt(messages.sequence, anchor.sequence),
        ),
      )
      .orderBy(asc(messages.sequence), asc(messages.id))
      .limit(afterTake + 1);

    const hasMoreAfter = afterRows.length > afterTake;
    const afterPage = hasMoreAfter ? afterRows.slice(0, afterTake) : afterRows;

    return this.toPage(
      chatId,
      [...beforePage, anchor, ...afterPage],
      hasMoreBefore,
      hasMoreAfter,
    );
  }

  async send(chatId: string, dto: SendMessageDto): Promise<MessageDto> {
    if (!dto.senderId?.trim()) {
      throw new BadRequestException('senderId is required');
    }

    if (
      !dto.text?.trim() &&
      (!dto.attachments || dto.attachments.length === 0)
    ) {
      throw new BadRequestException('text or attachments are required');
    }

    const attachments = this.normalizeAttachments(dto.attachments);

    await this.ensureChat(chatId);

    if (dto.replyToId?.trim()) {
      await this.requireMessage(chatId, dto.replyToId);
    }

    let threadRoot: typeof messages.$inferSelect | undefined;
    if (dto.threadId?.trim()) {
      threadRoot = await this.requireMessage(chatId, dto.threadId);
      if (threadRoot.threadId) {
        throw new BadRequestException('threadId must reference a root message');
      }
    }

    const result = await this.db.transaction(async (tx) => {
      // Serialize sequence allocation and localId idempotency per chat.
      const locked = await tx
        .select()
        .from(chats)
        .where(eq(chats.id, chatId))
        .for('update')
        .limit(1);
      const chat = locked[0];
      if (!chat) {
        throw new NotFoundException(`Chat ${chatId} not found`);
      }

      if (dto.localId) {
        const existing = await tx
          .select()
          .from(messages)
          .where(
            and(eq(messages.chatId, chatId), eq(messages.localId, dto.localId)),
          )
          .limit(1);

        if (existing[0]) {
          return {
            kind: 'existing' as const,
            row: existing[0],
            root: undefined,
          };
        }
      }

      const now = new Date();
      const id = randomUUID();
      const status: MessageStatus = 'sent';
      const sequence = chat.nextSequence + 1;
      const revision = 1;

      try {
        const [row] = await tx
          .insert(messages)
          .values({
            id,
            chatId,
            senderId: dto.senderId,
            localId: dto.localId,
            text: dto.text,
            status,
            replyToId: dto.replyToId,
            threadId: threadRoot?.id,
            replyCount: 0,
            reactions: [],
            attachments,
            metadata: dto.metadata ?? {},
            revision,
            sequence,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        let root: typeof messages.$inferSelect | undefined;
        if (threadRoot) {
          const [updatedRoot] = await tx
            .update(messages)
            .set({
              replyCount: threadRoot.replyCount + 1,
              revision: threadRoot.revision + 1,
              updatedAt: now,
            })
            .where(
              and(eq(messages.chatId, chatId), eq(messages.id, threadRoot.id)),
            )
            .returning();
          root = updatedRoot;
        }

        await tx
          .update(chats)
          .set({ nextSequence: sequence, updatedAt: now })
          .where(eq(chats.id, chatId));

        return { kind: 'created' as const, row, root };
      } catch (error) {
        // Concurrent retry with the same localId: return the winner's row.
        if (!dto.localId || !this.isUniqueViolation(error)) throw error;
        const existing = await tx
          .select()
          .from(messages)
          .where(
            and(eq(messages.chatId, chatId), eq(messages.localId, dto.localId)),
          )
          .limit(1);
        if (!existing[0]) throw error;
        return { kind: 'existing' as const, row: existing[0], root: undefined };
      }
    });

    const message = this.toDto(result.row);
    if (result.kind === 'created') {
      await this.emit(chatId, { type: 'message.added', message });
      if (result.root) {
        await this.emit(chatId, {
          type: 'message.updated',
          message: this.toDto(result.root),
        });
      }
      if (dto.localId) {
        await this.emit(chatId, {
          type: 'message.status',
          chatId,
          messageId: dto.localId,
          status: message.status ?? 'sent',
          revision: message.revision,
          serverId: message.id,
        });
      }
    }

    return message;
  }

  /**
   * Edit message text. Only the original sender may edit; bumps revision and
   * fans out message.updated (content change, not a receipt).
   */
  async edit(
    chatId: string,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<MessageDto> {
    if (!dto.actorId?.trim()) {
      throw new BadRequestException('actorId is required');
    }
    if (!dto.text?.trim()) {
      throw new BadRequestException('text is required');
    }

    const row = await this.requireMessage(chatId, messageId);
    if (row.senderId !== dto.actorId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }

    const now = new Date();
    const [next] = await this.db
      .update(messages)
      .set({
        text: dto.text.trim(),
        revision: row.revision + 1,
        updatedAt: now,
      })
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .returning();

    if (!next) {
      throw new NotFoundException(
        `Message ${messageId} not found in chat ${chatId}`,
      );
    }

    const message = this.toDto(next);
    await this.emit(chatId, { type: 'message.updated', message });
    return message;
  }

  /**
   * Hard-delete a message. Only the original sender may delete.
   * Leaves a sequence hole (page `gaps[]`); fans out `message.removed`.
   */
  async remove(
    chatId: string,
    messageId: string,
    dto: DeleteMessageDto,
  ): Promise<{ chatId: string; messageId: string; revision: number }> {
    if (!dto.actorId?.trim()) {
      throw new BadRequestException('actorId is required');
    }

    const row = await this.requireMessage(chatId, messageId);
    if (row.senderId !== dto.actorId) {
      throw new ForbiddenException('Only the sender can delete this message');
    }

    const deleted = await this.db
      .delete(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .returning({ id: messages.id });

    if (!deleted[0]) {
      throw new NotFoundException(
        `Message ${messageId} not found in chat ${chatId}`,
      );
    }

    const revision = row.revision;
    await this.emit(chatId, {
      type: 'message.removed',
      chatId,
      messageId,
      revision,
    });
    return { chatId, messageId, revision };
  }

  /**
   * Advance delivery/read status on peer messages (sender !== actor).
   * Status only moves forward; each change bumps revision and fans out message.status.
   */
  async updateReceipts(
    chatId: string,
    dto: UpdateReceiptsDto,
  ): Promise<MessageDto[]> {
    if (!dto.actorId?.trim()) {
      throw new BadRequestException('actorId is required');
    }
    if (dto.status !== 'delivered' && dto.status !== 'read') {
      throw new BadRequestException('status must be delivered or read');
    }
    const ids = dto.messageIds?.filter((id) => !!id?.trim()) ?? [];
    if (!ids.length && !dto.upToMessageId?.trim()) {
      throw new BadRequestException('messageIds or upToMessageId is required');
    }
    if (ids.length > MAX_RECEIPT_BATCH) {
      throw new BadRequestException(`At most ${MAX_RECEIPT_BATCH} messageIds`);
    }

    let candidates: (typeof messages.$inferSelect)[] = [];

    if (ids.length) {
      candidates = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.chatId, chatId),
            inArray(messages.id, ids),
            ne(messages.senderId, dto.actorId),
          ),
        );
    } else {
      const anchor = await this.requireMessage(chatId, dto.upToMessageId!);
      candidates = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.chatId, chatId),
            ne(messages.senderId, dto.actorId),
            lte(messages.sequence, anchor.sequence),
          ),
        )
        .orderBy(desc(messages.sequence))
        .limit(MAX_RECEIPT_BATCH);
    }

    const targetRank = statusRank[dto.status];
    const now = new Date();
    const updated: MessageDto[] = [];

    for (const row of candidates) {
      const current = (row.status as MessageStatus) ?? 'sent';
      if (statusRank[current] >= targetRank) continue;

      const [next] = await this.db
        .update(messages)
        .set({
          status: dto.status,
          revision: row.revision + 1,
          updatedAt: now,
        })
        .where(and(eq(messages.chatId, chatId), eq(messages.id, row.id)))
        .returning();

      if (!next) continue;
      const message = this.toDto(next);
      updated.push(message);
      await this.emit(chatId, {
        type: 'message.status',
        chatId,
        messageId: message.id,
        status: dto.status,
        revision: message.revision,
      });
    }

    return updated;
  }

  /**
   * Refresh known window message ids after reconnect.
   * Present rows return as DTOs; missing ids are treated as hard-deleted.
   */
  async reconcile(
    chatId: string,
    dto: ReconcileMessagesDto,
  ): Promise<ReconcileMessagesResultDto> {
    if (!Array.isArray(dto.messageIds)) {
      throw new BadRequestException('messageIds must be an array');
    }
    const uniqueIds = [
      ...new Set(
        dto.messageIds
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    if (uniqueIds.length > MAX_RECONCILE_BATCH) {
      throw new BadRequestException(
        `messageIds must contain at most ${MAX_RECONCILE_BATCH} ids`,
      );
    }
    if (uniqueIds.length === 0) {
      return { messages: [], removedIds: [] };
    }

    await this.ensureChatExistsOrEmpty(chatId);
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), inArray(messages.id, uniqueIds)));

    const found = new Set(rows.map((row) => row.id));
    return {
      messages: rows.map((row) => this.toDto(row)),
      removedIds: uniqueIds.filter((id) => !found.has(id)),
    };
  }

  /**
   * Set the actor's single reaction: same emoji again removes it, another replaces it.
   * Fans out message.updated with bumped revision.
   */
  async toggleReaction(
    chatId: string,
    messageId: string,
    dto: ReactMessageDto,
  ): Promise<MessageDto> {
    if (!dto.actorId?.trim()) {
      throw new BadRequestException('actorId is required');
    }
    const emoji = dto.emoji?.trim();
    if (!emoji || !isSingleEmoji(emoji)) {
      throw new BadRequestException('Unsupported reaction emoji');
    }

    const row = await this.requireMessage(chatId, messageId);
    const current = this.normalizeReactions(row.reactions);
    const next = applyReactionToggle(current, emoji, dto.actorId);
    const now = new Date();
    const [updated] = await this.db
      .update(messages)
      .set({
        reactions: next,
        revision: row.revision + 1,
        updatedAt: now,
      })
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .returning();

    if (!updated) {
      throw new NotFoundException(
        `Message ${messageId} not found in chat ${chatId}`,
      );
    }

    const message = this.toDto(updated);
    await this.emit(chatId, { type: 'message.updated', message });
    return message;
  }

  private scopeWhere(chatId: string, threadId?: string) {
    if (threadId) {
      return and(
        eq(messages.chatId, chatId),
        or(eq(messages.threadId, threadId), eq(messages.id, threadId)),
      );
    }
    return and(eq(messages.chatId, chatId), isNull(messages.threadId));
  }

  private normalizeReactions(raw: unknown): ReactionDto[] {
    if (!Array.isArray(raw)) return [];
    const out: ReactionDto[] = [];
    for (const item of raw) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof (item as ReactionDto).emoji !== 'string' ||
        !Array.isArray((item as ReactionDto).userIds)
      ) {
        continue;
      }
      const emoji = (item as ReactionDto).emoji;
      const userIds = [
        ...new Set((item as ReactionDto).userIds.filter((id) => !!id?.trim())),
      ];
      if (userIds.length) out.push({ emoji, userIds });
    }
    return out;
  }

  private normalizeAttachments(
    raw: SendMessageDto['attachments'],
  ): MessageDto['attachments'] {
    if (!raw?.length) return [];
    if (raw.length > 8) {
      throw new BadRequestException('At most 8 attachments per message');
    }
    const kinds = new Set(['image', 'file', 'audio', 'video', 'custom']);
    return raw.map((item, index) => {
      if (!item?.id?.trim() || !kinds.has(String(item.type))) {
        throw new BadRequestException(`Invalid attachment at index ${index}`);
      }
      if (item.url !== undefined && typeof item.url !== 'string') {
        throw new BadRequestException(
          `Invalid attachment url at index ${index}`,
        );
      }
      return {
        id: item.id.trim(),
        type: item.type,
        url: item.url,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        width: item.width,
        height: item.height,
        durationMs: item.durationMs,
        metadata: item.metadata,
      };
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }

  private async ensureChatExistsOrEmpty(chatId: string): Promise<void> {
    const existing = await this.db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!existing[0]) {
      // Empty history for unknown chat is valid for first open.
      return;
    }
  }

  private async requireMessage(chatId: string, messageId: string) {
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.id, messageId)))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(
        `Message ${messageId} not found in chat ${chatId}`,
      );
    }

    return rows[0];
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit) || limit <= 0) {
      return DEFAULT_LIMIT;
    }

    return Math.min(limit, MAX_LIMIT);
  }

  private async emit(chatId: string, event: ChatEventDto): Promise<void> {
    const recorded = await this.journal.append(chatId, event);
    this.chatEvents.publish(chatId, recorded);
  }

  /** One durable system notice when a chat is first created. */
  private async ensureSystemCreatedNotice(chatId: string): Promise<void> {
    const id = `${chatId}__system_created`;
    const existing = await this.db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.id, id)))
      .limit(1);
    if (existing[0]) return;

    await this.db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(chats)
        .where(eq(chats.id, chatId))
        .for('update')
        .limit(1);
      const chat = locked[0];
      if (!chat) return;
      const again = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.chatId, chatId), eq(messages.id, id)))
        .limit(1);
      if (again[0]) return;
      const now = new Date();
      const sequence = chat.nextSequence + 1;
      await tx.insert(messages).values({
        id,
        chatId,
        senderId: 'system',
        text: 'Chat created',
        status: 'sent',
        replyCount: 0,
        reactions: [],
        attachments: [],
        metadata: { system: true },
        revision: 1,
        sequence,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .update(chats)
        .set({ nextSequence: sequence, updatedAt: now })
        .where(eq(chats.id, chatId));
    });
  }

  private async toPage(
    chatId: string,
    rows: (typeof messages.$inferSelect)[],
    hasMoreBefore: boolean,
    hasMoreAfter: boolean,
  ): Promise<MessagePageDto> {
    const mapped = rows.map((row) => this.toDto(row));
    const gaps = this.gapsFromRows(rows);
    const eventCursor = await this.journal.tipCursor(chatId);
    return {
      messages: mapped,
      hasMoreBefore,
      hasMoreAfter,
      oldestId: mapped[0]?.id,
      newestId: mapped[mapped.length - 1]?.id,
      ...(gaps.length ? { gaps } : {}),
      ...(eventCursor !== undefined ? { eventCursor } : {}),
    };
  }

  /** Sequence holes inside a page (e.g. deleted rows) — never silently ignored. */
  private gapsFromRows(
    rows: (typeof messages.$inferSelect)[],
  ): { afterId: string; beforeId: string; missingCount: number }[] {
    const gaps: { afterId: string; beforeId: string; missingCount: number }[] =
      [];
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1];
      const next = rows[i];
      const delta = next.sequence - prev.sequence;
      if (delta > 1) {
        gaps.push({
          afterId: prev.id,
          beforeId: next.id,
          missingCount: delta - 1,
        });
      }
    }
    return gaps;
  }

  private toDto(row: typeof messages.$inferSelect): MessageDto {
    const reactions = this.normalizeReactions(row.reactions);
    const system = row.metadata?.system === true;
    return {
      id: row.id,
      localId: row.localId ?? undefined,
      chatId: row.chatId,
      senderId: row.senderId,
      text: row.text ?? undefined,
      ...(system ? { system: true } : {}),
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt?.getTime(),
      status: (row.status as MessageStatus) ?? 'sent',
      replyToId: row.replyToId ?? undefined,
      threadId: row.threadId ?? undefined,
      replyCount: row.replyCount || undefined,
      reactions,
      attachments: (row.attachments as MessageDto['attachments']) ?? [],
      metadata: row.metadata ?? {},
      revision: row.revision,
      sequence: row.sequence,
    };
  }
}
