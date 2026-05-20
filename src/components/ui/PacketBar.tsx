import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';

interface Props {
  /** 0..1 */
  progress: number;
  current: number;
  total: number;
  segments?: number;
}

/** Segmented packet progress (32 cells by default). */
export default function PacketBar({ progress, current, total, segments = 32 }: Props) {
  const { accent, palette } = useTheme();
  const filled = Math.round(Math.max(0, Math.min(1, progress)) * segments);
  const pct = Math.round(progress * 100);
  const totalStr = String(total).padStart(3, '0');
  const currentStr = String(current).padStart(3, '0');

  return (
    <View>
      <View style={styles.head}>
        <Text style={[type.monoSmall, { color: palette.textMute }]}>
          PKT <Text style={{ color: accent.base }}>{currentStr}</Text>
          {' '}/ {totalStr}
        </Text>
        <Text style={[type.monoSmall, { color: accent.base }]}>{pct}%</Text>
      </View>
      <View style={styles.barRow}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 16,
              borderRadius: 1,
              backgroundColor: i < filled ? accent.base : 'rgba(255,255,255,0.06)',
              shadowColor: accent.base,
              shadowOpacity: i < filled ? 0.6 : 0,
              shadowRadius: i < filled ? 4 : 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: i < filled ? 1 : 0,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    gap: 2,
    height: 16,
  },
});
