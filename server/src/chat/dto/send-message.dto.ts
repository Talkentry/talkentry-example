import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AttachmentDto } from '../chat.types';

export class SendMessageDto {
  @ApiProperty({ example: 'user-1' })
  senderId!: string;

  @ApiPropertyOptional({ example: 'Hello from Talkentra' })
  text?: string;

  @ApiPropertyOptional({ example: 'local-123' })
  localId?: string;

  @ApiPropertyOptional()
  replyToId?: string;

  /** Root message id — places the new message in that thread (not main channel). */
  @ApiPropertyOptional()
  threadId?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: Record<string, unknown>;
}
