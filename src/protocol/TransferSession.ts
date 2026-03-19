import { ProtocolConfig } from '../constants/ProtocolConfig';
import { TransferState, TransferStatus, Packet, FileHeaderPayload, SelectedFile } from '../types';
import {
  createFileHeaderPacket,
  createDataPacket,
  createEofPacket,
  parseFileHeader,
} from './PacketFramer';
import { chunkFile, calculateChunkCount, reassembleChunks } from './FileChunker';
import { AudioEngine } from '../audio/AudioEngine';
import { readFileAsBytes, saveFile } from '../utils/FileUtils';

type StateChangeCallback = (state: TransferState) => void;
type CompleteCallback = (filePath: string) => void;

/**
 * Manages the full lifecycle of a file transfer (send or receive)
 */
export class TransferSession {
  private audioEngine: AudioEngine;
  private state: TransferState;
  private onStateChange?: StateChangeCallback;
  private onComplete?: CompleteCallback;

  // Receive state
  private receivedChunks: Map<number, Uint8Array> = new Map();
  private fileHeader: FileHeaderPayload | null = null;
  private receiveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastPacketTime: number = 0;

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;
    this.state = {
      status: 'idle',
      progress: 0,
      currentPacket: 0,
      totalPackets: 0,
    };
  }

  setOnStateChange(callback: StateChangeCallback) {
    this.onStateChange = callback;
  }

  setOnComplete(callback: CompleteCallback) {
    this.onComplete = callback;
  }

  getState(): TransferState {
    return { ...this.state };
  }

  // ============ SEND ============

  async startSend(file: SelectedFile): Promise<void> {
    try {
      this.updateState({ status: 'preparing', progress: 0 });

      // Read file data
      const fileData = await readFileAsBytes(file.uri);
      const chunks = chunkFile(fileData);
      const totalChunks = chunks.length;

      // Create all packets
      const packets: Uint8Array[] = [];

      // 1. File header packet
      const headerPacket = createFileHeaderPacket(
        file.name,
        file.size,
        totalChunks,
        file.mimeType
      );
      packets.push(headerPacket);

      // 2. Data packets (seqNo starts at 1)
      for (let i = 0; i < chunks.length; i++) {
        packets.push(createDataPacket(i + 1, chunks[i]));
      }

      // 3. EOF packet
      packets.push(createEofPacket(totalChunks));

      this.updateState({
        status: 'sending_header',
        totalPackets: packets.length,
        fileName: file.name,
        fileSize: file.size,
      });

      // Transmit all packets
      await this.audioEngine.transmitPackets(packets, (packetIndex) => {
        const status: TransferStatus =
          packetIndex === 0
            ? 'sending_header'
            : packetIndex < packets.length - 1
            ? 'sending_data'
            : 'sending_eof';

        this.updateState({
          status,
          currentPacket: packetIndex + 1,
          progress: (packetIndex + 1) / packets.length,
        });
      });

      this.updateState({ status: 'completed', progress: 1 });
    } catch (error: any) {
      this.updateState({
        status: 'error',
        error: error.message || 'Send failed',
      });
    }
  }

  // ============ RECEIVE ============

  startReceive(): void {
    this.receivedChunks.clear();
    this.fileHeader = null;
    this.lastPacketTime = Date.now();

    this.updateState({ status: 'waiting_sync', progress: 0 });

    // Packet callback must be synchronous - queue async work separately
    this.audioEngine.startReceiving(
      (packet) => this.handleReceivedPacket(packet),
      (detected, _markEnergy, _spaceEnergy) => {
        if (detected) {
          this.lastPacketTime = Date.now();
        }
      }
    );

    // Start timeout watchdog
    this.startTimeoutWatchdog();
  }

  /**
   * Handle a received packet. This is called synchronously from the
   * demodulator, so async work (file saving) is queued via setTimeout.
   */
  private handleReceivedPacket(packet: Packet): void {
    this.lastPacketTime = Date.now();

    switch (packet.header.pktType) {
      case ProtocolConfig.PKT_TYPE_FILE_HEADER: {
        try {
          this.fileHeader = parseFileHeader(packet.data);
          // Validate header
          if (!this.fileHeader.fileName || this.fileHeader.totalChunks <= 0) {
            this.updateState({ status: 'error', error: 'Invalid file header' });
            return;
          }
          this.updateState({
            status: 'receiving_header',
            fileName: this.fileHeader.fileName,
            fileSize: this.fileHeader.fileSize,
            totalPackets: this.fileHeader.totalChunks + 2,
          });
        } catch {
          this.updateState({ status: 'error', error: 'Corrupted file header' });
        }
        break;
      }

      case ProtocolConfig.PKT_TYPE_DATA: {
        if (!this.fileHeader) return;
        this.receivedChunks.set(packet.header.seqNo, packet.data);
        const dataProgress = this.receivedChunks.size / this.fileHeader.totalChunks;
        this.updateState({
          status: 'receiving_data',
          currentPacket: this.receivedChunks.size + 1,
          progress: dataProgress,
        });
        break;
      }

      case ProtocolConfig.PKT_TYPE_EOF: {
        // Queue async finishReceive via setTimeout to avoid blocking demodulator
        this.clearTimeoutWatchdog();
        setTimeout(() => this.finishReceive(), 0);
        break;
      }
    }
  }

  private async finishReceive() {
    if (!this.fileHeader) {
      this.updateState({ status: 'error', error: 'No file header received' });
      return;
    }

    this.updateState({ status: 'reassembling' });
    this.audioEngine.stopReceiving();

    const data = reassembleChunks(
      this.receivedChunks,
      this.fileHeader.totalChunks,
      this.fileHeader.fileSize
    );

    if (!data) {
      const missing = [];
      for (let i = 1; i <= this.fileHeader.totalChunks; i++) {
        if (!this.receivedChunks.has(i)) missing.push(i);
      }
      this.updateState({
        status: 'error',
        error: `Missing ${missing.length} chunks: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`,
      });
      return;
    }

    try {
      const filePath = await saveFile(data, this.fileHeader.fileName);
      this.updateState({ status: 'completed', progress: 1 });
      this.onComplete?.(filePath);
    } catch (error: any) {
      this.updateState({
        status: 'error',
        error: error.message || 'Failed to save file',
      });
    }
  }

  // ============ TIMEOUT ============

  private startTimeoutWatchdog() {
    this.clearTimeoutWatchdog();
    this.receiveTimeoutId = setInterval(() => {
      const elapsed = Date.now() - this.lastPacketTime;
      // Timeout after 30 seconds of no signal
      if (elapsed > ProtocolConfig.SYNC_TIMEOUT_MS) {
        const status = this.state.status;
        if (status === 'waiting_sync') {
          // Still waiting for first sync - just continue
          return;
        }
        if (status === 'receiving_data' || status === 'receiving_header') {
          this.clearTimeoutWatchdog();
          this.updateState({
            status: 'error',
            error: `Transfer timed out after ${Math.round(elapsed / 1000)}s of silence`,
          });
          this.audioEngine.stopReceiving();
        }
      }
    }, 5000);
  }

  private clearTimeoutWatchdog() {
    if (this.receiveTimeoutId) {
      clearInterval(this.receiveTimeoutId);
      this.receiveTimeoutId = null;
    }
  }

  // ============ CONTROL ============

  stop() {
    this.clearTimeoutWatchdog();
    this.audioEngine.stopTransmitting();
    this.audioEngine.stopReceiving();
    this.updateState({ status: 'idle', progress: 0 });
  }

  private updateState(partial: Partial<TransferState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.({ ...this.state });
  }
}
