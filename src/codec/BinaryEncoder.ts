import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Convert a byte array to a bit stream with UART framing
 * Each byte becomes: [START_BIT(0)] [8 data bits MSB first] [STOP_BIT(1)]
 */
export function bytesToBits(data: Uint8Array): number[] {
  const bits: number[] = [];
  for (let i = 0; i < data.length; i++) {
    // Start bit
    bits.push(ProtocolConfig.START_BIT);
    // 8 data bits, MSB first
    for (let b = 7; b >= 0; b--) {
      bits.push((data[i] >> b) & 1);
    }
    // Stop bit
    bits.push(ProtocolConfig.STOP_BIT);
  }
  return bits;
}

/**
 * Convert raw bytes to bits without UART framing
 */
export function rawBytesToBits(data: Uint8Array): number[] {
  const bits: number[] = [];
  for (let i = 0; i < data.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((data[i] >> b) & 1);
    }
  }
  return bits;
}

/**
 * Convert a number to big-endian bytes
 */
export function uint16ToBytes(value: number): Uint8Array {
  return new Uint8Array([(value >> 8) & 0xFF, value & 0xFF]);
}

export function uint32ToBytes(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 24) & 0xFF,
    (value >> 16) & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
  ]);
}
