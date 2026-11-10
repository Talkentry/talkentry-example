import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UpdateReceiptsDto } from './dto/update-receipts.dto';
import { MessagesService } from './messages.service';

@ApiTags('receipts')
@Controller('chats/:chatId/receipts')
export class ReceiptsController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOkResponse({ description: 'Messages whose receipt status advanced' })
  async update(
    @Param('chatId') chatId: string,
    @Body() body: UpdateReceiptsDto,
  ) {
    return this.messagesService.updateReceipts(chatId, body);
  }
}
