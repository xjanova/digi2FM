import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Split a file's data into chunks of MAX_PACKET_DATA_SIZE
 */
export function chunkFile(data: Uint8Array): Uint8Array[] {
  const chunkSize = ProtocolConfig.MAX_PACKET_DATA_SIZE;
  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, data.length);
    chunks.push(new Uint8Array(data.subarray(offset, end)));
  }

  return chunks;
}

/**
 * Calculate how many chunks a file of given size will produce
 */
export function calculateChunkCount(fileSize: number): number {
  return Math.ceil(fileSize / ProtocolConfig.MAX_PACKET_DATA_SIZE);
}

/**
 * Reassemble chunks into original data.
 * chunks is a Map of seqNo -> data, where seqNo starts at 1.
 */
export function reassembleChunks(
  chunks: Map<number, Uint8Array>,
  totalChunks: number,
  expectedSize: number
): Uint8Array | null {
  // Verify we have all chunks
  for (let i = 1; i <= totalChunks; i++) {
    if (!chunks.has(i)) {
      return null; // Missing chunk
    }
  }

  // Calculate total size from chunks
  let totalSize = 0;
  for (let i = 1; i <= totalChunks; i++) {
    totalSize += chunks.get(i)!.length;
  }

  // Reassemble
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (let i = 1; i <= totalChunks; i++) {
    const chunk = chunks.get(i)!;
    result.set(chunk, offset);
    offset += chunk.length;
  }

  // Truncate to expected size if reassembled data is larger
  if (expectedSize > 0 && totalSize > expectedSize) {
    return result.subarray(0, expectedSize);
  }

  return result;
}

/**
 * Estimate transfer time in seconds
 */
export function estimateTransferTime(fileSize: number, baudRate: number): number {
  const bitsPerByte = ProtocolConfig.BITS_PER_BYTE; // 10 (UART framing)
  const totalChunks = calculateChunkCount(fileSize);

  // Overhead per packet: preamble + sync + header + CRC
  const preambleBytes = (ProtocolConfig.PREAMBLE_BITS + ProtocolConfig.SYNC_WORD_BITS) / 8;
  const headerOverhead = 2 + 2 + 1 + 2; // length + seqNo + type + crc
  const overheadPerPacket = preambleBytes + headerOverhead;

  // Total bytes including overhead
  const totalBytes = fileSize + (totalChunks * overheadPerPacket) + overheadPerPacket; // +1 for header packet

  // Bits to transmit
  const totalBits = totalBytes * bitsPerByte;

  // Time for bits + inter-packet gaps
  const bitTime = totalBits / baudRate;
  const gapTime = (totalChunks + 2) * (ProtocolConfig.INTER_PACKET_GAP_MS / 1000);

  return bitTime + gapTime;
}
