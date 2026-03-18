import { useState, useRef, useCallback } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { TransferSession } from '../protocol/TransferSession';
import { TransferState, SelectedFile, AppSettings } from '../types';

export function useTransmitter(settings: AppSettings) {
  const [state, setState] = useState<TransferState>({
    status: 'idle',
    progress: 0,
    currentPacket: 0,
    totalPackets: 0,
  });

  const engineRef = useRef<AudioEngine | null>(null);
  const sessionRef = useRef<TransferSession | null>(null);

  const getEngine = useCallback(() => {
    // Always recreate engine when called to pick up latest settings
    if (engineRef.current) {
      engineRef.current.dispose();
    }
    engineRef.current = new AudioEngine(
      settings.baudRate,
      settings.markFreq,
      settings.spaceFreq
    );
    return engineRef.current;
  }, [settings.baudRate, settings.markFreq, settings.spaceFreq]);

  const transmit = useCallback(async (file: SelectedFile) => {
    const engine = getEngine();
    const session = new TransferSession(engine);
    sessionRef.current = session;
    session.setOnStateChange(setState);
    await session.startSend(file);
  }, [getEngine]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    engineRef.current?.stopTransmitting();
    setState({
      status: 'idle',
      progress: 0,
      currentPacket: 0,
      totalPackets: 0,
    });
  }, []);

  const cleanup = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  return { state, transmit, stop, cleanup };
}
