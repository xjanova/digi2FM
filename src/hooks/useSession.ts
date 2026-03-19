import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { AudioEngine } from '../audio/AudioEngine';
import { SessionManager } from '../protocol/SessionManager';
import { CryptoEngine } from '../crypto/CryptoEngine';
import { SessionState, AppSettings, SelectedFile } from '../types';
import { setupAudioMode } from '../utils/PermissionUtils';
import { getRecordingOptions, audioBase64ToFloat32 } from '../utils/AudioUtils';

const MAX_POLL_ERRORS = 10;

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
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const errorCountRef = useRef(0);

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

  // Start mic recording loop (runs continuously during session)
  const startRecordingLoop = useCallback(async (engine: AudioEngine) => {
    await setupAudioMode();
    activeRef.current = true;
    errorCountRef.current = 0;

    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(getRecordingOptions());
      await recording.startAsync();
      recordingRef.current = recording;

      pollingRef.current = setInterval(async () => {
        if (!activeRef.current) return;

        try {
          // Sequential: stop previous, process, then start new (no overlap)
          const prevRecording = recordingRef.current;
          if (!prevRecording) return;

          await prevRecording.stopAndUnloadAsync();
          const uri = prevRecording.getURI();

          // Start new recording immediately after stopping
          const nextRecording = new Audio.Recording();
          await nextRecording.prepareToRecordAsync(getRecordingOptions());
          await nextRecording.startAsync();
          recordingRef.current = nextRecording;

          // Process previous recording
          if (uri) {
            const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
              encoding: LegacyFileSystem.EncodingType.Base64,
            });
            const samples = audioBase64ToFloat32(base64);
            if (samples && samples.length > 0) {
              engine.feedSamples(samples);
            }
            await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
          }
          errorCountRef.current = 0;
        } catch (err) {
          errorCountRef.current++;
          if (errorCountRef.current >= MAX_POLL_ERRORS) {
            activeRef.current = false;
            stopRecordingLoop();
          }
        }
      }, 500);
    } catch (err: any) {
      console.error('[Digi2FM] Failed to start recording:', err);
    }
  }, []);

  const stopRecordingLoop = useCallback(async () => {
    activeRef.current = false;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch { /* already stopped */ }
      recordingRef.current = null;
    }
  }, []);

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
    await stopRecordingLoop();
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
      activeRef.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
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
