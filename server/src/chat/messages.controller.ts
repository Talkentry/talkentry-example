import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { ReconcileMessagesDto } from './dto/reconcile-messages.dto';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('messages')
@Controller('chats/:chatId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOkResponse({ description: 'Message page ordered oldest → newest' })
  async list(
    @Param('chatId') chatId: string,
    @Query('limit') limit?: string,
    @Query('beforeId') beforeId?: string,
    @Query('afterId') afterId?: string,
    @Query('aroundId') aroundId?: string,
    @Query('threadId') threadId?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const cursors = [beforeId, afterId, aroundId].filter(Boolean);
    if (cursors.length > 1) {
      throw new BadRequestException(
        'Use only one of beforeId, afterId, aroundId',
      );
    }

    if (beforeId) {
      return this.messagesService.loadBefore(
        chatId,
        beforeId,
        parsedLimit,
        threadId,
      );
    }

    if (afterId) {
      return this.messagesService.loadAfter(
        chatId,
        afterId,
        parsedLimit,
        threadId,
      );
    }

    if (aroundId) {
      return this.messagesService.loadAround(
        chatId,
        aroundId,
        parsedLimit,
        threadId,
      );
    }

    return this.messagesService.loadLatest(chatId, parsedLimit, threadId);
  }

  @Post()
  @ApiOkResponse({ description: 'Created message' })
  async send(@Param('chatId') chatId: string, @Body() body: SendMessageDto) {
    return this.messagesService.send(chatId, body);
  }

  @Post('reconcile')
  @ApiOkResponse({
    description:
      'Current state for known message ids; missing ids listed in removedIds (reconnect window barrier)',
  })
  async reconcile(
    @Param('chatId') chatId: string,
    @Body() body: ReconcileMessagesDto,
  ) {
    return this.messagesService.reconcile(chatId, body);
  }

  @Patch(':messageId')
  @ApiOkResponse({ description: 'Edited message' })
  async edit(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() body: EditMessageDto,
  ) {
    return this.messagesService.edit(chatId, messageId, body);
  }

  @Delete(':messageId')
  @ApiOkResponse({ description: 'Deleted message id + revision at removal' })
  async remove(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() body: DeleteMessageDto,
  ) {
    return this.messagesService.remove(chatId, messageId, body);
  }

  @Post(':messageId/reactions')
  @ApiOkResponse({ description: 'Message after reaction toggle' })
  async react(
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
    @Body() body: ReactMessageDto,
  ) {
    return this.messagesService.toggleReaction(chatId, messageId, body);
  }
}
