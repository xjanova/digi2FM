import { useState, useRef, useCallback } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { MicCapture } from '../audio/MicCapture';
import { TransferSession } from '../protocol/TransferSession';
import { TransferState, AppSettings } from '../types';
import { setupAudioMode } from '../utils/PermissionUtils';

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
  const micRef = useRef<MicCapture | null>(null);

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

    try {
      const mic = new MicCapture();
      micRef.current = mic;
      mic.start(
        (samples) => engine.feedSamples(samples),
        (message) => {
          setState((prev) => ({ ...prev, status: 'error', error: message }));
        }
      );
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error.message || 'Failed to start recording',
      }));
    }
  }, [getEngine]);

  const stopListening = useCallback(async () => {
    micRef.current?.stop();
    micRef.current = null;

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
