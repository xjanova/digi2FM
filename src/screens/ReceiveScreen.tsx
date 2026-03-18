import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useReceiver } from '../hooks/useReceiver';
import { useAudioPermissions } from '../hooks/useAudioPermissions';
import { useSettings } from '../context/SettingsContext';
import { formatFileSize, shareFile } from '../utils/FileUtils';
import ProgressBar from '../components/ProgressBar';
import StatusIndicator from '../components/StatusIndicator';
import WaveformVisualizer from '../components/WaveformVisualizer';

export default function ReceiveScreen() {
  const { hasPermission, requestPermission } = useAudioPermissions();
  const { settings } = useSettings();
  const { state, receivedFilePath, startListening, stopListening, cleanup } =
    useReceiver(settings);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const handleStartListening = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await startListening();
  };

  const handleShare = async () => {
    if (receivedFilePath) {
      await shareFile(receivedFilePath);
    }
  };

  const isActive = !['idle', 'completed', 'error'].includes(state.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Receive File</Text>
      <Text style={styles.subtitle}>
        Listen for incoming FSK audio signal
      </Text>

      <WaveformVisualizer isActive={isActive} />
      <StatusIndicator status={state.status} />

      {state.fileName && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileInfoLabel}>File: {state.fileName}</Text>
          {state.fileSize !== undefined && (
            <Text style={styles.fileInfoLabel}>
              Size: {formatFileSize(state.fileSize)}
            </Text>
          )}
        </View>
      )}

      {state.totalPackets > 0 && (
        <ProgressBar
          progress={state.progress}
          label={`Packet ${state.currentPacket} / ${state.totalPackets}`}
        />
      )}

      {state.error && <Text style={styles.errorText}>{state.error}</Text>}

      {state.status === 'completed' && receivedFilePath && (
        <View style={styles.receivedInfo}>
          <Text style={styles.receivedText}>File received successfully!</Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Share / Open</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actions}>
        {!isActive ? (
          <TouchableOpacity style={styles.actionButton} onPress={handleStartListening}>
            <Text style={styles.actionButtonText}>Start Listening</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={stopListening}
          >
            <Text style={styles.actionButtonText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 14, marginBottom: 24 },
  fileInfo: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
  },
  fileInfoLabel: { color: '#ccc', fontSize: 14, marginBottom: 2 },
  errorText: { color: '#ff4444', fontSize: 13, marginTop: 8 },
  receivedInfo: {
    backgroundColor: '#1a3d1a',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    alignItems: 'center',
  },
  receivedText: { color: '#00ff88', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  shareButton: {
    backgroundColor: '#00ff88',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  shareButtonText: { color: '#000', fontSize: 14, fontWeight: '700' },
  actions: { marginTop: 24 },
  actionButton: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionButtonText: { color: '#000', fontSize: 18, fontWeight: '700' },
  stopButton: { backgroundColor: '#ff4444' },
});
