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

  if (data.length < 8) {
    throw new Error('File header too short');
  }

  const nameLen = data[offset++];
  if (offset + nameLen + 7 > data.length) {
    throw new Error('File header truncated at filename');
  }
  const fileName = decoder.decode(data.subarray(offset, offset + nameLen));
  offset += nameLen;

  if (offset + 6 > data.length) {
    throw new Error('File header truncated at file size');
  }

  const fileSize =
    ((data[offset] << 24) >>> 0) +
    (data[offset + 1] << 16) +
    (data[offset + 2] << 8) +
    data[offset + 3];
  offset += 4;

  const totalChunks = (data[offset] << 8) | data[offset + 1];
  offset += 2;

  if (offset >= data.length) {
    throw new Error('File header truncated at mime type');
  }

  const mimeLen = data[offset++];
  const mimeType = offset + mimeLen <= data.length
    ? decoder.decode(data.subarray(offset, offset + mimeLen))
    : 'application/octet-stream';

  return { fileName, fileSize, totalChunks, mimeType };
}

// ============ SESSION CONTROL PACKETS ============

/**
 * Create a CONNECT packet for two-way session handshake
 */
export function createConnectPacket(
  version: number,
  capabilities: number,
  sessionSalt: Uint8Array,
  keyHash: Uint8Array
): Uint8Array {
  // Payload: [version 1B][capabilities 1B][sessionSalt 16B][keyHash 8B]
  const payload = new Uint8Array(26);
  payload[0] = version;
  payload[1] = capabilities;
  payload.set(sessionSalt.subarray(0, 16), 2);
  payload.set(keyHash.subarray(0, 8), 18);
  return framePacket(0, ProtocolConfig.PKT_TYPE_CONNECT, payload);
}

/**
 * Create a CONNECT_ACK packet
 */
export function createConnectAckPacket(
  version: number,
  capabilities: number,
  sessionSalt: Uint8Array,
  keyHash: Uint8Array
): Uint8Array {
  const payload = new Uint8Array(26);
  payload[0] = version;
  payload[1] = capabilities;
  payload.set(sessionSalt.subarray(0, 16), 2);
  payload.set(keyHash.subarray(0, 8), 18);
  return framePacket(0, ProtocolConfig.PKT_TYPE_CONNECT_ACK, payload);
}

/**
 * Parse a CONNECT or CONNECT_ACK payload
 */
export function parseConnectPayload(data: Uint8Array): {
  protocolVersion: number;
  capabilities: number;
  sessionSalt: Uint8Array;
  keyHash: Uint8Array;
} {
  if (data.length < 26) throw new Error('Connect payload too short');
  return {
    protocolVersion: data[0],
    capabilities: data[1],
    sessionSalt: new Uint8Array(data.subarray(2, 18)),
    keyHash: new Uint8Array(data.subarray(18, 26)),
  };
}

/**
 * Create an ACK packet
 */
export function createAckPacket(ackedSeqNo: number): Uint8Array {
  const payload = new Uint8Array(2);
  payload[0] = (ackedSeqNo >> 8) & 0xFF;
  payload[1] = ackedSeqNo & 0xFF;
  return framePacket(0, ProtocolConfig.PKT_TYPE_ACK, payload);
}

/**
 * Create a NACK packet
 */
export function createNackPacket(nackedSeqNo: number, reason: number): Uint8Array {
  const payload = new Uint8Array(3);
  payload[0] = (nackedSeqNo >> 8) & 0xFF;
  payload[1] = nackedSeqNo & 0xFF;
  payload[2] = reason;
  return framePacket(0, ProtocolConfig.PKT_TYPE_NACK, payload);
}

/**
 * Create a DISCONNECT packet
 */
export function createDisconnectPacket(reason: number): Uint8Array {
  const payload = new Uint8Array(1);
  payload[0] = reason;
  return framePacket(0, ProtocolConfig.PKT_TYPE_DISCONNECT, payload);
}

/**
 * Parse an ACK payload
 */
export function parseAckPayload(data: Uint8Array): { ackedSeqNo: number } {
  if (data.length < 2) throw new Error('ACK payload too short');
  return { ackedSeqNo: (data[0] << 8) | data[1] };
}

/**
 * Parse a NACK payload
 */
export function parseNackPayload(data: Uint8Array): { nackedSeqNo: number; reason: number } {
  if (data.length < 3) throw new Error('NACK payload too short');
  return {
    nackedSeqNo: (data[0] << 8) | data[1],
    reason: data[2],
  };
}
