import nacl from 'tweetnacl';
import { ProtocolConfig } from '../constants/ProtocolConfig';

/**
 * CryptoEngine - Handles encryption/decryption using XSalsa20-Poly1305 (tweetnacl)
 *
 * Key derivation: Iterated SHA-512 from passphrase
 * Nonce: combinedSalt(16B) + seqNo(8B) = 24B
 * Encryption: nacl.secretbox (XSalsa20-Poly1305, adds 16B auth tag)
 */
export class CryptoEngine {
  private key: Uint8Array | null = null;
  private keyHash: Uint8Array | null = null;
  private combinedSalt: Uint8Array | null = null;
  private _enabled: boolean = false;

  private lastPassphrase: string = '';

  /**
   * Derive a 32-byte key from passphrase using iterated SHA-512.
   * Caches the result - only re-derives if passphrase changes.
   * Uses 100 iterations (sufficient for acoustic channel threat model).
   */
  deriveKey(passphrase: string): void {
    if (!passphrase) {
      this.key = null;
      this.keyHash = null;
      this._enabled = false;
      this.lastPassphrase = '';
      return;
    }

    // Skip re-derivation if passphrase hasn't changed
    if (passphrase === this.lastPassphrase && this.key) {
      this._enabled = true;
      return;
    }

    this.lastPassphrase = passphrase;

    // Convert passphrase to bytes
    const encoder = new TextEncoder();
    let data: Uint8Array = new Uint8Array(encoder.encode(passphrase + 'digi2fm-key-v1'));

    // Iterate SHA-512 - fast enough to not freeze UI,
    // sufficient security for acoustic channel with limited brute-force surface
    for (let i = 0; i < ProtocolConfig.KDF_ITERATIONS; i++) {
      data = new Uint8Array(nacl.hash(data));
    }

    // Take first 32 bytes as key
    this.key = new Uint8Array(data.subarray(0, 32));

    // Key hash for verification: SHA-512(key), take first 8 bytes
    this.keyHash = new Uint8Array(nacl.hash(this.key).subarray(0, ProtocolConfig.KEY_HASH_LENGTH));
    this._enabled = true;
  }

  /**
   * Get the key hash (8 bytes) for CONNECT packet verification.
   */
  getKeyHash(): Uint8Array {
    if (!this.keyHash) {
      return new Uint8Array(ProtocolConfig.KEY_HASH_LENGTH);
    }
    return new Uint8Array(this.keyHash);
  }

  /**
   * Verify that a peer's key hash matches ours.
   */
  verifyKeyHash(peerKeyHash: Uint8Array): boolean {
    if (!this._enabled) {
      // If encryption disabled, any key hash is accepted
      // (peer's zero hash matches our zero hash)
      return true;
    }
    if (!this.keyHash) return false;

    if (peerKeyHash.length !== this.keyHash.length) return false;
    let equal = true;
    for (let i = 0; i < this.keyHash.length; i++) {
      if (peerKeyHash[i] !== this.keyHash[i]) equal = false;
    }
    return equal;
  }

  /**
   * Generate a random 16-byte session salt.
   */
  generateSessionSalt(): Uint8Array {
    return nacl.randomBytes(ProtocolConfig.SESSION_SALT_LENGTH);
  }

  /**
   * Set the combined salt from both sides' session salts.
   * combinedSalt = initiatorSalt XOR responderSalt
   */
  setCombinedSalt(initiatorSalt: Uint8Array, responderSalt: Uint8Array): void {
    this.combinedSalt = new Uint8Array(ProtocolConfig.SESSION_SALT_LENGTH);
    for (let i = 0; i < ProtocolConfig.SESSION_SALT_LENGTH; i++) {
      this.combinedSalt[i] = initiatorSalt[i] ^ responderSalt[i];
    }
  }

  /**
   * Build a 24-byte nonce from combined salt + sequence number.
   * nonce = combinedSalt(16B) + seqNo(8B, big-endian zero-padded)
   */
  private buildNonce(seqNo: number): Uint8Array {
    const nonce = new Uint8Array(ProtocolConfig.NONCE_LENGTH);
    if (this.combinedSalt) {
      nonce.set(this.combinedSalt, 0);
    }
    // Write seqNo as big-endian in last 8 bytes (only use last 2 bytes for 16-bit seqNo)
    nonce[22] = (seqNo >> 8) & 0xFF;
    nonce[23] = seqNo & 0xFF;
    return nonce;
  }

  /**
   * Encrypt plaintext data for a given sequence number.
   * Returns ciphertext with 16-byte Poly1305 auth tag prepended.
   */
  encrypt(plaintext: Uint8Array, seqNo: number): Uint8Array {
    if (!this._enabled || !this.key) {
      return plaintext; // No encryption
    }
    const nonce = this.buildNonce(seqNo);
    return nacl.secretbox(plaintext, nonce, this.key);
  }

  /**
   * Decrypt ciphertext for a given sequence number.
   * Returns null if decryption/authentication fails.
   */
  decrypt(ciphertext: Uint8Array, seqNo: number): Uint8Array | null {
    if (!this._enabled || !this.key) {
      return ciphertext; // No encryption
    }
    const nonce = this.buildNonce(seqNo);
    return nacl.secretbox.open(ciphertext, nonce, this.key);
  }

  isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Build capabilities byte based on encryption state.
   */
  getCapabilities(): number {
    let caps = 0;
    if (this._enabled) {
      caps |= ProtocolConfig.CAP_ENCRYPTION_SUPPORTED;
      caps |= ProtocolConfig.CAP_ENCRYPTION_REQUIRED;
    }
    return caps;
  }

  reset(): void {
    this.combinedSalt = null;
    // Keep key and keyHash (derived from passphrase, stays the same)
  }

  dispose(): void {
    this.key = null;
    this.keyHash = null;
    this.combinedSalt = null;
    this._enabled = false;
  }
}
