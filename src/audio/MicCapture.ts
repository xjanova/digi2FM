import { AudioRecorder } from 'react-native-audio-api';
import { ProtocolConfig } from '../constants/ProtocolConfig';

export type MicSamplesCallback = (samples: Float32Array) => void;
export type MicErrorCallback = (message: string) => void;

/**
 * MicCapture - thin wrapper over react-native-audio-api's AudioRecorder
 * that delivers raw PCM Float32 samples via callback.
 *
 * Why not expo-av: expo-av's recording produces compressed AAC/M4A files
 * on Android, which we can't decode in JS, so the demodulator never
 * receives audio samples. AudioRecorder.onAudioReady gives us raw PCM
 * directly on both platforms, bypassing the file-encoding step entirely.
 */
export class MicCapture {
  private recorder: AudioRecorder | null = null;
  private onSamples?: MicSamplesCallback;
  private onError?: MicErrorCallback;
  private active = false;

  start(onSamples: MicSamplesCallback, onError?: MicErrorCallback): void {
    if (this.active) return;
    this.onSamples = onSamples;
    this.onError = onError;

    const recorder = new AudioRecorder();
    this.recorder = recorder;
    let rateChecked = false;

    recorder.onError((event) => {
      this.onError?.(event?.message ?? 'Recorder error');
    });

    // Request raw PCM buffers at the configured sample rate. Buffer length
    // of ~4096 samples (~93ms at 44.1kHz) keeps latency low while giving
    // the Goertzel demodulator several bit-periods per callback.
    recorder.onAudioReady(
      {
        sampleRate: ProtocolConfig.SAMPLE_RATE,
        bufferLength: 4096,
        channelCount: 1,
      },
      (event) => {
        if (!this.active) return;
        if (!rateChecked) {
          rateChecked = true;
          const actual = event.buffer.sampleRate;
          if (actual !== ProtocolConfig.SAMPLE_RATE) {
            // The demodulator's Goertzel is tuned to ProtocolConfig.SAMPLE_RATE;
            // mismatched rates will shift detected frequencies and break decoding.
            this.onError?.(
              `Sample rate mismatch: device delivers ${actual}Hz, expected ${ProtocolConfig.SAMPLE_RATE}Hz`
            );
          }
        }
        try {
          const samples = event.buffer.getChannelData(0);
          // The native buffer is backed by shared memory; copy before handing
          // off so subsequent native writes can't mutate our snapshot.
          this.onSamples?.(new Float32Array(samples));
        } catch (err: any) {
          this.onError?.(err?.message ?? 'Failed to read mic buffer');
        }
      }
    );

    recorder.start();
    this.active = true;
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    try {
      this.recorder?.clearOnAudioReady();
      this.recorder?.clearOnError();
    } catch {
      /* no-op */
    }
    this.recorder = null;
    this.onSamples = undefined;
    this.onError = undefined;
  }

  isActive(): boolean {
    return this.active;
  }
}
