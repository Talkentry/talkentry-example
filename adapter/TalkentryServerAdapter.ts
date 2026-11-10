import {
  assertEventsPage,
  assertMessage,
  assertMessages,
  assertPage,
  type Attachment,
  type ChatAdapter,
  type ChatAdapterCapabilities,
  type ChatEvent,
  type ChatEventListener,
  type ChatEventsPage,
  ChatEventType,
  type DeleteMessageCommand,
  type DeleteMessageResult,
  type EditMessageCommand,
  isChatEvent,
  type LoadAfterParams,
  type LoadAroundParams,
  type LoadBeforeParams,
  type LoadEventsParams,
  type LoadLatestParams,
  type Message,
  type MessagePage,
  type ReconcileMessagesCommand,
  type ReconcileMessagesResult,
  type SendMessageCommand,
  type SetTypingCommand,
  type ToggleReactionCommand,
  type Unsubscribe,
  type UpdateReceiptsCommand,
  type UploadAttachmentCommand,
} from '@talkentry/core';
import { io } from 'socket.io-client';

import { requestMultipart } from './multipartRequest';
import type { TalkentryFetch, TalkentryServerAdapterOptions } from './types';

export type { TalkentryFetch, TalkentryServerAdapterOptions } from './types';

/** Reference transport. Auth and allowed endpoints are defined by the host, not the SDK. */
export class TalkentryServerAdapter implements ChatAdapter {
  readonly capabilities: ChatAdapterCapabilities = {
    loadBefore: true,
    loadAfter: true,
    loadAround: true,
    deliveryReceipts: true,
    readReceipts: true,
    editMessage: true,
    deleteMessage: true,
    uploadAttachment: true,
    reactions: true,
    threads: true,
    reconcileMessages: true,
    typingIndicators: true,
    loadEvents: true,
  };
  private readonly baseUrl: string;
  private readonly fetchImpl: TalkentryFetch;
  private readonly realtimeUrl: string | false;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly appendUpload: TalkentryServerAdapterOptions['appendUpload'];
  constructor(options: TalkentryServerAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    if (!/^https?:\/\//.test(this.baseUrl)) {
      throw new Error('Invalid API URL');
    }
    this.fetchImpl =
      options.fetch ??
      ((input, init) => (globalThis.fetch as unknown as TalkentryFetch)(input, init));
    this.realtimeUrl =
      options.realtimeUrl === false ? false : (options.realtimeUrl ?? this.baseUrl);
    this.pollIntervalMs = options.pollIntervalMs ?? 1500;
    this.timeoutMs = options.requestTimeoutMs ?? 30000;
    this.appendUpload = options.appendUpload;

    if (
      !Number.isFinite(this.pollIntervalMs) ||
      this.pollIntervalMs < 50 ||
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs < 1
    ) {
      throw new Error('Invalid transport limits');
    }
  }
  loadLatest = async (p: LoadLatestParams): Promise<MessagePage> =>
    this.absolutizePage(
      assertPage(
        await this.request(
          this.path(p.chatId, { limit: p.limit, threadId: p.threadId }),
          'GET',
          undefined,
          p.signal,
        ),
        p.chatId,
      ),
    );
  loadBefore = async (p: LoadBeforeParams): Promise<MessagePage> =>
    this.absolutizePage(
      assertPage(
        await this.request(
          this.path(p.chatId, {
            limit: p.limit,
            beforeId: p.beforeId,
            threadId: p.threadId,
          }),
          'GET',
          undefined,
          p.signal,
        ),
        p.chatId,
      ),
    );
  loadAfter = async (p: LoadAfterParams): Promise<MessagePage> =>
    this.absolutizePage(
      assertPage(
        await this.request(
          this.path(p.chatId, {
            limit: p.limit,
            afterId: p.afterId,
            threadId: p.threadId,
          }),
          'GET',
          undefined,
          p.signal,
        ),
        p.chatId,
      ),
    );
  loadAround = async (p: LoadAroundParams): Promise<MessagePage> =>
    this.absolutizePage(
      assertPage(
        await this.request(
          this.path(p.chatId, {
            limit: p.limit,
            aroundId: p.aroundId,
            threadId: p.threadId,
          }),
          'GET',
          undefined,
          p.signal,
        ),
        p.chatId,
      ),
    );
  send = async (command: SendMessageCommand): Promise<Message> => {
    const { signal, chatId, ...body } = command;

    return this.absolutizeMessage(
      assertMessage(await this.request(this.path(chatId), 'POST', body, signal), chatId),
    );
  };
  updateReceipts = async (command: UpdateReceiptsCommand): Promise<readonly Message[]> => {
    const { signal, chatId, ...body } = command;

    return assertMessages(
      await this.request(`/chats/${encodeURIComponent(chatId)}/receipts`, 'POST', body, signal),
      chatId,
    ).map(this.absolutizeMessage);
  };
  editMessage = async (command: EditMessageCommand): Promise<Message> => {
    const { signal, chatId, messageId, actorId, text } = command;

    return this.absolutizeMessage(
      assertMessage(
        await this.request(
          `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
          'PATCH',
          { actorId, text },
          signal,
        ),
        chatId,
      ),
    );
  };
  deleteMessage = async (command: DeleteMessageCommand): Promise<DeleteMessageResult> => {
    const { signal, chatId, messageId, actorId } = command;
    const raw = await this.request(
      `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
      'DELETE',
      { actorId },
      signal,
    );
    if (!raw || typeof raw !== 'object') {
      throw new Error('Chat transport request failed');
    }
    const value = raw as Record<string, unknown>;
    if (typeof value.messageId !== 'string') {
      throw new Error('Chat transport request failed');
    }

    return {
      chatId: typeof value.chatId === 'string' ? value.chatId : chatId,
      messageId: value.messageId,
      revision: typeof value.revision === 'number' ? value.revision : undefined,
    };
  };
  toggleReaction = async (command: ToggleReactionCommand): Promise<Message> => {
    const { signal, chatId, messageId, actorId, emoji } = command;

    return this.absolutizeMessage(
      assertMessage(
        await this.request(
          `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`,
          'POST',
          { actorId, emoji },
          signal,
        ),
        chatId,
      ),
    );
  };
  reconcileMessages = async (
    command: ReconcileMessagesCommand,
  ): Promise<ReconcileMessagesResult> => {
    const { signal, chatId, messageIds } = command;
    const raw = await this.request(
      `/chats/${encodeURIComponent(chatId)}/messages/reconcile`,
      'POST',
      { messageIds },
      signal,
    );
    if (!raw || typeof raw !== 'object') {
      throw new Error('Chat transport request failed');
    }
    const value = raw as Record<string, unknown>;
    if (!Array.isArray(value.messages) || !Array.isArray(value.removedIds)) {
      throw new Error('Chat transport request failed');
    }
    if (!value.removedIds.every((id) => typeof id === 'string')) {
      throw new Error('Chat transport request failed');
    }

    return {
      messages: assertMessages(value.messages, chatId).map(this.absolutizeMessage),
      removedIds: value.removedIds as string[],
    };
  };
  setTyping = async (command: SetTypingCommand): Promise<void> => {
    const { signal, chatId, actorId, isTyping } = command;
    await this.request(
      `/chats/${encodeURIComponent(chatId)}/typing`,
      'POST',
      { actorId, isTyping },
      signal,
    );
  };
  loadEvents = async (params: LoadEventsParams): Promise<ChatEventsPage> => {
    const query = new URLSearchParams();
    if (params.afterCursor !== undefined) {
      query.set('afterCursor', String(params.afterCursor));
    }
    if (params.limit !== undefined) {
      query.set('limit', String(params.limit));
    }
    const suffix = query.toString() ? `?${query}` : '';
    const page = assertEventsPage(
      await this.request(
        `/chats/${encodeURIComponent(params.chatId)}/events${suffix}`,
        'GET',
        undefined,
        params.signal,
      ),
      params.chatId,
    );

    return {
      ...page,
      events: page.events.map((event) => this.absolutizeEvent(event)),
    };
  };
  uploadAttachment = async (command: UploadAttachmentCommand): Promise<Attachment> => {
    const form = new FormData();

    await this.appendUpload(form, {
      uri: command.uri,
      name: command.name,
      mimeType: command.mimeType,
      signal: command.signal,
    });

    const raw = await this.requestForm('/uploads', form, command.signal);
    if (!raw || typeof raw !== 'object') {
      throw new Error('Chat transport request failed');
    }
    const value = raw as Record<string, unknown>;
    if (typeof value.id !== 'string' || typeof value.type !== 'string') {
      throw new Error('Chat transport request failed');
    }
    const attachment: Attachment = {
      id: value.id,
      type: value.type as Attachment['type'],
      url: typeof value.url === 'string' ? value.url : undefined,
      name: typeof value.name === 'string' ? value.name : undefined,
      mimeType: typeof value.mimeType === 'string' ? value.mimeType : undefined,
      size: typeof value.size === 'number' ? value.size : undefined,
      width: typeof value.width === 'number' ? value.width : undefined,
      height: typeof value.height === 'number' ? value.height : undefined,
    };

    return { ...attachment, url: this.resolveUrl(attachment.url) };
  };
  subscribe = (chatId: string, listener: ChatEventListener): Unsubscribe => {
    if (this.realtimeUrl === false) {
      return this.poll(chatId, listener);
    }
    const socket = io(this.realtimeUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    let cancelled = false;
    // First connect: session already runs loadLatest in start().
    // Reconnect without replay — invalidate; otherwise loadOlder would reset to latest.
    let joinedOnce = false;
    const join = () => {
      if (cancelled) {
        return;
      }
      socket.emit('chat:join', { chatId });
      if (joinedOnce) {
        listener({ type: ChatEventType.HistoryInvalidated, chatId });
      }
      joinedOnce = true;
    };
    const onEvent = (payload: unknown) => {
      if (!cancelled && isChatEvent(payload, chatId)) {
        listener(this.absolutizeEvent(payload));
      }
    };
    socket.on('connect', join);
    socket.on('chat:event', onEvent);
    if (socket.connected) {
      join();
    }

    return () => {
      cancelled = true;
      socket.off('connect', join);
      socket.off('chat:event', onEvent);
      socket.emit('chat:leave', { chatId });
      socket.disconnect();
    };
  };
  private poll = (chatId: string, listener: ChatEventListener): Unsubscribe => {
    const controller = new AbortController();
    let cursor: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        for (let pages = 0; pages < 20 && !controller.signal.aborted; pages += 1) {
          const page = cursor
            ? await this.loadAfter({
                chatId,
                afterId: cursor,
                limit: 50,
                signal: controller.signal,
              })
            : await this.loadLatest({ chatId, limit: 50, signal: controller.signal });
          if (controller.signal.aborted) {
            return;
          }
          const previous = cursor;
          for (const message of page.messages) {
            if (controller.signal.aborted) {
              return;
            }
            listener({ type: ChatEventType.MessageAdded, message });
            cursor = message.id;
          }
          if (!page.hasMoreAfter) {
            break;
          }
          if (previous === cursor || pages === 19) {
            listener({ type: ChatEventType.HistoryInvalidated, chatId });
            cursor = undefined;
            break;
          }
        }
      } catch {
        // No payload or tokens in logs. Retry after a bounded request timeout.
      } finally {
        if (!controller.signal.aborted) {
          timer = setTimeout(() => {
            tick().catch(() => undefined);
          }, this.pollIntervalMs);
        }
      }
    };
    tick().catch(() => undefined);

    return () => {
      controller.abort();
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  };
  private path = (
    chatId: string,
    params: Record<string, string | number | undefined> = {},
  ): string => {
    const query = Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    return `/chats/${encodeURIComponent(chatId)}/messages${query ? `?${query}` : ''}`;
  };
  private resolveUrl = (url?: string): string | undefined => {
    if (!url) {
      return undefined;
    }
    if (/^https?:\/\//i.test(url) || url.startsWith('file:')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${this.baseUrl}${url}`;
    }

    return url;
  };
  private absolutizeMessage = (message: Message): Message => {
    if (!message.attachments?.length) {
      return message;
    }

    return {
      ...message,
      attachments: message.attachments.map((item) => ({
        ...item,
        url: this.resolveUrl(item.url),
      })),
    };
  };
  private absolutizePage = (page: MessagePage): MessagePage => ({
    ...page,
    messages: page.messages.map(this.absolutizeMessage),
  });
  private absolutizeEvent = (event: ChatEvent): ChatEvent => {
    if (event.type === ChatEventType.MessageAdded || event.type === ChatEventType.MessageUpdated) {
      return { ...event, message: this.absolutizeMessage(event.message) };
    }

    return event;
  };
  private requestForm = (path: string, body: FormData, signal?: AbortSignal): Promise<unknown> =>
    requestMultipart({
      url: `${this.baseUrl}${path}`,
      fetch: this.fetchImpl,
      body,
      timeoutMs: this.timeoutMs,
      signal,
    });
  private request = async (
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) {
      controller.abort();
    } else {
      signal?.addEventListener('abort', cancel, { once: true });
    }
    const timer = setTimeout(cancel, this.timeoutMs);
    let abortListener: (() => void) | undefined;
    try {
      if (controller.signal.aborted) {
        throw new Error('Cancelled');
      }
      const task = (async () => {
        const headers: Record<string, string> = { Accept: 'application/json' };

        if (body !== undefined) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Chat HTTP request failed');
        }

        const text = await response.text();

        return text ? (JSON.parse(text) as unknown) : {};
      })();
      const abort = new Promise<never>((_resolve, reject) => {
        abortListener = () => reject(new Error('Chat request cancelled or timed out'));
        if (controller.signal.aborted) {
          abortListener();
        } else {
          controller.signal.addEventListener('abort', abortListener, { once: true });
        }
      });

      return await Promise.race([task, abort]);
    } catch (error) {
      if (controller.signal.aborted || signal?.aborted) {
        throw error instanceof Error ? error : new Error('Cancelled');
      }

      // Do not include response body, URL, chatId, or token in the public error.
      throw new Error('Chat transport request failed');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (abortListener) {
        controller.signal.removeEventListener('abort', abortListener);
      }
    }
  };
}
