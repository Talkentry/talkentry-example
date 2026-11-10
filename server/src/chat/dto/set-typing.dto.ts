import { ApiProperty } from '@nestjs/swagger';

export class SetTypingDto {
  @ApiProperty({ example: 'user-1' })
  actorId!: string;

  @ApiProperty({ example: true })
  isTyping!: boolean;
}
