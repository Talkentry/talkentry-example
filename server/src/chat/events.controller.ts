import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';

@ApiTags('events')
@Controller('chats/:chatId/events')
export class EventsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Durable chat events after cursor (oldest → newest)',
  })
  async list(
    @Param('chatId') chatId: string,
    @Query('afterCursor') afterCursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedAfter = afterCursor !== undefined ? Number(afterCursor) : 0;
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.messagesService.loadEvents(
      chatId,
      Number.isFinite(parsedAfter) ? parsedAfter : 0,
      parsedLimit,
    );
  }
}
