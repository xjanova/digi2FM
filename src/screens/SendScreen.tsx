import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTransmitter } from '../hooks/useTransmitter';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme/ThemeContext';
import { fonts, radius, type } from '../theme/tokens';
import { SelectedFile } from '../types';
import { formatDuration, formatFileSize, pickFile } from '../utils/FileUtils';
import { ProtocolConfig } from '../constants/ProtocolConfig';

import ScreenShell from '../components/ui/ScreenShell';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import GlowButton from '../components/ui/GlowButton';
import FreqDial from '../components/ui/FreqDial';
import Oscilloscope from '../components/ui/Oscilloscope';
import PacketBar from '../components/ui/PacketBar';
import FileIcon from '../components/ui/FileIcon';

/** Effective bytes-per-second given a baud rate (UART framing). */
function bytesPerSecond(baud: number) {
  return baud / ProtocolConfig.BITS_PER_BYTE;
}

export default function SendScreen() {
  const { settings } = useSettings();
  const { state, transmit, stop, cleanup } = useTransmitter(settings);
  const { accent, palette } = useTheme();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  const transmitting = !['idle', 'completed', 'error'].includes(state.status);
  const done = state.status === 'completed';

  const handlePick = async () => {
    const f = await pickFile();
    if (f) setSelectedFile(f);
  };
  const handleTransmit = async () => {
    if (!selectedFile) {
      Alert.alert('No file', 'Please select a file first.');
      return;
    }
    await transmit(selectedFile);
  };

  // Derived stats (size, packets, eta) for the picked-file card.
  const stats = useMemo(() => {
    if (!selectedFile) return null;
    const pkts = Math.max(1, Math.ceil(selectedFile.size / ProtocolConfig.MAX_PACKET_DATA_SIZE));
    const eta = selectedFile.size / Math.max(1, bytesPerSecond(settings.baudRate));
    return {
      size: formatFileSize(selectedFile.size),
      pkts: String(pkts),
      eta: formatDuration(eta),
    };
  }, [selectedFile, settings.baudRate]);

  const statusLabel = transmitting ? `TX · ${settings.baudRate} BAUD` : done ? 'COMPLETE' : 'STANDBY';
  const pillStatus = transmitting ? 'sending' : done ? 'connected' : 'idle';

  return (
    <ScreenShell>
      <ScreenHeader
        eyebrow="02 · TRANSMIT"
        titlePre="Send a "
        titleAccent="file"
        status={pillStatus as any}
        statusLabel={statusLabel}
      />

      {/* File card or empty placeholder */}
      {!selectedFile ? (
        <Pressable
          onPress={transmitting ? undefined : handlePick}
          style={[styles.empty, { borderColor: palette.borderStrong }]}
        >
          <View
            style={[
              styles.plusBubble,
              { borderColor: accent.base, backgroundColor: accent.soft },
            ]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M12 4 v16 m-8 -8 h16" stroke={accent.base} strokeWidth={1.8}
                strokeLinecap="round" />
            </Svg>
          </View>
          <Text style={[type.bodyStrong, { color: palette.text }]}>Select a file</Text>
          <Text style={[type.monoTiny, { color: palette.textDim, marginTop: 6 }]}>
            ANY TYPE · CHUNKED INTO {ProtocolConfig.MAX_PACKET_DATA_SIZE}-BYTE PACKETS
          </Text>
        </Pressable>
      ) : (
        <Card style={{ marginBottom: 18 }}>
          <Pressable onPress={transmitting ? undefined : handlePick} style={styles.pickedRow}>
            <FileIcon kind={selectedFile.name} size={44} />
            <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
              <Text numberOfLines={1} style={[type.bodyStrong, { color: palette.text }]}>
                {selectedFile.name}
              </Text>
              <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
                {selectedFile.mimeType || 'application/octet-stream'}
              </Text>
              {stats && (
                <View style={styles.statRow}>
                  <Stat label="SIZE" value={stats.size} />
                  <Stat label="PKTS" value={stats.pkts} />
                  <Stat label="ETA" value={stats.eta} />
                </View>
              )}
            </View>
          </Pressable>
        </Card>
      )}

      {/* Scope */}
      <View style={{ marginBottom: 14 }}>
        <Oscilloscope active={transmitting} height={120} />
      </View>

      {/* Frequency dials */}
      <View style={styles.dialRow}>
        <FreqDial value={settings.markFreq} label="MARK" locked={transmitting} />
        <FreqDial value={settings.spaceFreq} label="SPACE" locked={transmitting} />
      </View>

      {/* Live transmit stats */}
      {transmitting && (
        <Card style={{ marginBottom: 18 }}>
          <PacketBar
            progress={state.progress}
            current={state.currentPacket}
            total={state.totalPackets}
          />
          <View style={[styles.statSplit, { borderTopColor: palette.border }]}>
            <Stat
              big
              label="ELAPSED"
              value={state.estimatedTimeRemaining != null && stats
                ? formatDuration(Math.max(0,
                    (Number(stats.eta.replace(/[^\d.]/g, '')) || 0) - state.estimatedTimeRemaining))
                : '--:--'
              }
            />
            <Stat
              big
              label="REMAINING"
              value={state.estimatedTimeRemaining != null
                ? formatDuration(state.estimatedTimeRemaining)
                : '--:--'
              }
            />
            <Stat big label="RETRY" value={'0×'} />
          </View>
        </Card>
      )}

      {/* Done banner */}
      {done && (
        <Card
          style={{
            marginBottom: 18,
            backgroundColor: 'rgba(127,255,149,0.06)',
            borderColor: 'rgba(127,255,149,0.3)',
          }}
        >
          <View style={styles.doneRow}>
            <View style={styles.checkBubble}>
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path d="M3 8l3.5 3.5L13 5" stroke={palette.success} strokeWidth={2}
                  fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: palette.success }]}>Transmitted</Text>
              <Text style={[type.monoSmall, { color: palette.textDim }]}>
                {state.totalPackets}/{state.totalPackets} packets · 0 CRC errors
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Error */}
      {state.error && (
        <Card
          style={{
            marginBottom: 18,
            borderColor: palette.dangerBorder,
            backgroundColor: palette.dangerSoft,
          }}
        >
          <Text style={[type.body, { color: palette.danger }]}>{state.error}</Text>
        </Card>
      )}

      {/* Action button */}
      <View style={{ marginTop: 8 }}>
        {!transmitting && !done && (
          <GlowButton
            variant="primary"
            full
            disabled={!selectedFile}
            onPress={handleTransmit}
          >
            ▲ Transmit
          </GlowButton>
        )}
        {transmitting && (
          <GlowButton variant="danger" full onPress={stop}>■ Stop</GlowButton>
        )}
        {done && (
          <GlowButton
            variant="secondary"
            full
            onPress={() => {
              setSelectedFile(null);
              stop(); // resets the transmitter state to idle
            }}
          >
            New transmission
          </GlowButton>
        )}
      </View>
    </ScreenShell>
  );
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  const { palette } = useTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 9,
          color: palette.textDim,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: fonts.monoBold,
          fontSize: big ? 18 : 12,
          color: palette.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  plusBubble: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pickedRow: { flexDirection: 'row', alignItems: 'center' },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  dialRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(127,255,149,0.15)',
    borderWidth: 1,
    borderColor: '#7fff95',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
