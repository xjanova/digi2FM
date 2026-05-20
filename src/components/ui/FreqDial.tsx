import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

interface Props {
  value: number;       // e.g. 1200
  label: string;       // e.g. 'MARK' or 'MARK · 1'
  locked?: boolean;
}

/** Tuner-readout card: small label + status dot, big mono number. */
export default function FreqDial({ value, label, locked = false }: Props) {
  const { accent, palette } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  // Pulse the dot when unlocked (warm amber, ~0.9s breath).
  useEffect(() => {
    if (locked) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [locked, opacity]);

  const dotColor = locked ? palette.success : palette.warm;

  return (
    <View style={[styles.card, { borderColor: palette.border }]}>
      <View style={styles.head}>
        <Text style={[type.monoTiny, { color: palette.textDim, textTransform: 'uppercase' }]}>
          {label}
        </Text>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: dotColor, shadowColor: dotColor, opacity },
          ]}
        />
      </View>
      <View style={styles.numberRow}>
        <Text style={[type.dialNumber, { color: accent.base }]}>
          {String(value).padStart(4, '0')}
        </Text>
        <Text style={[type.monoSmall, { color: palette.textDim, marginLeft: 4 }]}>Hz</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
