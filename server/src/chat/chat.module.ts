import { Module } from '@nestjs/common';
import { ChatEventsService } from './chat-events.service';
import { ChatGateway } from './chat.gateway';
import { EventJournalService } from './event-journal.service';
import { EventsController } from './events.controller';
import { ReceiptsController } from './receipts.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { TypingController } from './typing.controller';
import { TypingService } from './typing.service';

@Module({
  controllers: [
    MessagesController,
    ReceiptsController,
    TypingController,
    EventsController,
  ],
  providers: [
    MessagesService,
    TypingService,
    ChatEventsService,
    EventJournalService,
    ChatGateway,
  ],
  exports: [
    MessagesService,
    TypingService,
    ChatEventsService,
    EventJournalService,
  ],
})
export class ChatModule {}
