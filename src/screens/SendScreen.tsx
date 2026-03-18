import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useTransmitter } from '../hooks/useTransmitter';
import { useSettings } from '../context/SettingsContext';
import { SelectedFile } from '../types';
import { pickFile } from '../utils/FileUtils';
import FilePreview from '../components/FilePreview';
import ProgressBar from '../components/ProgressBar';
import StatusIndicator from '../components/StatusIndicator';
import WaveformVisualizer from '../components/WaveformVisualizer';

export default function SendScreen() {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const { settings } = useSettings();
  const { state, transmit, stop, cleanup } = useTransmitter(settings);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const handlePickFile = async () => {
    const file = await pickFile();
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleTransmit = async () => {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select a file first.');
      return;
    }
    await transmit(selectedFile);
  };

  const isActive = !['idle', 'completed', 'error'].includes(state.status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Send File</Text>
      <Text style={styles.subtitle}>
        Select a file to transmit as FSK audio
      </Text>

      <TouchableOpacity
        style={styles.pickButton}
        onPress={handlePickFile}
        disabled={isActive}
      >
        <Text style={styles.pickButtonText}>
          {selectedFile ? 'Change File' : 'Select File'}
        </Text>
      </TouchableOpacity>

      {selectedFile && (
        <FilePreview file={selectedFile} baudRate={settings.baudRate} />
      )}

      <WaveformVisualizer isActive={isActive} />
      <StatusIndicator status={state.status} />

      {state.totalPackets > 0 && (
        <ProgressBar
          progress={state.progress}
          label={`Packet ${state.currentPacket} / ${state.totalPackets}`}
        />
      )}

      {state.error && <Text style={styles.errorText}>{state.error}</Text>}

      <View style={styles.actions}>
        {!isActive ? (
          <TouchableOpacity
            style={[styles.actionButton, !selectedFile && styles.actionButtonDisabled]}
            onPress={handleTransmit}
            disabled={!selectedFile}
          >
            <Text style={styles.actionButtonText}>Transmit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={stop}
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
  pickButton: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
  },
  pickButtonText: { color: '#00d4ff', fontSize: 16, fontWeight: '600' },
  errorText: { color: '#ff4444', fontSize: 13, marginTop: 8 },
  actions: { marginTop: 24 },
  actionButton: {
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionButtonDisabled: { backgroundColor: '#333' },
  actionButtonText: { color: '#000', fontSize: 18, fontWeight: '700' },
  stopButton: { backgroundColor: '#ff4444' },
});
