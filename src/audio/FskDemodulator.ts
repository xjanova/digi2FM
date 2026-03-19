import { ProtocolConfig } from '../constants/ProtocolConfig';
import { detectBit } from './SpectrumAnalyzer';
import { SyncDetector } from '../protocol/SyncDetector';
import { bitsToBytes } from '../codec/BinaryDecoder';
import { parsePacket } from '../protocol/PacketParser';
import { decodeBits } from '../codec/ErrorCorrection';
import { Packet, ErrorCorrectionMode } from '../types';

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
  private errorCorrection: ErrorCorrectionMode = 'none';

  private nominalSamplesPerBit: number;

  // Callbacks
  private onPacket?: DemodulatorCallback;
  private onSignal?: SignalCallback;

  constructor(
    baudRate: number = ProtocolConfig.DEFAULT_BAUD_RATE,
    markFreq: number = ProtocolConfig.MARK_FREQ,
    spaceFreq: number = ProtocolConfig.SPACE_FREQ,
    sampleRate: number = ProtocolConfig.SAMPLE_RATE,
    errorCorrection: ErrorCorrectionMode = 'none'
  ) {
    this.sampleRate = sampleRate;
    this.baudRate = baudRate;
    this.markFreq = markFreq;
    this.spaceFreq = spaceFreq;
    this.samplesPerBit = Math.round(sampleRate / baudRate);
    this.errorCorrection = errorCorrection;
    this.nominalSamplesPerBit = this.samplesPerBit;
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

  /**
   * Calculate how many raw (error-corrected-encoded) bits are needed
   * for a given number of UART bits.
   */
  private rawBitsNeeded(uartBits: number): number {
    switch (this.errorCorrection) {
      case 'repetition':
        return uartBits * ProtocolConfig.REPETITION_FACTOR; // 3x
      case 'hamming':
        // Hamming(7,4) encodes 4 bits -> 7 bits.
        // For N UART bits, we need ceil(N/4)*7 raw bits.
        return Math.ceil(uartBits / 4) * 7;
      default:
        return uartBits;
    }
  }

  /**
   * Skip one byte's worth of raw bits (accounting for error correction).
   */
  private skipOneByte(): number {
    return this.rawBitsNeeded(ProtocolConfig.BITS_PER_BYTE);
  }

  private tryParsePacket() {
    // First, decode all received bits to peek at the length field.
    // We need at least 2 UART bytes (20 UART bits) worth of raw bits.
    const minRawBits = this.rawBitsNeeded(20); // 2 bytes * 10 bits/byte
    if (this.receivedBits.length < minRawBits) return;

    // Trial decode to read the length field
    const correctedBits = decodeBits(this.receivedBits, this.errorCorrection);
    const bytes = bitsToBytes(correctedBits);
    if (bytes.length < 2) return;

    // Read expected length from first 2 bytes
    const expectedLen = (bytes[0] << 8) | bytes[1];
    if (expectedLen < 7 || expectedLen > 256) {
      // Invalid length - skip one byte worth of RAW bits
      const skip = this.skipOneByte();
      this.receivedBits = this.receivedBits.slice(skip);
      if (this.receivedBits.length < 10) {
        this.resetSync();
      }
      return;
    }

    // Calculate how many RAW bits we need for the full packet
    const uartBitsNeeded = expectedLen * ProtocolConfig.BITS_PER_BYTE;
    const rawBitsForPacket = this.rawBitsNeeded(uartBitsNeeded);

    if (this.receivedBits.length < rawBitsForPacket) return; // Wait for more bits

    // Extract exactly the raw bits needed, decode, and parse
    const packetRawBits = this.receivedBits.slice(0, rawBitsForPacket);
    const decodedBits = decodeBits(packetRawBits, this.errorCorrection);
    const packetBytes = bitsToBytes(decodedBits);

    const packet = parsePacket(new Uint8Array(packetBytes.subarray(0, expectedLen)));
    if (packet) {
      this.packetsReceived++;
      this.onPacket?.(packet);
    } else {
      console.warn('[Digi2FM] Packet CRC error or parse failure, dropping packet');
    }

    // Keep remaining raw bits (may contain start of next preamble)
    const remainingBits = this.receivedBits.slice(rawBitsForPacket);
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
    this.samplesPerBit = this.nominalSamplesPerBit;
  }

  /**
   * Flush the sample buffer without resetting sync state.
   * Used after transmitting to discard echo samples.
   */
  flushBuffer() {
    this.bufferReadPos = this.bufferWritePos;
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
