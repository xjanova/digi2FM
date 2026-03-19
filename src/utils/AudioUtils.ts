import { Audio } from 'expo-av';
import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Shared recording preset for WAV capture at 44100 Hz mono 16-bit PCM
 */
export const RECORDING_PRESET = {
  isMeteringEnabled: false,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: ProtocolConfig.SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: ProtocolConfig.SAMPLE_RATE,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

/**
 * Parse a WAV file from base64 and extract Float32 PCM samples.
 * Handles 16-bit PCM WAV format.
 */
export function wavBase64ToFloat32(base64: string): Float32Array | null {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Find "data" chunk
    let dataOffset = -1;
    let dataSize = 0;
    for (let i = 0; i < bytes.length - 8; i++) {
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

    // Convert 16-bit PCM to float32
    const sampleCount = Math.floor(Math.min(dataSize, bytes.length - dataOffset) / 2);
    const samples = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const byteIndex = dataOffset + i * 2;
      const sample16 = bytes[byteIndex] | (bytes[byteIndex + 1] << 8);
      const signed = sample16 > 32767 ? sample16 - 65536 : sample16;
      samples[i] = signed / 32768;
    }

    return samples;
  } catch {
    return null;
  }
}
