import type { TalkentryUploadFile } from './types';

/** React Native file part. Multipart XHR reads `uri`; it does not accept a browser File. */
export const appendNativeUpload = (form: FormData, file: TalkentryUploadFile): void => {
  form.append('file', {
    uri: file.uri,
    name: file.name ?? 'upload.jpg',
    type: file.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
};
