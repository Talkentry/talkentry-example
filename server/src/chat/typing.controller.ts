import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SetTypingDto } from './dto/set-typing.dto';
import { TypingService } from './typing.service';

@ApiTags('typing')
@Controller('chats/:chatId/typing')
export class TypingController {
  constructor(private readonly typingService: TypingService) {}

  @Post()
  @ApiOkResponse({ description: 'Current typing user ids after update' })
  setTyping(@Param('chatId') chatId: string, @Body() body: SetTypingDto) {
    return this.typingService.setTyping(chatId, body);
  }
}
