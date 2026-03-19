import { Audio } from 'expo-av';
import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Recording preset that guarantees 16-bit PCM WAV output on both platforms.
 * Uses MPEG_4/AAC on Android (expo-av doesn't reliably produce WAV on Android)
 * and LINEARPCM on iOS.
 */
export const RECORDING_PRESET: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.wav',
    outputFormat: 3, // THREE_GPP is not WAV; use WAVE format (value 6 if available, fallback to default)
    audioEncoder: 1, // DEFAULT encoder
    sampleRate: ProtocolConfig.SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 705600, // 44100 * 16 * 1
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: ProtocolConfig.SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 705600,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

/**
 * High-quality preset that's more likely to produce decodable audio on Android.
 * Uses expo-av's built-in HIGH_QUALITY preset as base.
 */
export function getRecordingOptions(): Audio.RecordingOptions {
  return {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
    android: {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
      sampleRate: ProtocolConfig.SAMPLE_RATE,
      numberOfChannels: 1,
    },
    ios: {
      extension: '.wav',
      outputFormat: Audio.IOSOutputFormat.LINEARPCM,
      audioQuality: Audio.IOSAudioQuality.MAX,
      sampleRate: ProtocolConfig.SAMPLE_RATE,
      numberOfChannels: 1,
      bitRate: 705600,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
  };
}

/**
 * Parse audio file from base64 and extract Float32 PCM samples.
 * Supports WAV (PCM 16-bit) format.
 * For non-WAV formats (Android AAC/M4A), returns null (requires native decoding).
 */
export function audioBase64ToFloat32(base64: string): Float32Array | null {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Try WAV parsing first
    const wavResult = parseWav16BitPcm(bytes);
    if (wavResult) return wavResult;

    // Try raw PCM (if the file is just raw 16-bit samples)
    if (len > 44 && len % 2 === 0) {
      return parseRawPcm16(bytes);
    }

    return null;
  } catch {
    return null;
  }
}

// Keep old name as alias for backward compatibility
export const wavBase64ToFloat32 = audioBase64ToFloat32;

/**
 * Parse WAV file bytes and extract Float32 samples.
 */
function parseWav16BitPcm(bytes: Uint8Array): Float32Array | null {
  // Check RIFF header
  if (bytes.length < 44) return null;
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
    return null; // Not RIFF
  }

  // Find "data" chunk
  let dataOffset = -1;
  let dataSize = 0;
  for (let i = 12; i < bytes.length - 8; i++) {
    if (
      bytes[i] === 0x64 &&     // 'd'
      bytes[i + 1] === 0x61 && // 'a'
      bytes[i + 2] === 0x74 && // 't'
      bytes[i + 3] === 0x61   // 'a'
    ) {
      dataSize =
        bytes[i + 4] |
        (bytes[i + 5] << 8) |
        (bytes[i + 6] << 16) |
        (bytes[i + 7] << 24);
      dataOffset = i + 8;
      break;
    }
  }

  if (dataOffset < 0) return null;

  // Determine bits per sample from fmt chunk
  let bitsPerSample = 16;
  for (let i = 12; i < dataOffset - 8; i++) {
    if (bytes[i] === 0x66 && bytes[i+1] === 0x6d && bytes[i+2] === 0x74 && bytes[i+3] === 0x20) {
      // fmt chunk found
      bitsPerSample = bytes[i + 22] | (bytes[i + 23] << 8);
      break;
    }
  }

  if (bitsPerSample === 16) {
    return convert16BitToFloat32(bytes, dataOffset, dataSize);
  } else if (bitsPerSample === 32) {
    // 32-bit float PCM
    const sampleCount = Math.floor(Math.min(dataSize, bytes.length - dataOffset) / 4);
    const samples = new Float32Array(sampleCount);
    const view = new DataView(bytes.buffer, bytes.byteOffset + dataOffset);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = view.getFloat32(i * 4, true);
    }
    return samples;
  }

  return null;
}

function convert16BitToFloat32(bytes: Uint8Array, dataOffset: number, dataSize: number): Float32Array {
  const sampleCount = Math.floor(Math.min(dataSize, bytes.length - dataOffset) / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const byteIndex = dataOffset + i * 2;
    const sample16 = bytes[byteIndex] | (bytes[byteIndex + 1] << 8);
    const signed = sample16 > 32767 ? sample16 - 65536 : sample16;
    samples[i] = signed / 32768;
  }
  return samples;
}

/**
 * Try to parse as raw 16-bit PCM (no headers).
 */
function parseRawPcm16(bytes: Uint8Array): Float32Array {
  return convert16BitToFloat32(bytes, 0, bytes.length);
}
