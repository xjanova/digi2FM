import { AudioContext, AudioBufferSourceNode } from 'react-native-audio-api';
import { ProtocolConfig } from '../constants/ProtocolConfig';
import { FskModulator } from './FskModulator';
import { FskDemodulator } from './FskDemodulator';
import { Packet, ErrorCorrectionMode } from '../types';

type OnPacketCallback = (packet: Packet) => void;
type OnSignalCallback = (detected: boolean, markEnergy: number, spaceEnergy: number) => void;
type OnProgressCallback = (packetIndex: number) => void;

/**
 * AudioEngine - high-level abstraction over react-native-audio-api
 * Handles transmitting FSK audio and receiving/demodulating from microphone.
 *
 * Transmit: Uses AudioBufferSourceNode with PCM samples from FskModulator.
 * Receive: Demodulator callbacks are set here; actual mic recording is
 *          managed externally (e.g. in useReceiver) because expo-av
 *          provides the recording interface. Call feedSamples() to push
 *          captured audio into the demodulator.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private modulator: FskModulator;
  private demodulator: FskDemodulator;
  private isTransmitting: boolean = false;
  private isReceiving: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;

  private baudRate: number;
  private markFreq: number;
  private spaceFreq: number;

  constructor(
    baudRate: number = ProtocolConfig.DEFAULT_BAUD_RATE,
    markFreq: number = ProtocolConfig.MARK_FREQ,
    spaceFreq: number = ProtocolConfig.SPACE_FREQ,
    errorCorrection: ErrorCorrectionMode = 'none'
  ) {
    this.baudRate = baudRate;
    this.markFreq = markFreq;
    this.spaceFreq = spaceFreq;
    this.modulator = new FskModulator(baudRate, markFreq, spaceFreq, ProtocolConfig.SAMPLE_RATE, errorCorrection);
    this.demodulator = new FskDemodulator(baudRate, markFreq, spaceFreq, ProtocolConfig.SAMPLE_RATE, errorCorrection);
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    // Resume if suspended (required on some platforms after user gesture)
    if ((this.audioContext as any).state === 'suspended') {
      (this.audioContext as any).resume?.();
    }
    return this.audioContext;
  }

  /**
   * Transmit packets as FSK audio through the speaker.
   * Uses AudioBufferSourceNode with PCM samples from FskModulator
   * to guarantee phase-continuous output that matches the demodulator.
   */
  async transmitPackets(
    packets: Uint8Array[],
    onProgress?: OnProgressCallback
  ): Promise<void> {
    const ctx = this.ensureContext();
    this.isTransmitting = true;
    this.modulator.reset();

    try {
      for (let i = 0; i < packets.length; i++) {
        if (!this.isTransmitting) break;

        await this.playPcmSamples(ctx, this.modulator.modulatePacket(packets[i]));
        onProgress?.(i);

        // Inter-packet gap
        if (i < packets.length - 1 && this.isTransmitting) {
          await this.sleep(ProtocolConfig.INTER_PACKET_GAP_MS);
          this.modulator.reset(); // Reset phase after silence gap
        }
      }
    } finally {
      this.isTransmitting = false;
      this.currentSource = null;
    }
  }

  /**
   * Play pre-computed PCM Float32 samples through the speaker.
   * Returns a promise that resolves when playback completes.
   */
  private playPcmSamples(ctx: AudioContext, samples: Float32Array): Promise<void> {
    return new Promise((resolve) => {
      const buffer = ctx.createBuffer(1, samples.length, ProtocolConfig.SAMPLE_RATE);
      const channelData = buffer.getChannelData(0);
      channelData.set(samples);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      this.currentSource = source;

      const durationMs = (samples.length / ProtocolConfig.SAMPLE_RATE) * 1000;
      source.start();

      // Wait for playback to finish (duration + small margin)
      setTimeout(() => {
        resolve();
      }, durationMs + 50);
    });
  }

  /**
   * Set up demodulator callbacks for receiving.
   * Actual mic recording must be started externally; call feedSamples()
   * with captured PCM data.
   */
  startReceiving(
    onPacket: OnPacketCallback,
    onSignal?: OnSignalCallback
  ): void {
    this.isReceiving = true;
    this.demodulator.reset();
    this.demodulator.setOnPacket(onPacket);
    if (onSignal) {
      this.demodulator.setOnSignal(onSignal);
    }
  }

  /**
   * Feed raw PCM samples into the demodulator.
   * Called from the mic recording loop.
   */
  feedSamples(samples: Float32Array) {
    if (!this.isReceiving) return;
    this.demodulator.processSamples(samples);
  }

  /**
   * Transmit a single packet (for control packets like ACK, CONNECT).
   * Pauses demodulator during transmit to prevent self-echo, then flushes
   * the demodulator buffer and resumes after turnaround delay.
   */
  async transmitSinglePacket(packetBytes: Uint8Array): Promise<void> {
    const ctx = this.ensureContext();

    // Pause receiving to prevent self-echo contamination
    const wasReceiving = this.isReceiving;
    this.isReceiving = false;
    this.isTransmitting = true;
    this.modulator.reset();

    try {
      await this.playPcmSamples(ctx, this.modulator.modulatePacket(packetBytes));
      // Turnaround delay - let speaker echo settle before mic picks up
      await this.sleep(ProtocolConfig.TURNAROUND_DELAY_MS);
    } finally {
      this.isTransmitting = false;
      this.currentSource = null;
      // Flush demodulator buffer to discard any echo samples captured during TX
      if (wasReceiving) {
        this.demodulator.flushBuffer();
        this.isReceiving = true;
      }
    }
  }

  stopTransmitting() {
    this.isTransmitting = false;
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }
  }

  stopReceiving() {
    this.isReceiving = false;
    this.demodulator.reset();
  }

  dispose() {
    this.stopTransmitting();
    this.stopReceiving();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  getIsTransmitting(): boolean {
    return this.isTransmitting;
  }

  getIsReceiving(): boolean {
    return this.isReceiving;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
