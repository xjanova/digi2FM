import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { AudioEngine } from '../audio/AudioEngine';
import { TransferSession } from '../protocol/TransferSession';
import { TransferState, AppSettings } from '../types';
import { setupAudioMode } from '../utils/PermissionUtils';
import { getRecordingOptions, audioBase64ToFloat32 } from '../utils/AudioUtils';

const MAX_POLL_ERRORS = 10;

export function useReceiver(settings: AppSettings) {
  const [state, setState] = useState<TransferState>({
    status: 'idle',
    progress: 0,
    currentPacket: 0,
    totalPackets: 0,
  });
  const [receivedFilePath, setReceivedFilePath] = useState<string | null>(null);

  const engineRef = useRef<AudioEngine | null>(null);
  const sessionRef = useRef<TransferSession | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const errorCountRef = useRef(0);

  const getEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
    engineRef.current = new AudioEngine(
      settings.baudRate,
      settings.markFreq,
      settings.spaceFreq,
      settings.errorCorrection
    );
    return engineRef.current;
  }, [settings.baudRate, settings.markFreq, settings.spaceFreq, settings.errorCorrection]);

  const startListening = useCallback(async () => {
    await setupAudioMode();

    const engine = getEngine();
    const session = new TransferSession(engine);
    sessionRef.current = session;

    session.setOnStateChange(setState);
    session.setOnComplete((filePath) => {
      setReceivedFilePath(filePath);
    });

    session.startReceive();
    activeRef.current = true;
    errorCountRef.current = 0;

    // Use single continuous recording (no overlapping - expo-av only supports one)
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(getRecordingOptions());
      await recording.startAsync();
      recordingRef.current = recording;

      pollingRef.current = setInterval(async () => {
        if (!activeRef.current) return;

        try {
          // Stop current recording, process it, start a new one
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
          console.warn(`[Digi2FM] Recording poll error (${errorCountRef.current}/${MAX_POLL_ERRORS}):`, err);

          if (errorCountRef.current >= MAX_POLL_ERRORS) {
            setState(prev => ({
              ...prev,
              status: 'error',
              error: `Recording failed after ${MAX_POLL_ERRORS} consecutive errors`,
            }));
            activeRef.current = false;
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
          }
        }
      }, 500);
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to start recording',
      }));
    }
  }, [getEngine]);

  const stopListening = useCallback(async () => {
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

    sessionRef.current?.stop();
    engineRef.current?.stopReceiving();

    setState({
      status: 'idle',
      progress: 0,
      currentPacket: 0,
      totalPackets: 0,
    });
  }, []);

  const cleanup = useCallback(() => {
    stopListening();
    engineRef.current?.dispose();
    engineRef.current = null;
  }, [stopListening]);

  return { state, receivedFilePath, startListening, stopListening, cleanup };
}
