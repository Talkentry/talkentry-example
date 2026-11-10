import { BadRequestException, Injectable } from '@nestjs/common';
import { ChatEventsService } from './chat-events.service';
import type { SetTypingDto } from './dto/set-typing.dto';

const TYPING_TTL_MS = 3000;

@Injectable()
export class TypingService {
  /** chatId → actorId → clear timeout */
  private readonly timers = new Map<string, Map<string, NodeJS.Timeout>>();

  constructor(private readonly chatEvents: ChatEventsService) {}

  setTyping(chatId: string, dto: SetTypingDto): { userIds: string[] } {
    if (!dto.actorId?.trim()) {
      throw new BadRequestException('actorId is required');
    }
    if (typeof dto.isTyping !== 'boolean') {
      throw new BadRequestException('isTyping must be a boolean');
    }
    const actorId = dto.actorId.trim();
    let actors = this.timers.get(chatId);
    if (!actors) {
      actors = new Map();
      this.timers.set(chatId, actors);
    }

    const existing = actors.get(actorId);
    if (existing) clearTimeout(existing);

    if (dto.isTyping) {
      const timer = setTimeout(() => {
        const current = this.timers.get(chatId);
        if (!current) return;
        current.delete(actorId);
        if (!current.size) this.timers.delete(chatId);
        this.publish(chatId);
      }, TYPING_TTL_MS);
      actors.set(actorId, timer);
    } else {
      actors.delete(actorId);
      if (!actors.size) this.timers.delete(chatId);
    }

    this.publish(chatId);
    return { userIds: this.userIds(chatId) };
  }

  private userIds(chatId: string): string[] {
    return [...(this.timers.get(chatId)?.keys() ?? [])];
  }

  private publish(chatId: string): void {
    this.chatEvents.publish(chatId, {
      type: 'typing.updated',
      chatId,
      userIds: this.userIds(chatId),
    });
  }
}
