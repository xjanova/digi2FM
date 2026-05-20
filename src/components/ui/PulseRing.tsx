import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';

interface Props {
  active?: boolean;
  size?: number;
  label?: string;
}

/**
 * Three concentric expanding rings around a glowing core with a mic icon.
 * Rings: scale 0.8 → 1.8, opacity 0.9 → 0, 2.4s loop, staggered.
 */
export default function PulseRing({ active = true, size = 220, label = 'LISTENING' }: Props) {
  const { accent } = useTheme();

  const rings = useMemo(
    () => [0, 800, 1600].map(() => new Animated.Value(0)),
    []
  );

  // Mic-label breath at 1.6s.
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      rings.forEach((v) => v.setValue(0));
      breath.setValue(1);
      return;
    }

    // IMPORTANT: each ring is its own 2.4s loop; the stagger is a *one-shot*
    // setTimeout that delays the start. Putting Animated.delay inside the loop
    // sequence would re-apply on every iteration and the rings would drift
    // (periods 2.4s / 3.2s / 4.0s instead of all 2.4s with offset starts).
    const startedLoops: Animated.CompositeAnimation[] = [];
    const startTimers: ReturnType<typeof setTimeout>[] = rings.map((v, i) =>
      setTimeout(() => {
        const loop = Animated.loop(
          Animated.timing(v, { toValue: 1, duration: 2400, useNativeDriver: true })
        );
        startedLoops.push(loop);
        loop.start();
      }, i * 800)
    );

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    breathLoop.start();

    return () => {
      startTimers.forEach(clearTimeout);
      startedLoops.forEach((l) => l.stop());
      breathLoop.stop();
    };
  }, [active, rings, breath]);

  const coreSize = size * 0.42;
  const iconSize = Math.round(size * 0.18);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {/* expanding rings */}
      {active && rings.map((v, i) => {
        const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.8] });
        const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              { borderColor: accent.base, opacity, transform: [{ scale }] },
            ]}
          />
        );
      })}

      {/* core circle with mic */}
      <View
        style={[
          styles.core,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            borderColor: accent.base,
            backgroundColor: accent.soft,
            shadowColor: accent.base,
          },
        ]}
      >
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <Rect x="9" y="3" width="6" height="12" rx="3" stroke={accent.base} strokeWidth={1.6} />
          <Path d="M5 10 v2 a7 7 0 0 0 14 0 v-2" stroke={accent.base} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Path d="M12 19 v3" stroke={accent.base} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      </View>

      {/* label */}
      <Animated.View style={[styles.labelWrap, { opacity: active ? breath : 1 }]}>
        <Text style={[type.monoSmall, { color: accent.base, letterSpacing: 2.0 }]}>
          ●  {label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 9999,
    borderWidth: 1,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  labelWrap: {
    position: 'absolute',
    bottom: -28,
    width: '100%',
    alignItems: 'center',
  },
});
