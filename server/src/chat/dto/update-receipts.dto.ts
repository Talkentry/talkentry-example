import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReceiptsDto {
  @ApiProperty({
    example: 'user-1',
    description: 'Actor acknowledging messages (not the sender)',
  })
  actorId!: string;

  @ApiProperty({ enum: ['delivered', 'read'] })
  status!: 'delivered' | 'read';

  @ApiPropertyOptional({
    type: [String],
    description: 'Explicit message ids to advance (max 100)',
  })
  messageIds?: string[];

  @ApiPropertyOptional({
    description:
      'Advance all peer messages up to this id (inclusive, by sequence)',
  })
  upToMessageId?: string;
}
