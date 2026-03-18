import { ErrorCorrectionMode, BaudRate } from '../constants/ProtocolConfig';

// Transfer status
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

// Transfer state
export interface TransferState {
  status: TransferStatus;
  progress: number;           // 0-1
  currentPacket: number;
  totalPackets: number;
  fileName?: string;
  fileSize?: number;
  error?: string;
  estimatedTimeRemaining?: number; // seconds
}

// Settings
export interface AppSettings {
  baudRate: BaudRate;
  markFreq: number;
  spaceFreq: number;
  errorCorrection: ErrorCorrectionMode;
  volumeBoost: boolean;
  debugMode: boolean;
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
