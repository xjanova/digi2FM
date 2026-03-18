export const ProtocolConfig = {
  // Audio
  SAMPLE_RATE: 44100,

  // FSK Frequencies (Bell 202 standard)
  MARK_FREQ: 1200,   // bit 1
  SPACE_FREQ: 2200,  // bit 0

  // Baud rates
  DEFAULT_BAUD_RATE: 300,
  BAUD_RATES: [300, 600, 1200] as const,

  // Packet structure
  PREAMBLE_BITS: 64,           // alternating 1010... for clock recovery
  SYNC_WORD: 0x7E7E,           // 2-byte sync word after preamble
  SYNC_WORD_BITS: 16,
  MAX_PACKET_DATA_SIZE: 64,    // bytes per packet payload

  // Packet types
  PKT_TYPE_FILE_HEADER: 0x01,
  PKT_TYPE_DATA: 0x02,
  PKT_TYPE_EOF: 0x03,

  // Timing
  INTER_PACKET_GAP_MS: 150,    // silence between packets
  SYNC_TIMEOUT_MS: 30000,      // how long to wait for sync
  PACKET_TIMEOUT_MS: 5000,     // timeout for a single packet

  // Error correction modes
  ERROR_CORRECTION_NONE: 'none' as const,
  ERROR_CORRECTION_REPETITION: 'repetition' as const,
  ERROR_CORRECTION_HAMMING: 'hamming' as const,
  REPETITION_FACTOR: 3,

  // CRC
  CRC_POLYNOMIAL: 0x1021,      // CRC-16-CCITT
  CRC_INIT: 0xFFFF,

  // Goertzel detection
  GOERTZEL_THRESHOLD: 0.01,    // minimum energy to consider signal present

  // UART framing
  START_BIT: 0,
  STOP_BIT: 1,
  BITS_PER_BYTE: 10,           // 1 start + 8 data + 1 stop
} as const;

export type BaudRate = typeof ProtocolConfig.BAUD_RATES[number];
export type ErrorCorrectionMode =
  | typeof ProtocolConfig.ERROR_CORRECTION_NONE
  | typeof ProtocolConfig.ERROR_CORRECTION_REPETITION
  | typeof ProtocolConfig.ERROR_CORRECTION_HAMMING;
