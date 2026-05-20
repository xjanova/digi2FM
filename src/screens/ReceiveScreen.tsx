import React, { useEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useReceiver } from '../hooks/useReceiver';
import { useAudioPermissions } from '../hooks/useAudioPermissions';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme/ThemeContext';
import { fonts, palette as pal, type } from '../theme/tokens';
import { formatFileSize, shareFile } from '../utils/FileUtils';

import ScreenShell from '../components/ui/ScreenShell';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import GlowButton from '../components/ui/GlowButton';
import PulseRing from '../components/ui/PulseRing';
import SpectrumBars from '../components/ui/SpectrumBars';
import Oscilloscope from '../components/ui/Oscilloscope';
import PacketBar from '../components/ui/PacketBar';
import FileIcon from '../components/ui/FileIcon';

export default function ReceiveScreen() {
  const { hasPermission, requestPermission } = useAudioPermissions();
  const { settings } = useSettings();
  const { state, receivedFilePath, startListening, stopListening, cleanup } =
    useReceiver(settings);
  const { accent, palette } = useTheme();

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  const handleStart = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await startListening();
  };

  const handleShare = async () => {
    if (!receivedFilePath) return;
    try { await shareFile(receivedFilePath); }
    catch (err: any) { Alert.alert('Share failed', err?.message ?? 'Could not share.'); }
  };

  // Map the underlying TransferStatus → the four design states.
  const stage: 'idle' | 'listening' | 'receiving' | 'done' = (() => {
    if (state.status === 'idle' || state.status === 'error') return 'idle';
    if (state.status === 'completed') return 'done';
    if (state.status === 'waiting_sync') return 'listening';
    return 'receiving';
  })();

  const statusLabel = stage === 'done' ? 'COMPLETE'
    : stage === 'receiving' ? 'RX · LOCKED'
    : stage === 'listening' ? 'OPEN MIC'
    : 'STANDBY';

  const pillStatus = stage === 'done' ? 'connected'
    : stage === 'receiving' ? 'receiving'
    : stage === 'listening' ? 'listening'
    : 'idle';

  return (
    <ScreenShell>
      <ScreenHeader
        eyebrow="03 · RECEIVE"
        titlePre="Listen for "
        titleAccent="signal"
        status={pillStatus as any}
        statusLabel={statusLabel}
      />

      {/* Visual hero card */}
      <Card style={{ marginBottom: 18, paddingTop: 28, paddingBottom: 40, paddingHorizontal: 16 }}>
        {stage === 'idle' && (
          <View style={styles.center}>
            <View
              style={[
                styles.dashedCircle,
                { borderColor: palette.borderStrong },
              ]}
            >
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Rect x="9" y="3" width="6" height="12" rx="3"
                  stroke={palette.textMute} strokeWidth={1.6} />
                <Path d="M5 10 v2 a7 7 0 0 0 14 0 v-2"
                  stroke={palette.textMute} strokeWidth={1.6} strokeLinecap="round" fill="none" />
                <Path d="M12 19 v3" stroke={palette.textMute} strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={[type.monoSmall, { color: palette.textDim, letterSpacing: 1.6 }]}>
              MIC CLOSED · TAP BELOW TO BEGIN
            </Text>
          </View>
        )}

        {stage === 'listening' && (
          <View style={{ paddingVertical: 8 }}>
            <PulseRing active label="AWAITING PREAMBLE" size={200} />
          </View>
        )}

        {stage === 'receiving' && (
          <View>
            <Text
              style={[
                type.monoSmall,
                {
                  textAlign: 'center',
                  marginBottom: 18,
                  letterSpacing: 2,
                  color: palette.success,
                },
              ]}
            >
              ● CARRIER LOCKED · −38 dB
            </Text>
            <SpectrumBars active count={32} height={90} />
            <View style={{ marginTop: 16 }}>
              <Oscilloscope active height={80} />
            </View>
          </View>
        )}

        {stage === 'done' && (
          <View style={styles.center}>
            <View
              style={[
                styles.checkBubble,
                { borderColor: palette.success, shadowColor: palette.success },
              ]}
            >
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12.5l4.5 4.5L19 7" stroke={palette.success} strokeWidth={2.4}
                  fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[type.bodyStrong, { color: palette.text, fontSize: 18 }]}>
              File received
            </Text>
            <Text
              style={[
                type.monoSmall,
                { color: palette.textDim, marginTop: 4, letterSpacing: 1.2 },
              ]}
            >
              {state.totalPackets}/{state.totalPackets} PACKETS · CRC OK · 0 ERRORS
            </Text>
          </View>
        )}
      </Card>

      {/* File info card during receiving / done */}
      {(stage === 'receiving' || stage === 'done') && (state.fileName || receivedFilePath) && (
        <Card style={{ marginBottom: 18 }}>
          <View style={styles.fileRow}>
            <FileIcon kind={state.fileName ?? 'jpg'} size={40} />
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text numberOfLines={1} style={[type.bodyStrong, { color: palette.text }]}>
                {state.fileName ?? 'unnamed.bin'}
              </Text>
              <Text style={[type.monoSmall, { color: palette.textDim }]}>
                {state.fileSize ? `${formatFileSize(state.fileSize)} · ` : ''}from peer
              </Text>
            </View>
            {state.fileSize != null && (
              <Text style={{ fontFamily: fonts.monoBold, fontSize: 18, color: accent.base }}>
                {formatFileSize(state.fileSize).split(' ')[0]}
                <Text style={{ fontSize: 10, color: palette.textDim, marginLeft: 2 }}>
                  {' '}{formatFileSize(state.fileSize).split(' ')[1]}
                </Text>
              </Text>
            )}
          </View>
          {stage === 'receiving' && (
            <View style={{ marginTop: 14 }}>
              <PacketBar
                progress={state.progress}
                current={state.currentPacket}
                total={state.totalPackets}
              />
            </View>
          )}
        </Card>
      )}

      {/* Error */}
      {state.error && (
        <Card
          style={{
            marginBottom: 18,
            borderColor: pal.dangerBorder,
            backgroundColor: pal.dangerSoft,
          }}
        >
          <Text style={[type.body, { color: pal.danger }]}>{state.error}</Text>
        </Card>
      )}

      {/* Action button */}
      {stage === 'idle' && (
        <GlowButton variant="primary" full onPress={handleStart}>● Start listening</GlowButton>
      )}
      {(stage === 'listening' || stage === 'receiving') && (
        <GlowButton variant="danger" full onPress={stopListening}>■ Stop</GlowButton>
      )}
      {stage === 'done' && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GlowButton variant="secondary" onPress={stopListening}>Listen again</GlowButton>
          <View style={{ flex: 1 }}>
            <GlowButton variant="primary" full onPress={handleShare}>
              Share / Open
            </GlowButton>
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 32 },
  dashedCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  checkBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(127,255,149,0.10)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 6,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center' },
});
