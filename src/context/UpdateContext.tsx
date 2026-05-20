import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  CURRENT_VERSION,
  ReleaseInfo,
  checkForUpdate,
  downloadAndInstall,
} from '../services/UpdateService';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'upToDate'
  | 'downloading'
  | 'error';

interface UpdateContextType {
  phase: UpdatePhase;
  currentVersion: string;
  latest: ReleaseInfo | null;
  progress: number; // 0-1, while downloading
  error: string | null;
  modalDismissed: boolean;
  check: (options?: { silent?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

const UpdateContext = createContext<UpdateContextType>({
  phase: 'idle',
  currentVersion: CURRENT_VERSION,
  latest: null,
  progress: 0,
  error: null,
  modalDismissed: false,
  check: async () => {},
  install: async () => {},
  dismiss: () => {},
});

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [latest, setLatest] = useState<ReleaseInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalDismissed, setModalDismissed] = useState(false);

  const mounted = useRef(true);
  const inFlight = useRef(false);
  const latestRef = useRef<ReleaseInfo | null>(null);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useCallback(async (options?: { silent?: boolean }) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!options?.silent) setModalDismissed(false);
    setError(null);
    setPhase('checking');
    try {
      const result = await checkForUpdate();
      if (!mounted.current) return;
      latestRef.current = result.latest;
      setLatest(result.latest);
      if (result.updateAvailable) {
        setModalDismissed(false);
        setPhase('available');
      } else {
        setPhase('upToDate');
      }
    } catch (e) {
      if (!mounted.current) return;
      const message =
        e instanceof Error ? e.message : 'Could not check for updates.';
      // A background check fails quietly; a manual check surfaces the error.
      if (options?.silent) {
        setPhase('idle');
      } else {
        setError(message);
        setPhase('error');
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  const install = useCallback(async () => {
    const release = latestRef.current;
    if (!release) {
      setError('No release information is available.');
      setPhase('error');
      return;
    }
    setError(null);
    setProgress(0);
    setModalDismissed(false);
    setPhase('downloading');
    try {
      await downloadAndInstall(release, (fraction) => {
        if (mounted.current) setProgress(fraction);
      });
      if (!mounted.current) return;
      // The system installer is now in the foreground. Fall back to the
      // "available" state so the user can retry if they cancel it.
      setProgress(1);
      setPhase('available');
    } catch (e) {
      if (!mounted.current) return;
      setError(
        e instanceof Error ? e.message : 'The update could not be installed.'
      );
      setPhase('error');
    }
  }, []);

  const dismiss = useCallback(() => {
    setModalDismissed(true);
  }, []);

  useEffect(() => {
    check({ silent: true });
  }, [check]);

  return (
    <UpdateContext.Provider
      value={{
        phase,
        currentVersion: CURRENT_VERSION,
        latest,
        progress,
        error,
        modalDismissed,
        check,
        install,
        dismiss,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate(): UpdateContextType {
  return useContext(UpdateContext);
}
