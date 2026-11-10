import { ApiProperty } from '@nestjs/swagger';

export class DeleteMessageDto {
  @ApiProperty({
    example: 'user-1',
    description: 'Must be the original sender',
  })
  actorId!: string;
}
