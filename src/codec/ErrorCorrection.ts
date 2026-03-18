import { ProtocolConfig } from '../constants/ProtocolConfig';
import { ErrorCorrectionMode } from '../types';

/**
 * Apply error correction encoding to a bit stream
 */
export function encodeBits(bits: number[], mode: ErrorCorrectionMode): number[] {
  switch (mode) {
    case 'none':
      return bits;
    case 'repetition':
      return repetitionEncode(bits);
    case 'hamming':
      return hammingEncode(bits);
    default:
      return bits;
  }
}

/**
 * Apply error correction decoding to a bit stream
 */
export function decodeBits(bits: number[], mode: ErrorCorrectionMode): number[] {
  switch (mode) {
    case 'none':
      return bits;
    case 'repetition':
      return repetitionDecode(bits);
    case 'hamming':
      return hammingDecode(bits);
    default:
      return bits;
  }
}

// --- Repetition coding (3x) ---

function repetitionEncode(bits: number[]): number[] {
  const factor = ProtocolConfig.REPETITION_FACTOR;
  const result: number[] = [];
  for (const bit of bits) {
    for (let i = 0; i < factor; i++) {
      result.push(bit);
    }
  }
  return result;
}

function repetitionDecode(bits: number[]): number[] {
  const factor = ProtocolConfig.REPETITION_FACTOR;
  const result: number[] = [];
  for (let i = 0; i + factor - 1 < bits.length; i += factor) {
    // Majority vote
    let ones = 0;
    for (let j = 0; j < factor; j++) {
      ones += bits[i + j];
    }
    result.push(ones > factor / 2 ? 1 : 0);
  }
  return result;
}

// --- Hamming(7,4) coding ---

function hammingEncode(bits: number[]): number[] {
  const result: number[] = [];
  // Process 4 bits at a time
  for (let i = 0; i + 3 < bits.length; i += 4) {
    const d1 = bits[i], d2 = bits[i + 1], d3 = bits[i + 2], d4 = bits[i + 3];
    const p1 = d1 ^ d2 ^ d4;
    const p2 = d1 ^ d3 ^ d4;
    const p3 = d2 ^ d3 ^ d4;
    // Output: p1 p2 d1 p3 d2 d3 d4
    result.push(p1, p2, d1, p3, d2, d3, d4);
  }
  // Handle remaining bits (pad and encode)
  const remaining = bits.length % 4;
  if (remaining > 0) {
    const padded = bits.slice(bits.length - remaining);
    while (padded.length < 4) padded.push(0);
    const d1 = padded[0], d2 = padded[1], d3 = padded[2], d4 = padded[3];
    const p1 = d1 ^ d2 ^ d4;
    const p2 = d1 ^ d3 ^ d4;
    const p3 = d2 ^ d3 ^ d4;
    result.push(p1, p2, d1, p3, d2, d3, d4);
  }
  return result;
}

function hammingDecode(bits: number[]): number[] {
  const result: number[] = [];
  // Process 7 bits at a time
  for (let i = 0; i + 6 < bits.length; i += 7) {
    let p1 = bits[i], p2 = bits[i + 1], d1 = bits[i + 2];
    let p3 = bits[i + 3], d2 = bits[i + 4], d3 = bits[i + 5], d4 = bits[i + 6];

    // Syndrome
    const s1 = p1 ^ d1 ^ d2 ^ d4;
    const s2 = p2 ^ d1 ^ d3 ^ d4;
    const s3 = p3 ^ d2 ^ d3 ^ d4;
    const syndrome = (s1 << 2) | (s2 << 1) | s3;

    // Correct single-bit error
    if (syndrome !== 0) {
      const errorPos = syndrome - 1; // 0-indexed position in [p1,p2,d1,p3,d2,d3,d4]
      const block = [p1, p2, d1, p3, d2, d3, d4];
      if (errorPos < 7) {
        block[errorPos] ^= 1;
      }
      [p1, p2, d1, p3, d2, d3, d4] = block;
    }

    result.push(d1, d2, d3, d4);
  }
  return result;
}
