export type TalkentryFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | FormData;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;
export type TalkentryUploadFile = {
  /** Local file URI from the host picker. */
  readonly uri: string;
  /** Optional file name for the multipart part. */
  readonly name?: string;
  /** Optional MIME type for the multipart part. */
  readonly mimeType?: string;
  /** Abort signal for reading or sending the file. */
  readonly signal?: AbortSignal;
};

/** Puts one file into a multipart body. Native and web supply their own part. */
export type TalkentryUploadAppender = (
  form: FormData,
  file: TalkentryUploadFile,
) => void | Promise<void>;

export type TalkentryServerAdapterOptions = {
  readonly baseUrl: string;
  readonly fetch?: TalkentryFetch;
  readonly realtimeUrl?: string | false;
  readonly pollIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  /** Platform file part. The rest of the client is shared. */
  readonly appendUpload: TalkentryUploadAppender;
};
