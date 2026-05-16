import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { MicCapture } from '../audio/MicCapture';
import { SessionManager } from '../protocol/SessionManager';
import { CryptoEngine } from '../crypto/CryptoEngine';
import { SessionState, AppSettings, SelectedFile } from '../types';
import { setupAudioMode } from '../utils/PermissionUtils';

export function useSession(settings: AppSettings) {
  const [state, setState] = useState<SessionState>({
    status: 'idle',
    peerConnected: false,
    encryptionActive: false,
    transferProgress: 0,
    currentPacket: 0,
    totalPackets: 0,
    transferHistory: [],
  });
  const [receivedFilePath, setReceivedFilePath] = useState<string | null>(null);

  const engineRef = useRef<AudioEngine | null>(null);
  const sessionRef = useRef<SessionManager | null>(null);
  const cryptoRef = useRef<CryptoEngine | null>(null);
  const micRef = useRef<MicCapture | null>(null);

  // Rebuild engine + crypto when settings change
  const getEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.dispose();
    }
    engineRef.current = new AudioEngine(
      settings.baudRate,
      settings.markFreq,
      settings.spaceFreq,
      settings.errorCorrection
    );
    return engineRef.current;
  }, [settings.baudRate, settings.markFreq, settings.spaceFreq, settings.errorCorrection]);

  const getCrypto = useCallback(() => {
    if (!cryptoRef.current) {
      cryptoRef.current = new CryptoEngine();
    }
    const crypto = cryptoRef.current;
    if (settings.encryptionEnabled && settings.encryptionPassphrase) {
      crypto.deriveKey(settings.encryptionPassphrase);
    } else {
      crypto.dispose();
    }
    return crypto;
  }, [settings.encryptionEnabled, settings.encryptionPassphrase]);

  const getSession = useCallback(() => {
    const engine = getEngine();
    const crypto = getCrypto();
    const session = new SessionManager(engine, crypto);
    sessionRef.current = session;
    session.setOnStateChange(setState);
    session.setOnFileReceived((path) => setReceivedFilePath(path));
    return { session, engine };
  }, [getEngine, getCrypto]);

  const stopRecordingLoop = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
  }, []);

  const startRecordingLoop = useCallback(async (engine: AudioEngine) => {
    try {
      await setupAudioMode();
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err?.message || 'Failed to configure audio session',
      }));
      throw err;
    }

    stopRecordingLoop();

    try {
      const mic = new MicCapture();
      micRef.current = mic;
      mic.start(
        (samples) => engine.feedSamples(samples),
        (message) => {
          setState((prev) => ({ ...prev, status: 'error', error: message }));
        }
      );
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err?.message || 'Failed to start microphone',
      }));
      throw err;
    }
  }, [stopRecordingLoop]);

  // ============ PUBLIC API ============

  const connect = useCallback(async () => {
    const { session, engine } = getSession();
    await startRecordingLoop(engine);
    await session.initiateConnection();
  }, [getSession, startRecordingLoop]);

  const listen = useCallback(async () => {
    const { session, engine } = getSession();
    await startRecordingLoop(engine);
    session.listenForConnection();
  }, [getSession, startRecordingLoop]);

  const sendFile = useCallback(async (file: SelectedFile) => {
    if (!sessionRef.current) return;
    await sessionRef.current.sendFile(file);
  }, []);

  const disconnect = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.disconnect();
    }
    stopRecordingLoop();
  }, [stopRecordingLoop]);

  const cleanup = useCallback(async () => {
    await disconnect();
    engineRef.current?.dispose();
    engineRef.current = null;
    cryptoRef.current?.dispose();
    cryptoRef.current = null;
  }, [disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micRef.current?.stop();
      micRef.current = null;
      engineRef.current?.dispose();
      cryptoRef.current?.dispose();
    };
  }, []);

  return {
    state,
    receivedFilePath,
    connect,
    listen,
    sendFile,
    disconnect,
    cleanup,
  };
}
