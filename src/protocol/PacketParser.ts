import { ProtocolConfig } from '../constants/ProtocolConfig';
import { crc16 } from './CrcCalculator';
import { Packet, PacketHeader } from '../types';
import { bytesToUint16 } from '../codec/BinaryDecoder';

/**
 * Parse raw packet bytes into a Packet struct.
 * Returns null if CRC check fails.
 */
export function parsePacket(raw: Uint8Array): Packet | null {
  if (raw.length < 7) return null; // minimum: 2+2+1+0+2

  const length = bytesToUint16(raw, 0);
  if (length !== raw.length) return null;

  const seqNo = bytesToUint16(raw, 2);
  const pktType = raw[4];

  const dataLen = length - 7; // total - (len2 + seq2 + type1 + crc2)
  const data = raw.subarray(5, 5 + dataLen);

  // Verify CRC
  const crcData = raw.subarray(0, length - 2);
  const expectedCrc = crc16(crcData);
  const receivedCrc = bytesToUint16(raw, length - 2);

  if (expectedCrc !== receivedCrc) {
    return null; // CRC mismatch
  }

  return {
    header: { length, seqNo, pktType },
    data: new Uint8Array(data),
    crc: receivedCrc,
  };
}

/**
 * Extract packet bytes from a continuous byte stream.
 * Reads the length field first, then extracts that many bytes.
 * Returns [packet, remainingBytes] or [null, allBytes] if not enough data.
 */
export function extractPacketFromStream(stream: Uint8Array): [Uint8Array | null, Uint8Array] {
  if (stream.length < 2) return [null, stream];

  const length = bytesToUint16(stream, 0);
  if (length < 7 || length > 256) return [null, stream.subarray(1)]; // invalid, skip byte

  if (stream.length < length) return [null, stream]; // not enough data yet

  const packetBytes = stream.subarray(0, length);
  const remaining = stream.subarray(length);
  return [new Uint8Array(packetBytes), new Uint8Array(remaining)];
}
