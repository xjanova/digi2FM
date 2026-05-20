import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

export type PillStatus =
  | 'idle' | 'listening' | 'connecting' | 'connected'
  | 'sending' | 'receiving' | 'error';

interface Props {
  status: PillStatus;
  label?: string;
}

export default function StatusPill({ status, label }: Props) {
  const { accent, palette } = useTheme();

  // Color and breath behavior per status.
  const map = {
    idle:       { color: palette.textDim, breath: false },
    listening:  { color: accent.base,     breath: true  },
    connecting: { color: palette.warm,    breath: true  },
    connected:  { color: palette.success, breath: false },
    sending:    { color: accent.base,     breath: true  },
    receiving:  { color: accent.base,     breath: true  },
    error:      { color: palette.danger,  breath: false },
  } as const;
  const conf = map[status];

  // 1.2s breath on the dot when active.
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!conf.breath) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [conf.breath, opacity]);

  return (
    <View style={[styles.pill, { borderColor: palette.border }]}>
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: conf.color,
            shadowColor: conf.color,
            opacity,
          },
        ]}
      />
      <Text
        style={[
          type.monoSmall,
          { color: conf.color, letterSpacing: 1.6, textTransform: 'uppercase' as const },
        ]}
      >
        {label ?? status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 2,
  },
});
