import type { Attachment } from '@talkentry/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

/** Photo still on the device. The composer can draw it before any upload. */
export type LocalImage = {
  readonly localUri: string;
  readonly name: string;
  readonly mimeType: string;
};

/**
 * Opens the library and returns the local file. Does not talk to the server.
 */
export const pickLocalImage = async (): Promise<LocalImage | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  if (picked.canceled || !picked.assets[0]) {
    return null;
  }

  const asset = picked.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const name = asset.fileName ?? `photo-${Date.now()}.${mimeType.includes('png') ? 'png' : 'jpg'}`;

  return { localUri: asset.uri, name, mimeType };
};

/** Uploads a previously picked photo. The preview keeps using `localUri`. */
export const uploadLocalImage = async (baseUrl: string, image: LocalImage): Promise<Attachment> => {
  const root = baseUrl.replace(/\/$/, '');
  const result = await FileSystem.uploadAsync(`${root}/uploads`, image.localUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: image.mimeType,
    headers: { Accept: 'application/json' },
    parameters: { name: image.name },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status})`);
  }

  const value = JSON.parse(result.body) as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.type !== 'string') {
    throw new Error('Invalid upload response');
  }

  const relativeOrAbsolute = typeof value.url === 'string' ? value.url : undefined;
  const url =
    relativeOrAbsolute && relativeOrAbsolute.startsWith('/')
      ? `${root}${relativeOrAbsolute}`
      : relativeOrAbsolute;

  return {
    id: value.id,
    type: value.type as Attachment['type'],
    url,
    name: typeof value.name === 'string' ? value.name : image.name,
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : image.mimeType,
    size: typeof value.size === 'number' ? value.size : undefined,
  };
};
