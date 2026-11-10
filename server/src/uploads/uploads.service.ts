import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { AttachmentDto, AttachmentType } from '../chat/chat.types';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
]);

const normalizeMime = (raw: string, originalName: string): string => {
  const mime = raw.toLowerCase().trim();
  if (mime === 'image/jpg') return 'image/jpeg';
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = extname(originalName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.heif') return 'image/heif';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.txt') return 'text/plain';
  return mime || 'application/octet-stream';
};

const typeFromMime = (mime: string): AttachmentType => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
};

const extensionFor = (mime: string, originalName: string): string => {
  const fromName = extname(originalName).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'image/heic') return '.heic';
  if (mime === 'image/heif') return '.heif';
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'text/plain') return '.txt';
  return '';
};

@Injectable()
export class UploadsService implements OnModuleInit {
  readonly directory: string;

  constructor(private readonly config: ConfigService) {
    this.directory = join(process.cwd(), 'uploads');
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
  }

  async save(
    file:
      | {
          readonly buffer: Buffer;
          readonly mimetype: string;
          readonly originalname: string;
          readonly size: number;
        }
      | undefined,
  ): Promise<AttachmentDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(`file larger than ${MAX_BYTES} bytes`);
    }
    const mime = normalizeMime(
      file.mimetype || 'application/octet-stream',
      file.originalname ?? '',
    );
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(`unsupported mime type: ${mime}`);
    }

    const id = randomUUID();
    const ext = extensionFor(mime, file.originalname ?? '');
    const filename = `${id}${ext}`;
    await writeFile(join(this.directory, filename), file.buffer);

    const publicBase = (
      this.config.get<string>('PUBLIC_BASE_URL') ?? ''
    ).replace(/\/$/, '');
    const path = `/uploads/${filename}`;

    return {
      id,
      type: typeFromMime(mime),
      url: publicBase ? `${publicBase}${path}` : path,
      name: file.originalname || filename,
      mimeType: mime,
      size: file.size,
    };
  }
}
