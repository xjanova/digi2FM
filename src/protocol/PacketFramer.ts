import { ProtocolConfig } from '../constants/ProtocolConfig';
import { crc16 } from './CrcCalculator';
import { FileHeaderPayload, Packet, PacketHeader } from '../types';
import { uint16ToBytes, uint32ToBytes } from '../codec/BinaryEncoder';

/**
 * Generate preamble bits: alternating 1010... followed by sync word
 */
export function generatePreamble(): number[] {
  const bits: number[] = [];
  // Alternating pattern for clock recovery
  for (let i = 0; i < ProtocolConfig.PREAMBLE_BITS; i++) {
    bits.push(i % 2 === 0 ? 1 : 0);
  }
  // Sync word (0x7E7E = 0111 1110 0111 1110)
  const syncWord = ProtocolConfig.SYNC_WORD;
  for (let i = 15; i >= 0; i--) {
    bits.push((syncWord >> i) & 1);
  }
  return bits;
}

/**
 * Build a packet byte array from components
 */
export function framePacket(seqNo: number, pktType: number, data: Uint8Array): Uint8Array {
  const length = 2 + 2 + 1 + data.length + 2; // len + seq + type + data + crc
  const packet = new Uint8Array(length);

  // LENGTH (2 bytes)
  const lenBytes = uint16ToBytes(length);
  packet[0] = lenBytes[0];
  packet[1] = lenBytes[1];

  // SEQ_NO (2 bytes)
  const seqBytes = uint16ToBytes(seqNo);
  packet[2] = seqBytes[0];
  packet[3] = seqBytes[1];

  // PKT_TYPE (1 byte)
  packet[4] = pktType;

  // DATA
  packet.set(data, 5);

  // CRC over everything except the CRC field itself
  const crcData = packet.subarray(0, length - 2);
  const crcValue = crc16(crcData);
  const crcBytes = uint16ToBytes(crcValue);
  packet[length - 2] = crcBytes[0];
  packet[length - 1] = crcBytes[1];

  return packet;
}

/**
 * Create a FILE_HEADER packet
 */
export function createFileHeaderPacket(
  fileName: string,
  fileSize: number,
  totalChunks: number,
  mimeType: string
): Uint8Array {
  const encoder = new TextEncoder();
  let nameBytes = encoder.encode(fileName);
  let mimeBytes = encoder.encode(mimeType);

  // Truncate to fit in single byte length fields (max 255)
  if (nameBytes.length > 255) nameBytes = nameBytes.subarray(0, 255);
  if (mimeBytes.length > 255) mimeBytes = mimeBytes.subarray(0, 255);

  // Payload: [nameLen 1B][name][fileSize 4B][totalChunks 2B][mimeLen 1B][mime]
  const payloadSize = 1 + nameBytes.length + 4 + 2 + 1 + mimeBytes.length;
  const payload = new Uint8Array(payloadSize);
  let offset = 0;

  payload[offset++] = nameBytes.length;
  payload.set(nameBytes, offset);
  offset += nameBytes.length;

  const sizeBytes = uint32ToBytes(fileSize);
  payload.set(sizeBytes, offset);
  offset += 4;

  const chunkBytes = uint16ToBytes(totalChunks);
  payload.set(chunkBytes, offset);
  offset += 2;

  payload[offset++] = mimeBytes.length;
  payload.set(mimeBytes, offset);

  return framePacket(0, ProtocolConfig.PKT_TYPE_FILE_HEADER, payload);
}

/**
 * Create a DATA packet
 */
export function createDataPacket(seqNo: number, data: Uint8Array): Uint8Array {
  return framePacket(seqNo, ProtocolConfig.PKT_TYPE_DATA, data);
}

/**
 * Create an EOF packet
 */
export function createEofPacket(totalChunks: number): Uint8Array {
  const payload = uint16ToBytes(totalChunks);
  return framePacket(totalChunks + 1, ProtocolConfig.PKT_TYPE_EOF, payload);
}

/**
 * Parse a FILE_HEADER payload
 */
export function parseFileHeader(data: Uint8Array): FileHeaderPayload {
  const decoder = new TextDecoder();
  let offset = 0;

  const nameLen = data[offset++];
  const fileName = decoder.decode(data.subarray(offset, offset + nameLen));
  offset += nameLen;

  const fileSize =
    ((data[offset] << 24) >>> 0) +
    (data[offset + 1] << 16) +
    (data[offset + 2] << 8) +
    data[offset + 3];
  offset += 4;

  const totalChunks = (data[offset] << 8) | data[offset + 1];
  offset += 2;

  const mimeLen = data[offset++];
  const mimeType = decoder.decode(data.subarray(offset, offset + mimeLen));

  return { fileName, fileSize, totalChunks, mimeType };
}
