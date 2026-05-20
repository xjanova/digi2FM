import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import StatusPill, { PillStatus } from './StatusPill';

interface Props {
  eyebrow: string;          // e.g. "01 · SESSION"
  titlePre: string;         // "Two-way "
  titleAccent: string;      // "session" (rendered in mono accent)
  status?: PillStatus;
  statusLabel?: string;
}

/**
 * Top-of-screen header: eyebrow row (label + optional pill) and a serif italic
 * title with a mono accent chip in the middle.
 */
export default function ScreenHeader({
  eyebrow, titlePre, titleAccent, status, statusLabel,
}: Props) {
  const { accent, palette } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[type.eyebrow, { color: palette.textDim, textTransform: 'uppercase' }]}>
          {eyebrow}
        </Text>
        {status && <StatusPill status={status} label={statusLabel} />}
      </View>
      <View style={styles.titleRow}>
        <Text style={[type.titleSerif, { color: palette.text }]} numberOfLines={1}>
          {titlePre}
          <Text style={[type.titleMonoChip, { color: accent.base }]}>{titleAccent}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline' },
});
