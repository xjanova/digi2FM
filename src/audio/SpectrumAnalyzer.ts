import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Goertzel algorithm - efficiently compute energy at a specific frequency
 * within a block of samples. Much faster than FFT when you only need 1-2 frequencies.
 */
export function goertzel(
  samples: Float32Array,
  targetFreq: number,
  sampleRate: number,
  startIndex: number = 0,
  blockSize?: number
): number {
  const N = blockSize ?? samples.length - startIndex;
  // Use exact target frequency instead of rounding to nearest bin
  // to avoid frequency detection errors at short block sizes
  const w = (2 * Math.PI * targetFreq) / sampleRate;
  const coeff = 2 * Math.cos(w);

  let s1 = 0;
  let s2 = 0;

  for (let i = 0; i < N; i++) {
    const s0 = samples[startIndex + i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  // Power (magnitude squared)
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return power / (N * N); // Normalize
}

/**
 * Detect whether a block of samples contains mark (1) or space (0) frequency.
 * Returns: { bit, markEnergy, spaceEnergy, signalPresent }
 */
export function detectBit(
  samples: Float32Array,
  startIndex: number,
  blockSize: number,
  sampleRate: number = ProtocolConfig.SAMPLE_RATE,
  markFreq: number = ProtocolConfig.MARK_FREQ,
  spaceFreq: number = ProtocolConfig.SPACE_FREQ,
  threshold: number = ProtocolConfig.GOERTZEL_THRESHOLD
): { bit: number; markEnergy: number; spaceEnergy: number; signalPresent: boolean } {
  const markEnergy = goertzel(samples, markFreq, sampleRate, startIndex, blockSize);
  const spaceEnergy = goertzel(samples, spaceFreq, sampleRate, startIndex, blockSize);

  const maxEnergy = Math.max(markEnergy, spaceEnergy);
  const signalPresent = maxEnergy > threshold;
  const bit = markEnergy > spaceEnergy ? 1 : 0;

  return { bit, markEnergy, spaceEnergy, signalPresent };
}

/**
 * Detect bits from a continuous audio stream.
 * Processes one bit-period at a time.
 */
export function detectBitsFromSamples(
  samples: Float32Array,
  samplesPerBit: number,
  sampleRate: number = ProtocolConfig.SAMPLE_RATE,
  markFreq: number = ProtocolConfig.MARK_FREQ,
  spaceFreq: number = ProtocolConfig.SPACE_FREQ
): { bits: number[]; energies: Array<{ mark: number; space: number }> } {
  const bits: number[] = [];
  const energies: Array<{ mark: number; space: number }> = [];
  const totalBits = Math.floor(samples.length / samplesPerBit);

  for (let i = 0; i < totalBits; i++) {
    const startIndex = i * samplesPerBit;
    const result = detectBit(samples, startIndex, samplesPerBit, sampleRate, markFreq, spaceFreq);
    bits.push(result.bit);
    energies.push({ mark: result.markEnergy, space: result.spaceEnergy });
  }

  return { bits, energies };
}
