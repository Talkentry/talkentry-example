export type MessageStatus =
  'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type AttachmentType = 'image' | 'file' | 'audio' | 'video' | 'custom';

export interface AttachmentDto {
  id: string;
  type: AttachmentType;
  url?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ReactionDto {
  emoji: string;
  userIds: string[];
}

export interface MessageDto {
  id: string;
  localId?: string;
  chatId: string;
  senderId: string;
  text?: string;
  /** Service/notice row — rendered as a system banner in the SDK. */
  system?: boolean;
  createdAt: number;
  updatedAt?: number;
  status?: MessageStatus;
  replyToId?: string;
  /** Present when the message belongs to a thread (root message id). */
  threadId?: string;
  /** Reply count on a root message (main channel). */
  replyCount?: number;
  /** Full current set; empty array clears reactions on the client (merge keeps omitted fields). */
  reactions: ReactionDto[];
  attachments?: AttachmentDto[];
  metadata?: Record<string, unknown>;
  revision: number;
  sequence: number;
}

/** Explicit hole between two retained messages (sequence skip). */
export interface HistoryGapDto {
  afterId: string;
  beforeId: string;
  missingCount?: number;
}

export interface MessagePageDto {
  messages: MessageDto[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
  oldestId?: string;
  newestId?: string;
  /** Present when consecutive page messages are not sequence-contiguous. */
  gaps?: HistoryGapDto[];
  /** Tip of durable chat_events journal for reconnect replay. */
  eventCursor?: number;
}

export interface ChatEventsPageDto {
  events: ChatEventDto[];
  latestCursor: number;
  hasMore: boolean;
}

/** Batch refresh of known window ids after reconnect (not a full event journal). */
export interface ReconcileMessagesResultDto {
  messages: MessageDto[];
  removedIds: string[];
}

export type ChatEventDto =
  | { type: 'message.added'; message: MessageDto; cursor?: number }
  | { type: 'message.updated'; message: MessageDto; cursor?: number }
  | {
      type: 'message.removed';
      chatId: string;
      messageId: string;
      revision?: number;
      cursor?: number;
    }
  | {
      type: 'message.status';
      chatId: string;
      messageId: string;
      status: MessageStatus;
      revision?: number;
      serverId?: string;
      cursor?: number;
    }
  | { type: 'typing.updated'; chatId: string; userIds: string[] };
