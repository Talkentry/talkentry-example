import { ApiProperty } from '@nestjs/swagger';

export class ReconcileMessagesDto {
  @ApiProperty({
    type: [String],
    example: ['msg-1', 'msg-2'],
    description:
      'Server message ids currently held in the client window (max 200)',
  })
  messageIds!: string[];
}
