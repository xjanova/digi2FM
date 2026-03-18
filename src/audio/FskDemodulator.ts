import { ProtocolConfig } from '../constants/ProtocolConfig';
import { detectBit } from './SpectrumAnalyzer';
import { SyncDetector } from '../protocol/SyncDetector';
import { bitsToBytes } from '../codec/BinaryDecoder';
import { parsePacket } from '../protocol/PacketParser';
import { Packet } from '../types';

export type DemodulatorCallback = (packet: Packet) => void;
export type SignalCallback = (detected: boolean, markEnergy: number, spaceEnergy: number) => void;

/**
 * FSK Demodulator - converts audio samples back to packets
 * Uses Goertzel algorithm to detect mark/space frequencies
 */
export class FskDemodulator {
  private sampleRate: number;
  private baudRate: number;
  private markFreq: number;
  private spaceFreq: number;
  private samplesPerBit: number;

  // Ring buffer for incoming samples
  private sampleBuffer: Float32Array;
  private bufferWritePos: number = 0;
  private bufferReadPos: number = 0;

  // State
  private syncDetector: SyncDetector;
  private receivedBits: number[] = [];
  private synced: boolean = false;
  private packetsReceived: number = 0;
  private silentBitCount: number = 0;

  // Callbacks
  private onPacket?: DemodulatorCallback;
  private onSignal?: SignalCallback;

  constructor(
    baudRate: number = ProtocolConfig.DEFAULT_BAUD_RATE,
    markFreq: number = ProtocolConfig.MARK_FREQ,
    spaceFreq: number = ProtocolConfig.SPACE_FREQ,
    sampleRate: number = ProtocolConfig.SAMPLE_RATE
  ) {
    this.sampleRate = sampleRate;
    this.baudRate = baudRate;
    this.markFreq = markFreq;
    this.spaceFreq = spaceFreq;
    this.samplesPerBit = Math.round(sampleRate / baudRate);
    this.syncDetector = new SyncDetector();

    // Ring buffer: 4 seconds of audio (enough headroom)
    this.sampleBuffer = new Float32Array(sampleRate * 4);
  }

  setOnPacket(callback: DemodulatorCallback) {
    this.onPacket = callback;
  }

  setOnSignal(callback: SignalCallback) {
    this.onSignal = callback;
  }

  /**
   * Feed audio samples into the demodulator.
   * Uses a ring buffer to avoid data loss from shifting.
   */
  processSamples(samples: Float32Array) {
    const bufLen = this.sampleBuffer.length;

    for (let i = 0; i < samples.length; i++) {
      this.sampleBuffer[this.bufferWritePos % bufLen] = samples[i];
      this.bufferWritePos++;
    }

    // Prevent integer overflow of positions by rebasing periodically
    if (this.bufferWritePos > bufLen * 100) {
      const rebase = this.bufferReadPos - (this.bufferReadPos % bufLen);
      this.bufferWritePos -= rebase;
      this.bufferReadPos -= rebase;
    }

    this.processBuffer();
  }

  private processBuffer() {
    const bufLen = this.sampleBuffer.length;

    while (this.bufferReadPos + this.samplesPerBit <= this.bufferWritePos) {
      // Extract one bit-period of samples into a contiguous array for Goertzel
      const block = new Float32Array(this.samplesPerBit);
      for (let i = 0; i < this.samplesPerBit; i++) {
        block[i] = this.sampleBuffer[(this.bufferReadPos + i) % bufLen];
      }
      this.bufferReadPos += this.samplesPerBit;

      const result = detectBit(
        block, 0, this.samplesPerBit,
        this.sampleRate, this.markFreq, this.spaceFreq
      );

      this.onSignal?.(result.signalPresent, result.markEnergy, result.spaceEnergy);

      if (!result.signalPresent) {
        this.silentBitCount++;
        // After prolonged silence, reset sync state
        if (this.synced && this.silentBitCount > 30) {
          this.resetSync();
        }
        continue;
      }
      this.silentBitCount = 0;

      if (!this.synced) {
        const found = this.syncDetector.feedBit(result.bit);
        if (found) {
          this.synced = true;
          this.receivedBits = [];
        }
      } else {
        this.receivedBits.push(result.bit);

        // Try to parse packet when we have enough bits for minimum packet
        if (this.receivedBits.length >= 70) {
          this.tryParsePacket();
        }

        // Safety: if we've accumulated too many bits without a valid packet, reset
        if (this.receivedBits.length > 3000) {
          this.resetSync();
        }
      }
    }
  }

  private tryParsePacket() {
    // Convert UART-framed bits to bytes
    const bytes = bitsToBytes(this.receivedBits);
    if (bytes.length < 2) return;

    // Read expected length from first 2 bytes
    const expectedLen = (bytes[0] << 8) | bytes[1];
    if (expectedLen < 7 || expectedLen > 256) {
      // Invalid length - skip one byte worth of bits and re-search for sync
      this.receivedBits = this.receivedBits.slice(ProtocolConfig.BITS_PER_BYTE);
      if (this.receivedBits.length < 10) {
        this.resetSync();
      }
      return;
    }

    // Check if we have enough bytes
    const bitsNeeded = expectedLen * ProtocolConfig.BITS_PER_BYTE;
    if (this.receivedBits.length < bitsNeeded) return;

    // Extract exactly the packet bytes
    const packetBits = this.receivedBits.slice(0, bitsNeeded);
    const packetBytes = bitsToBytes(packetBits);

    const packet = parsePacket(new Uint8Array(packetBytes.subarray(0, expectedLen)));
    if (packet) {
      this.packetsReceived++;
      this.onPacket?.(packet);
    }

    // Keep remaining bits (may contain start of next preamble)
    const remainingBits = this.receivedBits.slice(bitsNeeded);
    this.resetSync();

    // Feed remaining bits back into sync detector
    for (const bit of remainingBits) {
      if (this.syncDetector.feedBit(bit)) {
        this.synced = true;
        this.receivedBits = [];
        break;
      }
    }
  }

  private resetSync() {
    this.synced = false;
    this.receivedBits = [];
    this.syncDetector.reset();
  }

  reset() {
    this.resetSync();
    this.bufferWritePos = 0;
    this.bufferReadPos = 0;
    this.packetsReceived = 0;
    this.silentBitCount = 0;
  }

  getPacketsReceived(): number {
    return this.packetsReceived;
  }
}
