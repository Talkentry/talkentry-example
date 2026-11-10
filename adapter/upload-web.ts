import type { TalkentryUploadFile } from './types';

/** Browser file part. A picker URI is fetched and sent as a File. */
export const appendWebUpload = async (
  form: FormData,
  file: TalkentryUploadFile,
): Promise<void> => {
  const response = await globalThis.fetch(file.uri, { signal: file.signal });

  if (!response.ok) {
    throw new Error('Chat transport request failed');
  }

  const blob = await response.blob();
  const name = file.name ?? 'upload.bin';
  const type = file.mimeType || blob.type || 'application/octet-stream';

  form.append('file', new File([blob], name, { type }));
};
