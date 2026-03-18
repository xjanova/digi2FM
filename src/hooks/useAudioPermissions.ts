import { useState, useEffect } from 'react';
import { requestMicrophonePermission, checkMicrophonePermission, setupAudioMode } from '../utils/PermissionUtils';

export function useAudioPermissions() {
  const [hasPermission, setHasPermission] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    checkMicrophonePermission().then((granted) => {
      if (mounted) {
        setHasPermission(granted);
        setChecking(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const requestPermission = async (): Promise<boolean> => {
    const granted = await requestMicrophonePermission();
    if (granted) {
      await setupAudioMode();
    }
    setHasPermission(granted);
    return granted;
  };

  return { hasPermission, checking, requestPermission };
}
