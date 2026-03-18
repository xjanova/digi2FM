import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { ProtocolConfig } from '../constants/ProtocolConfig';
import { BaudRate, ErrorCorrectionMode } from '../types';
import { useSettings } from '../context/SettingsContext';

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();

  const baudRates = ProtocolConfig.BAUD_RATES;
  const ecModes: { value: ErrorCorrectionMode; label: string; desc: string }[] = [
    { value: 'none', label: 'None', desc: 'No error correction, fastest' },
    { value: 'repetition', label: 'Repetition (3x)', desc: 'Each bit sent 3 times, 1/3 speed' },
    { value: 'hamming', label: 'Hamming(7,4)', desc: 'Corrects 1-bit errors, 4/7 speed' },
  ];

  const effectiveBaud = (() => {
    let rate: number = settings.baudRate;
    if (settings.errorCorrection === 'repetition') rate = Math.round(rate / 3);
    if (settings.errorCorrection === 'hamming') rate = Math.round((rate * 4) / 7);
    return rate;
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Baud Rate */}
      <Text style={styles.sectionTitle}>Baud Rate</Text>
      <View style={styles.optionGroup}>
        {baudRates.map((rate) => (
          <TouchableOpacity
            key={rate}
            style={[
              styles.option,
              settings.baudRate === rate && styles.optionSelected,
            ]}
            onPress={() => updateSettings({ baudRate: rate })}
          >
            <Text
              style={[
                styles.optionText,
                settings.baudRate === rate && styles.optionTextSelected,
              ]}
            >
              {rate} baud
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error Correction */}
      <Text style={styles.sectionTitle}>Error Correction</Text>
      {ecModes.map((mode) => (
        <TouchableOpacity
          key={mode.value}
          style={[
            styles.ecOption,
            settings.errorCorrection === mode.value && styles.ecOptionSelected,
          ]}
          onPress={() => updateSettings({ errorCorrection: mode.value })}
        >
          <View style={styles.ecRadio}>
            <View
              style={[
                styles.ecRadioDot,
                settings.errorCorrection === mode.value && styles.ecRadioDotSelected,
              ]}
            />
          </View>
          <View style={styles.ecContent}>
            <Text style={styles.ecLabel}>{mode.label}</Text>
            <Text style={styles.ecDesc}>{mode.desc}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Effective Rate */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Effective Speed</Text>
        <Text style={styles.infoValue}>~{effectiveBaud} baud</Text>
        <Text style={styles.infoDetail}>
          ~{Math.round(effectiveBaud / 10)} bytes/sec
        </Text>
      </View>

      {/* Frequencies */}
      <Text style={styles.sectionTitle}>FSK Frequencies</Text>
      <View style={styles.freqInfo}>
        <Text style={styles.freqLabel}>
          Mark (1): {ProtocolConfig.MARK_FREQ} Hz
        </Text>
        <Text style={styles.freqLabel}>
          Space (0): {ProtocolConfig.SPACE_FREQ} Hz
        </Text>
        <Text style={styles.freqDetail}>Bell 202 Standard</Text>
      </View>

      {/* Debug Mode */}
      <View style={styles.switchRow}>
        <View>
          <Text style={styles.switchLabel}>Debug Mode</Text>
          <Text style={styles.switchDesc}>Show raw bit stream and hex dumps</Text>
        </View>
        <Switch
          value={settings.debugMode}
          onValueChange={(v) => updateSettings({ debugMode: v })}
          trackColor={{ false: '#333', true: '#00d4ff55' }}
          thumbColor={settings.debugMode ? '#00d4ff' : '#666'}
        />
      </View>

      {/* About */}
      <View style={styles.aboutBox}>
        <Text style={styles.aboutTitle}>Digi2FM</Text>
        <Text style={styles.aboutText}>
          Digital-to-FM Software Modem
        </Text>
        <Text style={styles.aboutText}>
          Converts files to analog audio signals using FSK modulation,
          similar to dial-up modems from the 1990s.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 24 },
  sectionTitle: {
    color: '#aaa', fontSize: 13, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 10,
  },
  optionGroup: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1, backgroundColor: '#252540', borderRadius: 8,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333',
  },
  optionSelected: { borderColor: '#00d4ff', backgroundColor: '#00d4ff15' },
  optionText: { color: '#999', fontSize: 14, fontWeight: '600' },
  optionTextSelected: { color: '#00d4ff' },
  ecOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#252540',
    borderRadius: 8, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#333',
  },
  ecOptionSelected: { borderColor: '#00d4ff', backgroundColor: '#00d4ff15' },
  ecRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#555', alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  ecRadioDot: { width: 10, height: 10, borderRadius: 5 },
  ecRadioDotSelected: { backgroundColor: '#00d4ff' },
  ecContent: { flex: 1 },
  ecLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ecDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  infoBox: {
    backgroundColor: '#1a2a3a', borderRadius: 12, padding: 16,
    marginTop: 16, alignItems: 'center',
  },
  infoTitle: { color: '#888', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  infoValue: { color: '#00d4ff', fontSize: 28, fontWeight: '700', marginVertical: 4 },
  infoDetail: { color: '#666', fontSize: 13 },
  freqInfo: { backgroundColor: '#252540', borderRadius: 8, padding: 14 },
  freqLabel: { color: '#ccc', fontSize: 14, marginBottom: 4 },
  freqDetail: { color: '#666', fontSize: 12, marginTop: 4 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#252540', borderRadius: 8, padding: 14, marginTop: 24,
  },
  switchLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  switchDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  aboutBox: {
    backgroundColor: '#252540', borderRadius: 12, padding: 16,
    marginTop: 32, alignItems: 'center',
  },
  aboutTitle: { color: '#00d4ff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  aboutText: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
