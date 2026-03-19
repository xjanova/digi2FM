import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { AudioEngine } from '../audio/AudioEngine';
import { TransferSession } from '../protocol/TransferSession';
import { TransferState, AppSettings } from '../types';
import { setupAudioMode } from '../utils/PermissionUtils';
import { RECORDING_PRESET, wavBase64ToFloat32 } from '../utils/AudioUtils';

// Max consecutive errors before giving up
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
    // Recreate engine if settings changed
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
    engineRef.current = new AudioEngine(
      settings.baudRate,
      settings.markFreq,
      settings.spaceFreq
    );
    return engineRef.current;
  }, [settings.baudRate, settings.markFreq, settings.spaceFreq]);

  const startListening = useCallback(async () => {
    await setupAudioMode();

    const engine = getEngine();
    const session = new TransferSession(engine);
    sessionRef.current = session;

    session.setOnStateChange(setState);
    session.setOnComplete((filePath) => {
      setReceivedFilePath(filePath);
    });

    // Start the demodulator
    session.startReceive();
    activeRef.current = true;
    errorCountRef.current = 0;

    // Start overlapping recordings to minimize audio gaps.
    // We keep one "active" recording running while processing the previous one.
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_PRESET);
      await recording.startAsync();
      recordingRef.current = recording;

      pollingRef.current = setInterval(async () => {
        if (!activeRef.current) return;

        try {
          // Start a NEW recording BEFORE stopping the old one to minimize gap
          const nextRecording = new Audio.Recording();
          await nextRecording.prepareToRecordAsync(RECORDING_PRESET);
          await nextRecording.startAsync();

          // Now stop the previous recording
          const prevRecording = recordingRef.current;
          recordingRef.current = nextRecording;

          if (prevRecording) {
            await prevRecording.stopAndUnloadAsync();
            const uri = prevRecording.getURI();

            // Process the captured audio
            if (uri) {
              const base64 = await LegacyFileSystem.readAsStringAsync(uri, {
                encoding: LegacyFileSystem.EncodingType.Base64,
              });
              const samples = wavBase64ToFloat32(base64);
              if (samples && samples.length > 0) {
                engine.feedSamples(samples);
              }
              // Clean up temp file
              await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
            }
          }

          // Reset error counter on success
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

    // Stop polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Stop recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Already stopped
      }
      recordingRef.current = null;
    }

    // Stop session
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

