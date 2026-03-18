import * as DocumentPicker from 'expo-document-picker';
import { File, Paths, Directory } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SelectedFile } from '../types';

/**
 * Pick a file using the system file picker
 */
export async function pickFile(): Promise<SelectedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  let size = asset.size ?? 0;

  // If size is unknown, read the file to determine actual size
  if (size === 0 && asset.uri) {
    try {
      const info = await LegacyFileSystem.getInfoAsync(asset.uri);
      if (info.exists && 'size' in info) {
        size = (info as any).size ?? 0;
      }
    } catch {
      // Fall through with size 0
    }
  }

  return {
    uri: asset.uri,
    name: asset.name,
    size,
    mimeType: asset.mimeType ?? 'application/octet-stream',
  };
}

/**
 * Read a file as a base64 string
 */
export async function readFileAsBase64(uri: string): Promise<string> {
  return await LegacyFileSystem.readAsStringAsync(uri, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });
}

/**
 * Read a file as a Uint8Array
 */
export async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  const base64 = await readFileAsBase64(uri);
  return base64ToUint8Array(base64);
}

/**
 * Sanitize a filename to prevent path traversal attacks.
 * Strips directory separators and parent references.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[\/\\]/g, '_')  // Replace path separators
    .replace(/\.\./g, '_')     // Replace parent directory references
    .replace(/^\.+/, '_')      // Replace leading dots
    .replace(/[\x00-\x1f]/g, '') // Remove control characters
    .trim() || 'received_file';
}

/**
 * Save data to a file and return the URI
 */
export async function saveFile(
  data: Uint8Array,
  fileName: string
): Promise<string> {
  const safeName = sanitizeFileName(fileName);
  const receivedDir = new Directory(Paths.document, 'received');
  if (!receivedDir.exists) {
    receivedDir.create();
  }

  const file = new File(receivedDir, safeName);
  const base64 = uint8ArrayToBase64(data);
  await LegacyFileSystem.writeAsStringAsync(file.uri, base64, {
    encoding: LegacyFileSystem.EncodingType.Base64,
  });

  return file.uri;
}

/**
 * Share a file
 */
export async function shareFile(uri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri);
  }
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format duration in seconds to human readable
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const min = Math.floor(seconds / 60);
  const sec = Math.ceil(seconds % 60);
  if (seconds < 3600) return `${min}m ${sec}s`;
  const hr = Math.floor(seconds / 3600);
  const remainMin = Math.ceil((seconds % 3600) / 60);
  return `${hr}h ${remainMin}m`;
}

// --- Base64 helpers (chunked for large files) ---

const CHUNK_SIZE = 8192;

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, len);
    for (let j = i; j < end; j++) {
      bytes[j] = binaryString.charCodeAt(j);
    }
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, bytes.length);
    let chunk = '';
    for (let j = i; j < end; j++) {
      chunk += String.fromCharCode(bytes[j]);
    }
    chunks.push(chunk);
  }
  return btoa(chunks.join(''));
}
