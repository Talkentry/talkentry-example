import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EditMessageDto {
  @ApiProperty({
    example: 'user-1',
    description: 'Must be the original sender',
  })
  actorId!: string;

  @ApiPropertyOptional({ example: 'Updated text' })
  text?: string;
}
