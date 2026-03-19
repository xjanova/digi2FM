import { ProtocolConfig } from '../constants/ProtocolConfig';
import {
  SessionState, SessionStatus, Packet, FileHeaderPayload,
  SelectedFile, TransferHistoryEntry,
} from '../types';
import {
  createConnectPacket, createConnectAckPacket, createAckPacket,
  createNackPacket, createDisconnectPacket, createFileHeaderPacket,
  createDataPacket, createEofPacket,
  parseConnectPayload, parseAckPayload, parseNackPayload,
  parseFileHeader,
} from './PacketFramer';
import { chunkFile, reassembleChunks } from './FileChunker';
import { AudioEngine } from '../audio/AudioEngine';
import { CryptoEngine } from '../crypto/CryptoEngine';
import { readFileAsBytes, saveFile } from '../utils/FileUtils';

type StateCallback = (state: SessionState) => void;
type FileCallback = (filePath: string) => void;

/**
 * SessionManager - orchestrates two-way communication.
 *
 * Protocol flow (half-duplex, stop-and-wait ARQ):
 * 1. CONNECT/CONNECT_ACK handshake (verify encryption key)
 * 2. Either side can send files: FILE_HEADER -> ACK -> DATA+ACK -> EOF+ACK
 * 3. DISCONNECT to end session
 *
 * The mic recording loop runs externally (in useSession hook).
 * Incoming packets arrive via handlePacket().
 * Outgoing packets are sent via AudioEngine.transmitSinglePacket().
 */
export class SessionManager {
  private audioEngine: AudioEngine;
  private crypto: CryptoEngine;
  private state: SessionState;
  private onStateChange?: StateCallback;
  private onFileReceived?: FileCallback;

  // Session
  private localSalt: Uint8Array = new Uint8Array(0);
  private peerSalt: Uint8Array = new Uint8Array(0);

  // Send state
  private sendPackets: Uint8Array[] = [];
  private sendIndex: number = 0;
  private sendRetries: number = 0;
  private sendResolve?: (success: boolean) => void;
  private ackTimeoutId?: ReturnType<typeof setTimeout>;

  // Receive state
  private receivedChunks: Map<number, Uint8Array> = new Map();
  private fileHeader: FileHeaderPayload | null = null;

  // Connection state
  private connectRetries: number = 0;
  private connectTimeoutId?: ReturnType<typeof setTimeout>;

  constructor(audioEngine: AudioEngine, crypto: CryptoEngine) {
    this.audioEngine = audioEngine;
    this.crypto = crypto;
    this.state = this.defaultState();
  }

  private defaultState(): SessionState {
    return {
      status: 'idle',
      peerConnected: false,
      encryptionActive: false,
      transferProgress: 0,
      currentPacket: 0,
      totalPackets: 0,
      transferHistory: [],
    };
  }

  setOnStateChange(cb: StateCallback) { this.onStateChange = cb; }
  setOnFileReceived(cb: FileCallback) { this.onFileReceived = cb; }
  getState(): SessionState { return { ...this.state }; }

  // ============ CONNECTION ============

  /**
   * Initiate a connection (send CONNECT, wait for CONNECT_ACK)
   */
  async initiateConnection(): Promise<void> {
    this.localSalt = this.crypto.generateSessionSalt();
    this.connectRetries = 0;
    this.updateState({ status: 'connecting', role: 'initiator' });

    // Start demodulator to listen for CONNECT_ACK
    this.audioEngine.startReceiving(
      (packet) => this.handlePacket(packet)
    );

    await this.sendConnectWithRetry();
  }

  private async sendConnectWithRetry(): Promise<void> {
    if (this.state.status !== 'connecting') return;

    const packet = createConnectPacket(
      ProtocolConfig.PROTOCOL_VERSION,
      this.crypto.getCapabilities(),
      this.localSalt,
      this.crypto.getKeyHash()
    );

    await this.audioEngine.transmitSinglePacket(packet);

    // Set timeout for retry
    this.connectTimeoutId = setTimeout(async () => {
      this.connectRetries++;
      if (this.connectRetries >= ProtocolConfig.CONNECT_RETRIES) {
        this.updateState({
          status: 'error',
          error: 'Connection timed out - no response from peer',
        });
        this.audioEngine.stopReceiving();
        return;
      }
      // Retry
      await this.sendConnectWithRetry();
    }, ProtocolConfig.CONNECT_TIMEOUT_MS);
  }

  /**
   * Listen for incoming connection
   */
  listenForConnection(): void {
    this.localSalt = this.crypto.generateSessionSalt();
    this.updateState({ status: 'listening', role: 'responder' });

    this.audioEngine.startReceiving(
      (packet) => this.handlePacket(packet)
    );
  }

  /**
   * Disconnect from peer
   */
  async disconnect(): Promise<void> {
    this.clearAllTimers();

    if (this.state.peerConnected) {
      this.updateState({ status: 'disconnecting' });
      const packet = createDisconnectPacket(ProtocolConfig.DISCONNECT_NORMAL);
      try {
        await this.audioEngine.transmitSinglePacket(packet);
      } catch {
        // Best effort
      }
    }

    this.audioEngine.stopReceiving();
    this.audioEngine.stopTransmitting();
    this.crypto.reset();
    this.receivedChunks.clear();
    this.fileHeader = null;
    this.sendPackets = [];

    const history = this.state.transferHistory;
    this.state = this.defaultState();
    this.state.transferHistory = history;
    this.updateState({ status: 'idle' });
  }

  // ============ FILE TRANSFER (SEND) ============

  /**
   * Send a file to the connected peer using stop-and-wait ARQ.
   */
  async sendFile(file: SelectedFile): Promise<boolean> {
    if (this.state.status !== 'connected') return false;

    this.updateState({ status: 'sending', fileName: file.name, fileSize: file.size });

    try {
      const fileData = await readFileAsBytes(file.uri);
      const chunks = chunkFile(fileData);
      const totalChunks = chunks.length;

      // Build all packets
      this.sendPackets = [];

      // Header packet
      this.sendPackets.push(createFileHeaderPacket(
        file.name, file.size, totalChunks, file.mimeType
      ));

      // Data packets (encrypt payloads)
      for (let i = 0; i < chunks.length; i++) {
        const seqNo = i + 1;
        const payload = this.crypto.isEnabled()
          ? this.crypto.encrypt(chunks[i], seqNo)
          : chunks[i];
        this.sendPackets.push(createDataPacket(seqNo, payload));
      }

      // EOF packet
      this.sendPackets.push(createEofPacket(totalChunks));

      this.updateState({
        totalPackets: this.sendPackets.length,
        currentPacket: 0,
        transferProgress: 0,
      });

      // Send each packet with stop-and-wait ARQ
      for (let i = 0; i < this.sendPackets.length; i++) {
        if ((this.state.status as string) !== 'sending') return false;

        const success = await this.sendPacketWithArq(this.sendPackets[i], i);
        if (!success) {
          this.updateState({
            status: 'error',
            error: `Failed to send packet ${i + 1} after ${ProtocolConfig.MAX_RETRIES} retries`,
          });
          this.addHistory('sent', file.name, file.size, false);
          this.updateState({ status: 'connected' });
          return false;
        }

        this.updateState({
          currentPacket: i + 1,
          transferProgress: (i + 1) / this.sendPackets.length,
        });
      }

      // Transfer complete
      this.addHistory('sent', file.name, file.size, true);
      this.updateState({
        status: 'connected',
        transferProgress: 1,
        currentPacket: this.sendPackets.length,
      });
      return true;
    } catch (err: any) {
      this.updateState({
        status: 'error',
        error: err.message || 'Send failed',
      });
      this.addHistory('sent', file.name, file.size, false);
      this.updateState({ status: 'connected' });
      return false;
    }
  }

  /**
   * Send a single packet and wait for ACK. Returns true if ACK received.
   */
  private sendPacketWithArq(packetBytes: Uint8Array, _index: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      this.sendRetries = 0;
      this.sendResolve = resolve;

      const attemptSend = async () => {
        if (this.state.status !== 'sending') {
          resolve(false);
          return;
        }

        await this.audioEngine.transmitSinglePacket(packetBytes);

        // Wait for ACK
        this.ackTimeoutId = setTimeout(async () => {
          this.sendRetries++;
          this.updateState({ retryCount: this.sendRetries });

          if (this.sendRetries >= ProtocolConfig.MAX_RETRIES) {
            this.sendResolve = undefined;
            resolve(false);
            return;
          }

          // Retransmit
          console.log(`[Digi2FM] Retransmit attempt ${this.sendRetries}`);
          await attemptSend();
        }, ProtocolConfig.ACK_TIMEOUT_MS);
      };

      await attemptSend();
    });
  }

  // ============ PACKET HANDLER ============

  /**
   * Handle an incoming packet (called from demodulator via AudioEngine).
   * MUST be synchronous - async work is queued via setTimeout.
   */
  handlePacket(packet: Packet): void {
    const pktType = packet.header.pktType;

    switch (pktType) {
      case ProtocolConfig.PKT_TYPE_CONNECT:
        this.onConnect(packet);
        break;
      case ProtocolConfig.PKT_TYPE_CONNECT_ACK:
        this.onConnectAck(packet);
        break;
      case ProtocolConfig.PKT_TYPE_ACK:
        this.onAck(packet);
        break;
      case ProtocolConfig.PKT_TYPE_NACK:
        this.onNack(packet);
        break;
      case ProtocolConfig.PKT_TYPE_DISCONNECT:
        this.onDisconnect();
        break;
      case ProtocolConfig.PKT_TYPE_FILE_HEADER:
        this.onFileHeader(packet);
        break;
      case ProtocolConfig.PKT_TYPE_DATA:
        this.onData(packet);
        break;
      case ProtocolConfig.PKT_TYPE_EOF:
        this.onEof(packet);
        break;
    }
  }

  private onConnect(packet: Packet): void {
    if (this.state.status !== 'listening') return;

    try {
      const payload = parseConnectPayload(packet.data);

      // Verify key hash
      if (this.crypto.isEnabled() && !this.crypto.verifyKeyHash(payload.keyHash)) {
        // Key mismatch
        setTimeout(async () => {
          const nack = createDisconnectPacket(ProtocolConfig.DISCONNECT_KEY_MISMATCH);
          await this.audioEngine.transmitSinglePacket(nack);
        }, 0);
        this.updateState({ status: 'error', error: 'Encryption key mismatch' });
        return;
      }

      this.peerSalt = payload.sessionSalt;

      // Set up combined salt for encryption
      // Responder uses: initiator's salt (from CONNECT) XOR our salt
      this.crypto.setCombinedSalt(this.peerSalt, this.localSalt);

      // Send CONNECT_ACK
      setTimeout(async () => {
        const ack = createConnectAckPacket(
          ProtocolConfig.PROTOCOL_VERSION,
          this.crypto.getCapabilities(),
          this.localSalt,
          this.crypto.getKeyHash()
        );
        await this.audioEngine.transmitSinglePacket(ack);
      }, 0);

      this.updateState({
        status: 'connected',
        peerConnected: true,
        encryptionActive: this.crypto.isEnabled(),
      });
    } catch {
      this.updateState({ status: 'error', error: 'Invalid CONNECT packet' });
    }
  }

  private onConnectAck(packet: Packet): void {
    if (this.state.status !== 'connecting') return;

    this.clearTimer('connect');

    try {
      const payload = parseConnectPayload(packet.data);

      // Verify key hash
      if (this.crypto.isEnabled() && !this.crypto.verifyKeyHash(payload.keyHash)) {
        this.updateState({ status: 'error', error: 'Encryption key mismatch' });
        this.audioEngine.stopReceiving();
        return;
      }

      this.peerSalt = payload.sessionSalt;

      // Initiator uses: our salt XOR responder's salt
      this.crypto.setCombinedSalt(this.localSalt, this.peerSalt);

      this.updateState({
        status: 'connected',
        peerConnected: true,
        encryptionActive: this.crypto.isEnabled(),
      });
    } catch {
      this.updateState({ status: 'error', error: 'Invalid CONNECT_ACK packet' });
    }
  }

  private onAck(packet: Packet): void {
    if (this.state.status !== 'sending') return;

    try {
      const _payload = parseAckPayload(packet.data);
      // ACK received - resolve the pending send promise
      this.clearTimer('ack');
      if (this.sendResolve) {
        const resolve = this.sendResolve;
        this.sendResolve = undefined;
        resolve(true);
      }
    } catch {
      // Invalid ACK, ignore
    }
  }

  private onNack(packet: Packet): void {
    if (this.state.status !== 'sending') return;

    try {
      const payload = parseNackPayload(packet.data);
      console.warn(`[Digi2FM] NACK received for seq ${payload.nackedSeqNo}, reason: ${payload.reason}`);
      // NACK triggers retransmit - the ACK timeout will handle it
      // But clear the timer to retransmit sooner
      this.clearTimer('ack');
      if (this.sendResolve) {
        this.sendRetries++;
        if (this.sendRetries >= ProtocolConfig.MAX_RETRIES) {
          const resolve = this.sendResolve;
          this.sendResolve = undefined;
          resolve(false);
        }
        // Otherwise, the ARQ loop will retry
      }
    } catch {
      // Invalid NACK
    }
  }

  private onFileHeader(packet: Packet): void {
    if (this.state.status !== 'connected') return;

    try {
      this.fileHeader = parseFileHeader(packet.data);
      this.receivedChunks.clear();

      this.updateState({
        status: 'receiving',
        fileName: this.fileHeader.fileName,
        fileSize: this.fileHeader.fileSize,
        totalPackets: this.fileHeader.totalChunks + 2,
        currentPacket: 1,
        transferProgress: 0,
      });

      // Send ACK for header
      setTimeout(async () => {
        const ack = createAckPacket(packet.header.seqNo);
        await this.audioEngine.transmitSinglePacket(ack);
      }, 0);
    } catch {
      // Send NACK
      setTimeout(async () => {
        const nack = createNackPacket(packet.header.seqNo, ProtocolConfig.NACK_CRC_FAILURE);
        await this.audioEngine.transmitSinglePacket(nack);
      }, 0);
    }
  }

  private onData(packet: Packet): void {
    if (this.state.status !== 'receiving' || !this.fileHeader) return;

    const seqNo = packet.header.seqNo;

    // Check for duplicate
    if (this.receivedChunks.has(seqNo)) {
      // Re-ACK duplicate
      setTimeout(async () => {
        const ack = createAckPacket(seqNo);
        await this.audioEngine.transmitSinglePacket(ack);
      }, 0);
      return;
    }

    // Decrypt if needed
    let data = packet.data;
    if (this.crypto.isEnabled()) {
      const decrypted = this.crypto.decrypt(packet.data, seqNo);
      if (!decrypted) {
        // Decryption failed
        setTimeout(async () => {
          const nack = createNackPacket(seqNo, ProtocolConfig.NACK_DECRYPT_FAILURE);
          await this.audioEngine.transmitSinglePacket(nack);
        }, 0);
        return;
      }
      data = decrypted;
    }

    this.receivedChunks.set(seqNo, data);

    const progress = this.receivedChunks.size / this.fileHeader.totalChunks;
    this.updateState({
      currentPacket: this.receivedChunks.size + 1,
      transferProgress: progress,
    });

    // Send ACK
    setTimeout(async () => {
      const ack = createAckPacket(seqNo);
      await this.audioEngine.transmitSinglePacket(ack);
    }, 0);
  }

  private onEof(packet: Packet): void {
    if (this.state.status !== 'receiving' || !this.fileHeader) return;

    // Send ACK for EOF
    setTimeout(async () => {
      const ack = createAckPacket(packet.header.seqNo);
      await this.audioEngine.transmitSinglePacket(ack);

      // Finish receiving
      await this.finishReceive();
    }, 0);
  }

  private onDisconnect(): void {
    this.clearAllTimers();
    this.audioEngine.stopReceiving();
    this.crypto.reset();

    const history = this.state.transferHistory;
    this.state = this.defaultState();
    this.state.transferHistory = history;
    this.updateState({ status: 'idle', error: 'Peer disconnected' });
  }

  // ============ RECEIVE FINISH ============

  private async finishReceive(): Promise<void> {
    if (!this.fileHeader) return;

    this.updateState({ status: 'receiving' });

    const data = reassembleChunks(
      this.receivedChunks,
      this.fileHeader.totalChunks,
      this.fileHeader.fileSize
    );

    if (!data) {
      const missing: number[] = [];
      for (let i = 1; i <= this.fileHeader.totalChunks; i++) {
        if (!this.receivedChunks.has(i)) missing.push(i);
      }
      this.addHistory('received', this.fileHeader.fileName, this.fileHeader.fileSize, false);
      this.updateState({
        status: 'connected',
        error: `Missing ${missing.length} chunks`,
      });
      return;
    }

    try {
      const filePath = await saveFile(data, this.fileHeader.fileName);
      this.addHistory('received', this.fileHeader.fileName, this.fileHeader.fileSize, true);
      this.updateState({ status: 'connected', transferProgress: 1 });
      this.onFileReceived?.(filePath);
    } catch (err: any) {
      this.addHistory('received', this.fileHeader.fileName, this.fileHeader.fileSize, false);
      this.updateState({
        status: 'connected',
        error: err.message || 'Failed to save file',
      });
    }

    this.receivedChunks.clear();
    this.fileHeader = null;
  }

  // ============ HELPERS ============

  private addHistory(direction: 'sent' | 'received', fileName: string, fileSize: number, success: boolean) {
    const entry: TransferHistoryEntry = {
      direction, fileName, fileSize, success,
      timestamp: Date.now(),
    };
    this.state.transferHistory = [...this.state.transferHistory, entry];
  }

  private clearTimer(type: 'ack' | 'connect') {
    if (type === 'ack' && this.ackTimeoutId) {
      clearTimeout(this.ackTimeoutId);
      this.ackTimeoutId = undefined;
    }
    if (type === 'connect' && this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = undefined;
    }
  }

  private clearAllTimers() {
    this.clearTimer('ack');
    this.clearTimer('connect');
  }

  private updateState(partial: Partial<SessionState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.({ ...this.state });
  }

  stop() {
    this.clearAllTimers();
    this.audioEngine.stopTransmitting();
    this.audioEngine.stopReceiving();
    this.crypto.reset();
  }
}
