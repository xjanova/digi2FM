import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * Detects the sync word (0x7E7E) in an incoming bit stream
 * using a sliding window approach.
 */
export class SyncDetector {
  private buffer: number = 0; // 16-bit sliding window
  private bitsReceived: number = 0;
  private synced: boolean = false;

  reset() {
    this.buffer = 0;
    this.bitsReceived = 0;
    this.synced = false;
  }

  isSynced(): boolean {
    return this.synced;
  }

  /**
   * Feed a single bit into the detector.
   * Returns true when sync word is detected.
   */
  feedBit(bit: number): boolean {
    if (this.synced) return true;

    // Shift in the new bit
    this.buffer = ((this.buffer << 1) | (bit & 1)) & 0xFFFF;
    this.bitsReceived++;

    // Need at least 16 bits before checking
    if (this.bitsReceived >= 16 && this.buffer === ProtocolConfig.SYNC_WORD) {
      this.synced = true;
      return true;
    }

    return false;
  }

  /**
   * Feed multiple bits. Returns the index where sync was detected, or -1.
   */
  feedBits(bits: number[]): number {
    for (let i = 0; i < bits.length; i++) {
      if (this.feedBit(bits[i])) {
        return i;
      }
    }
    return -1;
  }
}
