import { ErrorCorrectionMode, BaudRate } from '../constants/ProtocolConfig';

// Transfer status (legacy one-way)
export type TransferStatus =
  | 'idle'
  | 'preparing'
  | 'syncing'
  | 'sending_header'
  | 'sending_data'
  | 'sending_eof'
  | 'waiting_sync'
  | 'receiving_header'
  | 'receiving_data'
  | 'reassembling'
  | 'completed'
  | 'error';

// Session status (two-way)
export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'connected'
  | 'sending'
  | 'receiving'
  | 'disconnecting'
  | 'error';

export type SessionRole = 'initiator' | 'responder';

// Packet types
export interface PacketHeader {
  length: number;
  seqNo: number;
  pktType: number;
}

export interface Packet {
  header: PacketHeader;
  data: Uint8Array;
  crc: number;
}

// File header (first packet payload)
export interface FileHeaderPayload {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  mimeType: string;
}

// Connect packet payload
export interface ConnectPayload {
  protocolVersion: number;
  capabilities: number;
  sessionSalt: Uint8Array;
  keyHash: Uint8Array;
}

// ACK/NACK payloads
export interface AckPayload {
  ackedSeqNo: number;
}

export interface NackPayload {
  nackedSeqNo: number;
  reason: number;
}

// Transfer state (legacy one-way)
export interface TransferState {
  status: TransferStatus;
  progress: number;           // 0-1
  currentPacket: number;
  totalPackets: number;
  fileName?: string;
  fileSize?: number;
  error?: string;
  estimatedTimeRemaining?: number;
}

// Session state (two-way)
export interface SessionState {
  status: SessionStatus;
  role?: SessionRole;
  peerConnected: boolean;
  encryptionActive: boolean;
  // Current transfer progress (if sending/receiving)
  transferProgress: number;    // 0-1
  currentPacket: number;
  totalPackets: number;
  fileName?: string;
  fileSize?: number;
  retryCount?: number;
  // History
  transferHistory: TransferHistoryEntry[];
  error?: string;
}

export interface TransferHistoryEntry {
  direction: 'sent' | 'received';
  fileName: string;
  fileSize: number;
  timestamp: number;
  success: boolean;
}

// Settings
export interface AppSettings {
  baudRate: BaudRate;
  markFreq: number;
  spaceFreq: number;
  errorCorrection: ErrorCorrectionMode;
  volumeBoost: boolean;
  debugMode: boolean;
  encryptionEnabled: boolean;
  encryptionPassphrase: string;
}

// File info
export interface SelectedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

// Audio engine events
export interface AudioEngineCallbacks {
  onBitsReceived?: (bits: number[]) => void;
  onSignalDetected?: (detected: boolean) => void;
  onSpectrumData?: (markEnergy: number, spaceEnergy: number) => void;
}

export { ErrorCorrectionMode, BaudRate };
