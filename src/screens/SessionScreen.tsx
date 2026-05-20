import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSession } from '../hooks/useSession';
import { useAudioPermissions } from '../hooks/useAudioPermissions';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme/ThemeContext';
import { fonts, palette as pal, radius, space, type } from '../theme/tokens';
import { SelectedFile, TransferHistoryEntry } from '../types';
import { pickFile, formatFileSize, shareFile } from '../utils/FileUtils';

import ScreenShell from '../components/ui/ScreenShell';
import ScreenHeader from '../components/ui/ScreenHeader';
import SectionLabel from '../components/ui/SectionLabel';
import Card from '../components/ui/Card';
import GlowButton from '../components/ui/GlowButton';
import FreqDial from '../components/ui/FreqDial';
import Oscilloscope from '../components/ui/Oscilloscope';
import PulseRing from '../components/ui/PulseRing';
import PacketBar from '../components/ui/PacketBar';
import FileIcon from '../components/ui/FileIcon';
import SpectrumBars from '../components/ui/SpectrumBars';
import Toggle from '../components/ui/Toggle';
import { StatusPill } from '../components/ui';

const STATUS_LABEL: Record<string, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  connecting: 'HANDSHAKE',
  connected: 'LINK · ENCRYPTED',
  sending: 'TX · LIVE',
  receiving: 'RX · LIVE',
  disconnecting: 'CLOSING',
  error: 'ERROR',
};

export default function SessionScreen() {
  const { settings } = useSettings();
  const { hasPermission, requestPermission } = useAudioPermissions();
  const {
    state,
    receivedFilePath,
    connect, listen, sendFile, disconnect, cleanup,
  } = useSession(settings);
  const { accent, palette } = useTheme();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  useEffect(() => {
    return () => { void cleanup(); };
  }, [cleanup]);

  const ensurePermission = async (): Promise<boolean> => {
    if (hasPermission) return true;
    return await requestPermission();
  };

  const handleConnect = async () => {
    if (await ensurePermission()) await connect();
  };
  const handleListen = async () => {
    if (await ensurePermission()) await listen();
  };
  const handlePickFile = async () => {
    const f = await pickFile();
    if (f) setSelectedFile(f);
  };
  const handleSend = async () => {
    if (!selectedFile) {
      Alert.alert('No file', 'Please select a file first.');
      return;
    }
    await sendFile(selectedFile);
  };
  const handleShare = async () => {
    if (!receivedFilePath) return;
    try { await shareFile(receivedFilePath); }
    catch (err: any) { Alert.alert('Share failed', err?.message ?? 'Could not share file.'); }
  };

  // Derived state
  const status = state.status;
  const isIdle = status === 'idle';
  const isListening = status === 'listening';
  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';
  const isSending = status === 'sending';
  const isReceiving = status === 'receiving';
  const isBusy = isSending || isReceiving;
  const showScopeLive = isListening || isConnecting || isBusy;
  const dialsLocked = isConnected || isBusy;
  const enc = settings.encryptionEnabled;

  return (
    <ScreenShell>
      <ScreenHeader
        eyebrow="01 · SESSION"
        titlePre="Two-way "
        titleAccent="session"
        status={status as any}
        statusLabel={STATUS_LABEL[status]}
      />

      {/* Scope */}
      <View style={{ marginBottom: 16 }}>
        <Oscilloscope active={showScopeLive} height={170} />
      </View>

      {/* Frequency dials */}
      <View style={styles.dialRow}>
        <FreqDial value={settings.markFreq} label="MARK" locked={dialsLocked} />
        <FreqDial value={settings.spaceFreq} label="SPACE" locked={dialsLocked} />
      </View>

      {/* Error banner */}
      {state.error && (
        <Card
          style={{
            marginBottom: 12,
            borderColor: palette.dangerBorder,
            backgroundColor: palette.dangerSoft,
          }}
        >
          <Text style={[type.body, { color: palette.danger }]}>{state.error}</Text>
        </Card>
      )}

      {/* === IDLE === */}
      {isIdle && (
        <>
          <SectionLabel>Begin session</SectionLabel>

          <Card style={{ marginBottom: 12 }}>
            <GlowButton variant="primary" full onPress={handleConnect}>
              Connect to peer
            </GlowButton>
            <Text style={[type.monoSmall, styles.helper, { color: palette.textDim }]}>
              ↑ Initiates handshake · plays sync tones
            </Text>
          </Card>

          <Card style={{ marginBottom: 18 }}>
            <GlowButton variant="secondary" full onPress={handleListen}>
              Listen for peer
            </GlowButton>
            <Text style={[type.monoSmall, styles.helper, { color: palette.textDim }]}>
              ↑ Opens mic · waits for incoming sync
            </Text>
          </Card>

          <SectionLabel
            right={
              <Text style={[type.monoTiny, { color: accent.base }]}>
                XSALSA20·POLY1305
              </Text>
            }
          >
            Encryption
          </SectionLabel>
          <Card>
            <View style={styles.encRow}>
              <View
                style={[
                  styles.encIcon,
                  { backgroundColor: accent.soft, borderColor: accent.base },
                ]}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Rect x="4" y="11" width="16" height="10" rx="2"
                    stroke={accent.base} strokeWidth={1.6} />
                  <Path d="M8 11 V8 a4 4 0 0 1 8 0 v3"
                    stroke={accent.base} strokeWidth={1.6} fill="none" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: palette.text }]}>Pre-shared key</Text>
                <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
                  Peer must use the same passphrase
                </Text>
              </View>
              <Toggle value={enc} disabled />
            </View>
          </Card>
        </>
      )}

      {/* === LISTENING / CONNECTING === */}
      {(isListening || isConnecting) && (
        <>
          <Card style={{ paddingTop: 32, paddingBottom: 48, marginBottom: 16 }}>
            <PulseRing active label={isListening ? 'AWAITING CARRIER' : 'NEGOTIATING'} />
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <Text style={[type.monoSmall, styles.logHeading, { color: palette.textDim }]}>
              HANDSHAKE LOG
            </Text>
            <Text style={[styles.log, { color: palette.textMute }]}>
              {isConnecting
                ? `[--:--:--] tx: SYN 0xA5
[--:--:--] rx: SYN-ACK 0xA5
[--:--:--] tx: ACK 0x01
[--:--:--] negotiating baud...`
                : `[--:--:--] mic open · gain auto
[--:--:--] scanning ${settings.markFreq}/${settings.spaceFreq} Hz
[--:--:--] waiting for preamble...`}
            </Text>
          </Card>

          <GlowButton variant="danger" full onPress={disconnect}>Cancel</GlowButton>
        </>
      )}

      {/* === CONNECTED / TRANSFER === */}
      {(isConnected || isBusy) && (
        <>
          <Card style={{ marginBottom: 12, padding: space.cardPadCompact }}>
            <View style={styles.linkRow}>
              <View
                style={[
                  styles.linkDot,
                  { backgroundColor: palette.success, shadowColor: palette.success },
                ]}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[type.body, { color: palette.text }]}>
                  Linked to{' '}
                  <Text style={[{ fontFamily: fonts.mono, color: accent.base }]}>
                    peer:0x7A·3F·E2
                  </Text>
                </Text>
                <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
                  RSSI −42 dB · {settings.baudRate} baud · {enc ? 'AES-locked' : 'unencrypted'}
                </Text>
              </View>
              <View style={{ width: 80, height: 28 }}>
                <SpectrumBars active count={12} height={28} />
              </View>
            </View>
          </Card>

          {isConnected && (
            <>
              <SectionLabel>File transfer</SectionLabel>

              {selectedFile ? (
                <Card style={{ marginBottom: 16 }}>
                  <View style={styles.pickedRow}>
                    <FileIcon kind={selectedFile.name} size={36} />
                    <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                      <Text style={[type.bodyStrong, { color: palette.text }]} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
                        {formatFileSize(selectedFile.size)} · ready to transmit
                      </Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <GlowButton variant="primary" full onPress={handleSend}>
                      Transmit
                    </GlowButton>
                  </View>
                </Card>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.picker,
                    {
                      borderColor: palette.borderStrong,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={handlePickFile}
                  accessibilityRole="button"
                  accessibilityLabel="Select a file to send"
                >
                  <Text style={[type.body, { color: palette.textMute }]}>
                    Tap to select a file
                  </Text>
                  <Text style={[type.monoTiny, { color: palette.textDim, marginTop: 4 }]}>
                    ANY TYPE · UP TO 1 MB RECOMMENDED
                  </Text>
                </Pressable>
              )}

              <SectionLabel
                right={
                  <Text style={[type.monoTiny, { color: palette.textDim }]}>
                    {state.transferHistory.length} ITEMS
                  </Text>
                }
              >
                History
              </SectionLabel>

              {state.transferHistory.length === 0 ? (
                <Text style={[type.monoSmall, { color: palette.textDim, marginBottom: 16 }]}>
                  No transfers yet
                </Text>
              ) : (
                state.transferHistory.slice().reverse().map((entry, i) => (
                  <HistoryRow key={i} entry={entry} />
                ))
              )}

              {receivedFilePath && (
                <View style={{ marginBottom: 12 }}>
                  <GlowButton variant="secondary" full onPress={handleShare}>
                    Share received file
                  </GlowButton>
                </View>
              )}

              <View style={{ marginTop: 6 }}>
                <GlowButton variant="danger" full onPress={disconnect}>Disconnect</GlowButton>
              </View>
            </>
          )}

          {isBusy && (
            <Card style={{ marginBottom: 12 }}>
              <View style={styles.busyHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <FileIcon kind={state.fileName ?? (isSending ? 'pdf' : 'jpg')} size={32} />
                  <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                    <Text style={[type.bodyStrong, { color: palette.text }]} numberOfLines={1}>
                      {state.fileName ?? (isSending ? 'sending…' : 'receiving…')}
                    </Text>
                    <Text style={[type.monoSmall, { color: palette.textDim }]}>
                      {state.fileSize ? formatFileSize(state.fileSize) : ''} · {isSending ? 'TX' : 'RX'}
                    </Text>
                  </View>
                </View>
              </View>
              <PacketBar
                progress={state.transferProgress}
                current={state.currentPacket}
                total={state.totalPackets}
              />
              <Text style={[type.monoTiny, { color: palette.textDim, marginTop: 10 }]}>
                {isSending ? '↑ TRANSMITTING' : '↓ RECEIVING'} · CRC OK · {state.retryCount ?? 0} RETRIES
              </Text>
              <View style={{ marginTop: 14 }}>
                <GlowButton variant="ghost" full onPress={disconnect}>Cancel transfer</GlowButton>
              </View>
            </Card>
          )}
        </>
      )}
    </ScreenShell>
  );
}

function HistoryRow({ entry }: { entry: TransferHistoryEntry }) {
  const { accent, palette } = useTheme();
  const inbound = entry.direction === 'received';
  const color = inbound ? palette.success : accent.base;
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: pal.bgCard,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radius.button,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 28, height: 28, borderRadius: 6,
          backgroundColor: inbound ? 'rgba(127,255,149,0.10)' : accent.soft,
          borderWidth: 1, borderColor: color,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
          <Path
            d={inbound ? 'M8 2v10m0 0l-4-4m4 4l4-4' : 'M8 14V4m0 0l-4 4m4-4l4 4'}
            stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[type.body, { color: palette.text }]}>
          {entry.fileName}
        </Text>
        <Text style={[type.monoTiny, { color: palette.textDim }]}>
          {formatFileSize(entry.fileSize)} · {time} · {entry.success ? 'OK' : 'FAIL'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  helper: {
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.6,
  },
  encRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  encIcon: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  logHeading: {
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  log: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 19,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkDot: {
    width: 8, height: 8, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  picker: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  pickedRow: { flexDirection: 'row', alignItems: 'center' },
  busyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});
