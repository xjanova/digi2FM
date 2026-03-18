import { ProtocolConfig } from '../constants/ProtocolConfig';

// CRC-16-CCITT lookup table
const crcTable: number[] = [];

(function initTable() {
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ ProtocolConfig.CRC_POLYNOMIAL) : (crc << 1);
      crc &= 0xFFFF;
    }
    crcTable[i] = crc;
  }
})();

export function crc16(data: Uint8Array): number {
  let crc: number = ProtocolConfig.CRC_INIT;
  for (let i = 0; i < data.length; i++) {
    const tableIndex = ((crc >> 8) ^ data[i]) & 0xFF;
    crc = ((crc << 8) ^ crcTable[tableIndex]) & 0xFFFF;
  }
  return crc;
}

export function verifyCrc(data: Uint8Array, expectedCrc: number): boolean {
  return crc16(data) === expectedCrc;
}
