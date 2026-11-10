import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ChatEventsService } from './chat-events.service';
import type { ChatEventDto } from './chat.types';

const roomFor = (chatId: string): string => `chat:${chatId}`;

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly chatEvents: ChatEventsService) {}

  afterInit(): void {
    this.chatEvents.registerPublisher((chatId, event) => {
      this.emitToChat(chatId, event);
    });
  }

  @SubscribeMessage('chat:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId?: string },
  ): { ok: boolean } {
    const chatId = body?.chatId?.trim();
    if (!chatId) {
      return { ok: false };
    }

    void client.join(roomFor(chatId));
    return { ok: true };
  }

  @SubscribeMessage('chat:leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { chatId?: string },
  ): { ok: boolean } {
    const chatId = body?.chatId?.trim();
    if (!chatId) {
      return { ok: false };
    }

    void client.leave(roomFor(chatId));
    return { ok: true };
  }

  emitToChat(chatId: string, event: ChatEventDto): void {
    this.server.to(roomFor(chatId)).emit('chat:event', event);
  }
}
