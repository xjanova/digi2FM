import { Audio } from 'expo-av';
import { Alert } from 'react-native';

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Microphone access is needed to receive data. Please enable it in Settings.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

/**
 * Check if microphone permission is granted
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  const { status } = await Audio.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Setup audio mode for recording and playback
 */
export async function setupAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: false,
  });
}
