import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSettings } from '../context/SettingsContext';
import { useUpdate } from '../context/UpdateContext';
import { useTheme } from '../theme/ThemeContext';
import { ProtocolConfig } from '../constants/ProtocolConfig';
import { ErrorCorrectionMode } from '../types';
import { PhosphorTheme, THEME_ACCENTS, fonts, radius, space, type } from '../theme/tokens';

import ScreenShell from '../components/ui/ScreenShell';
import ScreenHeader from '../components/ui/ScreenHeader';
import SectionLabel from '../components/ui/SectionLabel';
import Card from '../components/ui/Card';
import GlowButton from '../components/ui/GlowButton';
import FreqDial from '../components/ui/FreqDial';
import Toggle from '../components/ui/Toggle';

interface EcOption {
  value: ErrorCorrectionMode;
  label: string;
  desc: string;
  mult: string;
}

const EC_MODES: EcOption[] = [
  { value: 'none',       label: 'None',           desc: 'Fastest · no correction',  mult: '1.0×'  },
  { value: 'repetition', label: 'Repetition 3×',  desc: 'Each bit sent 3 times',    mult: '0.33×' },
  { value: 'hamming',    label: 'Hamming (7,4)',  desc: 'Corrects 1-bit errors',    mult: '0.57×' },
];

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { accent, palette, theme: currentTheme, setTheme } = useTheme();
  const { phase: updatePhase, currentVersion, latest, check } = useUpdate();

  // Map the update phase to a human-readable status line + state color.
  const updateBusy = updatePhase === 'checking' || updatePhase === 'downloading';
  const updateIsError = updatePhase === 'error';
  const updateStatus = ((): string | null => {
    switch (updatePhase) {
      case 'checking':    return 'Checking for updates…';
      case 'available':   return `Version ${latest?.version ?? ''} is available`;
      case 'downloading': return 'Downloading update…';
      case 'upToDate':    return 'You are on the latest version';
      case 'error':       return 'Update check failed — tap Check Now to retry';
      default:            return null;
    }
  })();
  const updateStatusColor = updateIsError
    ? palette.danger
    : updatePhase === 'upToDate'
      ? palette.success
      : updatePhase === 'available'
        ? accent.base
        : palette.textDim;

  // Effective payload baud after error-correction overhead.
  const effectiveBaud = (() => {
    let r: number = settings.baudRate;
    if (settings.errorCorrection === 'repetition') r = Math.round(r / 3);
    if (settings.errorCorrection === 'hamming')    r = Math.round((r * 4) / 7);
    return r;
  })();
  const bytesPerSec = Math.max(1, Math.round(effectiveBaud / ProtocolConfig.BITS_PER_BYTE));
  const kbTime = Math.ceil(1024 / bytesPerSec);

  return (
    <ScreenShell>
      <ScreenHeader
        eyebrow="04 · SETTINGS"
        titlePre="Configure "
        titleAccent="modem"
      />

      {/* ── Baud rate ─────────────────────────────────────────── */}
      <SectionLabel
        right={
          <Text style={[type.monoTiny, { color: palette.textDim }]}>BITS/SEC</Text>
        }
      >
        Baud rate
      </SectionLabel>
      <View style={[styles.segWrap, { borderColor: palette.border }]}>
        {ProtocolConfig.BAUD_RATES.map((rate) => {
          const isOn = settings.baudRate === rate;
          return (
            <Pressable
              key={rate}
              onPress={() => updateSettings({ baudRate: rate })}
              style={[
                styles.segCell,
                {
                  backgroundColor: isOn ? accent.soft : 'transparent',
                  borderColor: isOn ? accent.base : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.monoBold,
                  fontSize: 14,
                  color: isOn ? accent.base : palette.textMute,
                }}
              >
                {rate}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Effective throughput tuner card ───────────────────── */}
      <View
        style={[
          styles.tuner,
          { borderColor: accent.base, backgroundColor: 'rgba(0,0,0,0.4)' },
        ]}
      >
        {/* faint accent backdrop */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: accent.soft, opacity: 0.7 }]}
        />
        <Text style={[type.monoTiny, { color: palette.textDim, marginBottom: 6 }]}>
          EFFECTIVE THROUGHPUT
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={[type.monoBig, { color: accent.base }]}>{effectiveBaud}</Text>
          <Text style={{
            fontFamily: fonts.mono, fontSize: 14, marginLeft: 6, color: palette.textDim,
          }}>
            baud
          </Text>
        </View>
        <Text style={[type.monoSmall, { color: palette.textMute, marginTop: 4 }]}>
          ≈ {bytesPerSec} B/s · 1 KB in ~{kbTime}s
        </Text>
        {/* tuner ticks */}
        <View style={styles.tickRow}>
          {Array.from({ length: 60 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 1,
                height: 6,
                backgroundColor: accent.base,
                opacity: 0.4,
                marginRight: 5,
              }}
            />
          ))}
        </View>
      </View>

      {/* ── Error correction ──────────────────────────────────── */}
      <SectionLabel>Error correction</SectionLabel>
      {EC_MODES.map((m) => {
        const isOn = settings.errorCorrection === m.value;
        return (
          <Pressable
            key={m.value}
            onPress={() => updateSettings({ errorCorrection: m.value })}
            style={[
              styles.ecRow,
              {
                backgroundColor: isOn ? accent.soft : palette.bgCard,
                borderColor: isOn ? accent.base : palette.border,
              },
            ]}
          >
            {/* radio */}
            <View
              style={[
                styles.radioOuter,
                { borderColor: isOn ? accent.base : palette.borderStrong },
              ]}
            >
              {isOn && (
                <View
                  style={[
                    styles.radioInner,
                    { backgroundColor: accent.base, shadowColor: accent.base },
                  ]}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: palette.text }]}>{m.label}</Text>
              <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
                {m.desc}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                color: isOn ? accent.base : palette.textDim,
              }}
            >
              {m.mult}
            </Text>
          </Pressable>
        );
      })}

      {/* ── Frequencies (locked) ─────────────────────────────── */}
      <SectionLabel
        right={<Text style={[type.monoTiny, { color: palette.textDim }]}>BELL 202</Text>}
      >
        FSK frequencies
      </SectionLabel>
      <Card style={{ marginBottom: 22 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <FreqDial value={settings.markFreq} label="MARK · 1" locked />
          <FreqDial value={settings.spaceFreq} label="SPACE · 0" locked />
        </View>
        <Text style={[type.monoTiny, { color: palette.textDim, marginTop: 12 }]}>
          SAMPLE RATE 44.1 KHZ · 16-BIT · GOERTZEL DEMODULATION
        </Text>
      </Card>

      {/* ── Encryption ────────────────────────────────────────── */}
      <SectionLabel
        right={
          <Text
            style={[
              type.monoTiny,
              { color: settings.encryptionEnabled ? palette.success : palette.textDim },
            ]}
          >
            {settings.encryptionEnabled ? '● ACTIVE' : '○ OFF'}
          </Text>
        }
      >
        Encryption
      </SectionLabel>
      <Card style={{ marginBottom: settings.encryptionEnabled ? 8 : 22 }}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: palette.text }]}>Pre-shared key</Text>
            <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
              XSalsa20-Poly1305
            </Text>
          </View>
          <Toggle
            value={settings.encryptionEnabled}
            onValueChange={(v) => updateSettings({ encryptionEnabled: v })}
          />
        </View>
      </Card>
      {settings.encryptionEnabled && (
        <Card style={{ marginBottom: 22 }}>
          <Text style={[type.monoTiny, {
            color: palette.textDim, marginBottom: 8, textTransform: 'uppercase',
          }]}>
            PASSPHRASE
          </Text>
          <TextInput
            value={settings.encryptionPassphrase}
            onChangeText={(text) => updateSettings({ encryptionPassphrase: text })}
            placeholder="enter shared secret"
            placeholderTextColor={palette.textDim}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: radius.toggle,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontFamily: fonts.mono,
              fontSize: 14,
              letterSpacing: 4,
              color: accent.base,
            }}
          />
          <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 8 }]}>
            Both devices must use the exact same passphrase
          </Text>
        </Card>
      )}

      {/* ── Debug ─────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 22 }}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: palette.text }]}>Debug mode</Text>
            <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
              Show raw bit stream & hex dumps
            </Text>
          </View>
          <Toggle
            value={settings.debugMode}
            onValueChange={(v) => updateSettings({ debugMode: v })}
          />
        </View>
      </Card>

      {/* ── App updates ──────────────────────────────────────── */}
      <SectionLabel
        right={
          <Text style={[type.monoTiny, { color: palette.textDim }]}>
            V{currentVersion}
          </Text>
        }
      >
        App updates
      </SectionLabel>
      <Card style={{ marginBottom: 22 }}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: palette.text }]}>
              Check for updates
            </Text>
            <Text style={[type.monoSmall, { color: palette.textDim, marginTop: 2 }]}>
              Pull latest APK from GitHub releases
            </Text>
          </View>
          <GlowButton
            variant={updatePhase === 'available' ? 'primary' : 'secondary'}
            disabled={updateBusy}
            onPress={() => check()}
          >
            {updatePhase === 'checking'    ? 'Checking…'
              : updatePhase === 'downloading' ? 'Downloading…'
              : updatePhase === 'available'   ? 'Update available'
              : 'Check now'}
          </GlowButton>
        </View>
        {updateStatus && (
          <Text
            style={[
              type.monoSmall,
              {
                color: updateStatusColor,
                marginTop: 10,
                letterSpacing: 0.6,
              },
            ]}
          >
            {updateStatus}
          </Text>
        )}
      </Card>

      {/* ── Phosphor theme ───────────────────────────────────── */}
      <SectionLabel
        right={<Text style={[type.monoTiny, { color: palette.textDim }]}>5 COLORS</Text>}
      >
        Phosphor theme
      </SectionLabel>
      <Card style={{ marginBottom: 22 }}>
        {(Object.keys(THEME_ACCENTS) as PhosphorTheme[]).map((t) => {
          const isOn = currentTheme === t;
          const entry = THEME_ACCENTS[t];
          return (
            <Pressable
              key={t}
              onPress={() => setTheme(t)}
              style={[
                styles.themeRow,
                { borderColor: isOn ? entry.base : 'transparent' },
              ]}
            >
              <View
                style={{
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: entry.base,
                  shadowColor: entry.base,
                  shadowOpacity: 0.7, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 2,
                  marginRight: 12,
                }}
              />
              <Text style={[type.body, { flex: 1, color: palette.text }]}>{entry.label}</Text>
              {isOn && (
                <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <Path d="M3 8 l3.5 3.5 L13 5" stroke={entry.base} strokeWidth={2}
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </Pressable>
          );
        })}
      </Card>

      {/* ── About ─────────────────────────────────────────────── */}
      <View
        style={[
          styles.about,
          { borderColor: palette.border, backgroundColor: 'rgba(0,0,0,0.30)' },
        ]}
      >
        <Text style={{
          fontFamily: fonts.monoBold,
          fontSize: 18, color: accent.base, letterSpacing: 0.7,
        }}>
          digi2fm
        </Text>
        <Text style={[type.monoTiny, { color: palette.textDim, marginTop: 4, letterSpacing: 1.4 }]}>
          V1.0.0 · DIGITAL-TO-FM MODEM
        </Text>
        <Text style={{
          fontFamily: fonts.serif,
          fontSize: 14,
          color: palette.textMute,
          marginTop: 12,
          lineHeight: 21,
        }}>
          “Built with sound waves and nostalgia”
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  segWrap: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderRadius: radius.button,
  },
  segCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.toggle,
    borderWidth: 1,
  },
  tuner: {
    marginBottom: 22,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: 18,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  tickRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: 6,
    paddingLeft: 4,
    overflow: 'hidden',
  },
  ecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: radius.button,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.7,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginVertical: 2,
    borderRadius: radius.toggle,
    borderWidth: 1,
  },
  about: {
    marginTop: 6,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radius.card,
    alignItems: 'center',
  },
});
