import { ApiProperty } from '@nestjs/swagger';

export class ReactMessageDto {
  @ApiProperty({ example: 'user-1' })
  actorId!: string;

  @ApiProperty({
    example: '👍',
    description:
      'One emoji grapheme. Replaces the actor’s other reaction; the same emoji removes it.',
  })
  emoji!: string;
}
