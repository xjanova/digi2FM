import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Generate PCM samples for a sine wave at a given frequency.
 * Maintains phase continuity via currentPhase parameter.
 */
export function generateToneSamples(
  frequency: number,
  durationSamples: number,
  sampleRate: number,
  startPhase: number = 0,
  amplitude: number = 0.8
): { samples: Float32Array; endPhase: number } {
  const samples = new Float32Array(durationSamples);
  const phaseIncrement = (2 * Math.PI * frequency) / sampleRate;
  let phase = startPhase;

  for (let i = 0; i < durationSamples; i++) {
    samples[i] = amplitude * Math.sin(phase);
    phase += phaseIncrement;
    // Keep phase in [0, 2*PI] to avoid floating point drift
    if (phase >= 2 * Math.PI) {
      phase -= 2 * Math.PI;
    }
  }

  return { samples, endPhase: phase };
}

/**
 * Generate silence (zeros)
 */
export function generateSilence(durationSamples: number): Float32Array {
  return new Float32Array(durationSamples);
}

/**
 * Generate silence for a given duration in milliseconds
 */
export function generateSilenceMs(durationMs: number, sampleRate: number): Float32Array {
  const samples = Math.round((durationMs / 1000) * sampleRate);
  return generateSilence(samples);
}
