import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import ProgressBar from './ProgressBar';
import { useUpdate } from '../context/UpdateContext';

const canInstall = Platform.OS === 'android';

export default function UpdateModal() {
  const {
    phase,
    currentVersion,
    latest,
    progress,
    error,
    modalDismissed,
    check,
    install,
    dismiss,
  } = useUpdate();

  const downloading = phase === 'downloading';
  const isError = phase === 'error';
  const visible =
    !modalDismissed && (phase === 'available' || downloading || isError);

  const openReleasePage = () => {
    const url = latest?.pageUrl;
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  const handlePrimary = () => {
    if (!canInstall) {
      openReleasePage();
      return;
    }
    if (isError && !latest) {
      check();
      return;
    }
    install();
  };

  const primaryLabel = !canInstall
    ? 'View on GitHub'
    : isError
    ? 'Retry'
    : 'Update Now';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!downloading) dismiss();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.accent} />
          <Text style={styles.title}>
            {isError ? 'Update Failed' : 'Update Available'}
          </Text>

          {!isError && (
            <View style={styles.versionRow}>
              <Text style={styles.versionOld}>v{currentVersion}</Text>
              <Text style={styles.versionArrow}>{'->'}</Text>
              <Text style={styles.versionNew}>v{latest?.version ?? '?'}</Text>
            </View>
          )}

          {isError ? (
            <Text style={styles.errorText}>
              {error ?? 'Something went wrong while updating.'}
            </Text>
          ) : latest?.notes ? (
            <ScrollView
              style={styles.notesBox}
              contentContainerStyle={styles.notesContent}
            >
              <Text style={styles.notesText}>{latest.notes}</Text>
            </ScrollView>
          ) : (
            <Text style={styles.notesEmpty}>
              A new version of Digi2FM is ready to install.
            </Text>
          )}

          {downloading && (
            <View style={styles.progressWrap}>
              <ProgressBar progress={progress} label="Downloading update..." />
            </View>
          )}

          <View style={styles.actions}>
            {downloading ? (
              <View style={styles.downloadingRow}>
                <ActivityIndicator color="#00d4ff" />
                <Text style={styles.downloadingText}>
                  Downloading, please wait...
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handlePrimary}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                </TouchableOpacity>
                <View style={styles.secondaryRow}>
                  {canInstall && (
                    <TouchableOpacity
                      style={styles.ghostButton}
                      onPress={openReleasePage}
                    >
                      <Text style={styles.ghostButtonText}>View on GitHub</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.ghostButton} onPress={dismiss}>
                    <Text style={styles.ghostButtonText}>Later</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2e2e4a',
    padding: 22,
  },
  accent: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00d4ff',
    marginBottom: 14,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  versionOld: { color: '#888', fontSize: 15, fontWeight: '600' },
  versionArrow: { color: '#555', fontSize: 15, fontWeight: '600' },
  versionNew: { color: '#00d4ff', fontSize: 17, fontWeight: '700' },
  notesBox: {
    maxHeight: 200,
    backgroundColor: '#13131f',
    borderRadius: 10,
    marginTop: 16,
  },
  notesContent: { padding: 12 },
  notesText: { color: '#bbb', fontSize: 13, lineHeight: 19 },
  notesEmpty: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 20,
  },
  progressWrap: { marginTop: 8 },
  actions: { marginTop: 20 },
  primaryButton: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0d0d1a',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
  },
  ghostButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ghostButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  downloadingText: {
    color: '#aaa',
    fontSize: 14,
  },
});
