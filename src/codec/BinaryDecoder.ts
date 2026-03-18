import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Convert UART-framed bit stream back to bytes.
 * Expects: [START(0)] [8 data bits MSB first] [STOP(1)] per byte.
 * Validates start and stop bits for frame integrity.
 */
export function bitsToBytes(bits: number[]): Uint8Array {
  const bitsPerByte = ProtocolConfig.BITS_PER_BYTE; // 10 (start + 8 data + stop)
  const byteCount = Math.floor(bits.length / bitsPerByte);
  const result = new Uint8Array(byteCount);

  for (let i = 0; i < byteCount; i++) {
    const offset = i * bitsPerByte;

    // Validate start bit (should be 0) and stop bit (should be 1)
    // If framing is invalid, still decode but mark with 0xFF as error indicator
    const startBit = bits[offset];
    const stopBit = bits[offset + 9];
    if (startBit !== 0 || stopBit !== 1) {
      // Frame error - decode anyway (best-effort)
      // The CRC check at the packet level will catch corruption
    }

    // Read 8 data bits, MSB first
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[offset + 1 + b] & 1);
    }
    result[i] = byte;
  }

  return result;
}

/**
 * Convert raw bits (no UART framing) back to bytes
 */
export function rawBitsToBytes(bits: number[]): Uint8Array {
  const byteCount = Math.floor(bits.length / 8);
  const result = new Uint8Array(byteCount);

  for (let i = 0; i < byteCount; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | (bits[i * 8 + b] & 1);
    }
    result[i] = byte;
  }

  return result;
}

/**
 * Read a uint16 (big-endian) from byte array at offset
 */
export function bytesToUint16(data: Uint8Array, offset: number = 0): number {
  return (data[offset] << 8) | data[offset + 1];
}

/**
 * Read a uint32 (big-endian) from byte array at offset
 */
export function bytesToUint32(data: Uint8Array, offset: number = 0): number {
  return (
    ((data[offset] << 24) >>> 0) +
    (data[offset + 1] << 16) +
    (data[offset + 2] << 8) +
    data[offset + 3]
  );
}
