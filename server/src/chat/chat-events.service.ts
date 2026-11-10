import { Injectable } from '@nestjs/common';
import type { ChatEventDto } from './chat.types';

type Listener = (event: ChatEventDto) => void;
type Publisher = (chatId: string, event: ChatEventDto) => void;

@Injectable()
export class ChatEventsService {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly publishers = new Set<Publisher>();

  /**
   * Fan-out hook for transports (WebSocket gateway, future SSE, …).
   */
  registerPublisher(publisher: Publisher): () => void {
    this.publishers.add(publisher);
    return () => {
      this.publishers.delete(publisher);
    };
  }

  publish(chatId: string, event: ChatEventDto): void {
    const set = this.listeners.get(chatId);
    if (set) {
      for (const listener of set) {
        listener(event);
      }
    }

    for (const publisher of this.publishers) {
      publisher(chatId, event);
    }
  }

  subscribe(chatId: string, listener: Listener): () => void {
    const set = this.listeners.get(chatId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(chatId, set);

    return () => {
      const current = this.listeners.get(chatId);
      if (!current) {
        return;
      }

      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(chatId);
      }
    };
  }
}
