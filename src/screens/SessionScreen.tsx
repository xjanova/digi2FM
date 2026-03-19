import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, FlatList,
} from 'react-native';
import { useSession } from '../hooks/useSession';
import { useAudioPermissions } from '../hooks/useAudioPermissions';
import { useSettings } from '../context/SettingsContext';
import { SelectedFile, TransferHistoryEntry } from '../types';
import { pickFile, formatFileSize, shareFile } from '../utils/FileUtils';
import ProgressBar from '../components/ProgressBar';
import StatusIndicator from '../components/StatusIndicator';
import WaveformVisualizer from '../components/WaveformVisualizer';

export default function SessionScreen() {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const { hasPermission, requestPermission } = useAudioPermissions();
  const { settings } = useSettings();
  const {
    state, receivedFilePath,
    connect, listen, sendFile, disconnect, cleanup,
  } = useSession(settings);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  const ensurePermission = async (): Promise<boolean> => {
    if (hasPermission) return true;
    return await requestPermission();
  };

  const handleConnect = async () => {
    if (!(await ensurePermission())) return;
    await connect();
  };

  const handleListen = async () => {
    if (!(await ensurePermission())) return;
    await listen();
  };

  const handlePickFile = async () => {
    const file = await pickFile();
    if (file) setSelectedFile(file);
  };

  const handleSend = async () => {
    if (!selectedFile) {
      Alert.alert('No File', 'Please select a file first.');
      return;
    }
    await sendFile(selectedFile);
  };

  const handleShare = async () => {
    if (receivedFilePath) await shareFile(receivedFilePath);
  };

  const isIdle = state.status === 'idle';
  const isConnected = state.status === 'connected';
  const isActive = !['idle', 'error'].includes(state.status);
  const isBusy = state.status === 'sending' || state.status === 'receiving';

  // Map session status to display text
  const statusText: Record<string, string> = {
    idle: 'Idle',
    connecting: 'Connecting...',
    listening: 'Listening for peer...',
    connected: 'Connected',
    sending: 'Sending file...',
    receiving: 'Receiving file...',
    disconnecting: 'Disconnecting...',
    error: 'Error',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>Two-Way Session</Text>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, isActive && styles.statusDotActive]} />
        <Text style={styles.statusText}>{statusText[state.status] || state.status}</Text>
        {state.encryptionActive && (
          <View style={styles.encBadge}>
            <Text style={styles.encBadgeText}>Encrypted</Text>
          </View>
        )}
      </View>

      {/* Waveform */}
      <WaveformVisualizer isActive={isBusy || state.status === 'connecting' || state.status === 'listening'} />

      {/* Error */}
      {state.error && <Text style={styles.errorText}>{state.error}</Text>}

      {/* Connection controls */}
      {isIdle && (
        <View style={styles.connectionControls}>
          <TouchableOpacity style={styles.connectBtn} onPress={handleConnect}>
            <Text style={styles.connectBtnText}>Connect</Text>
            <Text style={styles.connectBtnSub}>Initiate session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listenBtn} onPress={handleListen}>
            <Text style={styles.listenBtnText}>Listen</Text>
            <Text style={styles.listenBtnSub}>Wait for peer</Text>
          </TouchableOpacity>
        </View>
      )}

      {(state.status === 'connecting' || state.status === 'listening') && (
        <TouchableOpacity style={styles.cancelBtn} onPress={disconnect}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}

      {/* File transfer (when connected) */}
      {(isConnected || isBusy) && (
        <View style={styles.transferSection}>
          <Text style={styles.sectionTitle}>File Transfer</Text>

          {!isBusy && (
            <View style={styles.sendRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={handlePickFile}>
                <Text style={styles.pickBtnText}>
                  {selectedFile ? selectedFile.name : 'Select File'}
                </Text>
                {selectedFile && (
                  <Text style={styles.pickBtnSub}>{formatFileSize(selectedFile.size)}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, !selectedFile && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!selectedFile}
              >
                <Text style={styles.sendBtnText}>Send</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progress */}
          {isBusy && (
            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>
                {state.status === 'sending' ? 'Sending' : 'Receiving'}: {state.fileName}
              </Text>
              {state.fileSize !== undefined && (
                <Text style={styles.progressSub}>{formatFileSize(state.fileSize)}</Text>
              )}
              <ProgressBar
                progress={state.transferProgress}
                label={`Packet ${state.currentPacket} / ${state.totalPackets}`}
              />
              {state.retryCount !== undefined && state.retryCount > 0 && (
                <Text style={styles.retryText}>Retry #{state.retryCount}</Text>
              )}
            </View>
          )}

          {/* Received file */}
          {receivedFilePath && isConnected && (
            <View style={styles.receivedBox}>
              <Text style={styles.receivedText}>File received!</Text>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Text style={styles.shareBtnText}>Share / Open</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Disconnect */}
          <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
            <Text style={styles.disconnectBtnText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Transfer history */}
      {state.transferHistory.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>History</Text>
          {state.transferHistory.slice().reverse().map((entry, i) => (
            <HistoryItem key={i} entry={entry} />
          ))}
        </View>
      )}

      {/* Encryption info */}
      {settings.encryptionEnabled && isIdle && (
        <View style={styles.cryptoInfo}>
          <Text style={styles.cryptoInfoText}>
            Encryption enabled - peer must use the same passphrase
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function HistoryItem({ entry }: { entry: TransferHistoryEntry }) {
  const arrow = entry.direction === 'sent' ? '>' : '<';
  const color = entry.success ? '#00ff88' : '#ff4444';
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <View style={styles.historyItem}>
      <Text style={[styles.historyArrow, { color }]}>{arrow}</Text>
      <View style={styles.historyContent}>
        <Text style={styles.historyFileName}>{entry.fileName}</Text>
        <Text style={styles.historyMeta}>
          {formatFileSize(entry.fileSize)} - {time}
          {!entry.success && ' (failed)'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#666', marginRight: 8 },
  statusDotActive: { backgroundColor: '#00ff88' },
  statusText: { color: '#aaa', fontSize: 14, flex: 1 },
  encBadge: { backgroundColor: '#00d4ff22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  encBadgeText: { color: '#00d4ff', fontSize: 11, fontWeight: '600' },
  errorText: { color: '#ff4444', fontSize: 13, marginBottom: 12, backgroundColor: '#ff444415', borderRadius: 8, padding: 10 },

  // Connection controls
  connectionControls: { flexDirection: 'row', gap: 12, marginTop: 16 },
  connectBtn: {
    flex: 1, backgroundColor: '#00d4ff', borderRadius: 12, padding: 20, alignItems: 'center',
  },
  connectBtnText: { color: '#000', fontSize: 18, fontWeight: '700' },
  connectBtnSub: { color: '#00000088', fontSize: 12, marginTop: 4 },
  listenBtn: {
    flex: 1, backgroundColor: '#00ff88', borderRadius: 12, padding: 20, alignItems: 'center',
  },
  listenBtnText: { color: '#000', fontSize: 18, fontWeight: '700' },
  listenBtnSub: { color: '#00000088', fontSize: 12, marginTop: 4 },
  cancelBtn: {
    backgroundColor: '#ff444433', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16,
    borderWidth: 1, borderColor: '#ff4444',
  },
  cancelBtnText: { color: '#ff4444', fontSize: 16, fontWeight: '600' },

  // Transfer
  transferSection: { marginTop: 20 },
  sectionTitle: {
    color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 12,
  },
  sendRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  pickBtn: {
    flex: 1, backgroundColor: '#252540', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#444', borderStyle: 'dashed',
  },
  pickBtnText: { color: '#00d4ff', fontSize: 14, fontWeight: '600' },
  pickBtnSub: { color: '#888', fontSize: 12, marginTop: 2 },
  sendBtn: { backgroundColor: '#00d4ff', borderRadius: 10, paddingHorizontal: 24, justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#333' },
  sendBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },

  progressSection: { backgroundColor: '#252540', borderRadius: 12, padding: 16, marginBottom: 16 },
  progressLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  progressSub: { color: '#888', fontSize: 12, marginBottom: 8 },
  retryText: { color: '#ff8800', fontSize: 12, marginTop: 4 },

  receivedBox: {
    backgroundColor: '#1a3d1a', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16,
  },
  receivedText: { color: '#00ff88', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  shareBtn: { backgroundColor: '#00ff88', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  shareBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },

  disconnectBtn: {
    backgroundColor: '#ff444422', borderRadius: 10, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#ff4444',
  },
  disconnectBtnText: { color: '#ff4444', fontSize: 14, fontWeight: '600' },

  // History
  historySection: { marginTop: 24 },
  historyItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  historyArrow: { fontSize: 18, fontWeight: '700', marginRight: 10 },
  historyContent: { flex: 1 },
  historyFileName: { color: '#ccc', fontSize: 14 },
  historyMeta: { color: '#666', fontSize: 12 },

  // Crypto info
  cryptoInfo: { backgroundColor: '#00d4ff11', borderRadius: 8, padding: 12, marginTop: 24 },
  cryptoInfoText: { color: '#00d4ff', fontSize: 12, textAlign: 'center' },
});
