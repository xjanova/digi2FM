import { ProtocolConfig } from '../constants/ProtocolConfig';
import { generateToneSamples, generateSilenceMs } from './ToneGenerator';
import { bytesToBits } from '../codec/BinaryEncoder';
import { generatePreamble } from '../protocol/PacketFramer';

/**
 * FSK Modulator - converts bit streams to audio samples
 * Uses Bell 202 standard: Mark (1) = 1200Hz, Space (0) = 2200Hz
 */
export class FskModulator {
  private sampleRate: number;
  private baudRate: number;
  private markFreq: number;
  private spaceFreq: number;
  private samplesPerBit: number;
  private phase: number = 0;

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
  }

  /**
   * Modulate a bit array into PCM audio samples
   */
  modulateBits(bits: number[]): Float32Array {
    const totalSamples = bits.length * this.samplesPerBit;
    const output = new Float32Array(totalSamples);
    let outputIndex = 0;

    for (const bit of bits) {
      const freq = bit === 1 ? this.markFreq : this.spaceFreq;
      const { samples, endPhase } = generateToneSamples(
        freq,
        this.samplesPerBit,
        this.sampleRate,
        this.phase
      );
      this.phase = endPhase;
      output.set(samples, outputIndex);
      outputIndex += this.samplesPerBit;
    }

    return output;
  }

  /**
   * Modulate a complete packet (bytes) with preamble + UART framing
   */
  modulatePacket(packetBytes: Uint8Array): Float32Array {
    // Generate preamble bits (already raw, no UART framing needed)
    const preambleBits = generatePreamble();

    // Convert packet bytes to UART-framed bits
    const dataBits = bytesToBits(packetBytes);

    // Combine
    const allBits = [...preambleBits, ...dataBits];

    // Modulate
    return this.modulateBits(allBits);
  }

  /**
   * Generate inter-packet gap (silence)
   */
  generateGap(): Float32Array {
    this.phase = 0; // Reset phase after gap
    return generateSilenceMs(ProtocolConfig.INTER_PACKET_GAP_MS, this.sampleRate);
  }

  /**
   * Modulate multiple packets with gaps between them
   */
  modulatePackets(packets: Uint8Array[]): Float32Array {
    const segments: Float32Array[] = [];
    let totalLength = 0;

    for (let i = 0; i < packets.length; i++) {
      const audio = this.modulatePacket(packets[i]);
      segments.push(audio);
      totalLength += audio.length;

      if (i < packets.length - 1) {
        const gap = this.generateGap();
        segments.push(gap);
        totalLength += gap.length;
      }
    }

    // Concatenate all segments
    const output = new Float32Array(totalLength);
    let offset = 0;
    for (const seg of segments) {
      output.set(seg, offset);
      offset += seg.length;
    }

    return output;
  }

  /**
   * Reset modulator phase
   */
  reset() {
    this.phase = 0;
  }

  /**
   * Get the number of samples per bit at current baud rate
   */
  getSamplesPerBit(): number {
    return this.samplesPerBit;
  }
}
