import { AudioRecorder } from 'react-native-audio-api';
import { ProtocolConfig } from '../constants/ProtocolConfig';
import { debugLog } from '../utils/DebugLog';

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
 *
 * Sample-rate handling: we request ProtocolConfig.SAMPLE_RATE but the
 * device may deliver buffers at a different rate (the API docs warn about
 * this). The Goertzel demodulator is tuned to a fixed rate, so a
 * mismatch silently breaks frequency detection. We linearly resample any
 * mismatched buffer back to the expected rate. FSK at 1200/2200Hz is
 * massively oversampled relative to typical mic rates (44.1k/48k), so
 * linear interpolation introduces no audible artifacts in the band of
 * interest.
 */
export class MicCapture {
  private recorder: AudioRecorder | null = null;
  private onSamples?: MicSamplesCallback;
  private onError?: MicErrorCallback;
  private active = false;
  private srcSampleRate: number = ProtocolConfig.SAMPLE_RATE;
  private needsResample: boolean = false;

  start(onSamples: MicSamplesCallback, onError?: MicErrorCallback): void {
    if (this.active) return;
    this.onSamples = onSamples;
    this.onError = onError;
    this.srcSampleRate = ProtocolConfig.SAMPLE_RATE;
    this.needsResample = false;

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
        try {
          if (!rateChecked) {
            rateChecked = true;
            const actual = event.buffer.sampleRate;
            if (actual && actual !== ProtocolConfig.SAMPLE_RATE) {
              this.srcSampleRate = actual;
              this.needsResample = true;
              debugLog(
                `[Digi2FM] Mic delivers ${actual}Hz, resampling to ${ProtocolConfig.SAMPLE_RATE}Hz`
              );
            }
          }

          const raw = event.buffer.getChannelData(0);
          // The native buffer is backed by shared memory; resample (which
          // allocates) or copy so subsequent native writes can't mutate
          // our snapshot.
          const samples = this.needsResample
            ? resampleLinear(raw, this.srcSampleRate, ProtocolConfig.SAMPLE_RATE)
            : new Float32Array(raw);
          this.onSamples?.(samples);
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

/**
 * Linear resampler. Good enough for FSK tones (1200/2200 Hz) which sit
 * far below the Nyquist limit of every realistic mic rate.
 */
function resampleLinear(
  input: Float32Array,
  srcRate: number,
  dstRate: number
): Float32Array {
  if (srcRate === dstRate || input.length === 0) {
    return new Float32Array(input);
  }
  const ratio = srcRate / dstRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  const lastSrcIdx = input.length - 1;
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = i0 + 1 <= lastSrcIdx ? i0 + 1 : lastSrcIdx;
    const t = srcIdx - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}
