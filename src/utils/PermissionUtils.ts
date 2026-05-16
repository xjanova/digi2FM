import { AudioManager } from 'react-native-audio-api';
import { Alert } from 'react-native';

/**
 * Request microphone permission via react-native-audio-api.
 * The OS-level RECORD_AUDIO permission is shared across libraries, so
 * granting here also satisfies any other library that needs the mic.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const status = await AudioManager.requestRecordingPermissions();
  if (status !== 'Granted') {
    Alert.alert(
      'Permission Required',
      'Microphone access is needed to receive data. Please enable it in Settings.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

export async function checkMicrophonePermission(): Promise<boolean> {
  const status = await AudioManager.checkRecordingPermissions();
  return status === 'Granted';
}

/**
 * Configure the audio session so the mic can record while the speaker
 * is also active (needed for half-duplex transmit-then-listen flows).
 */
export async function setupAudioMode(): Promise<void> {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'measurement',
    iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
  });
  await AudioManager.setAudioSessionActivity(true);
}
