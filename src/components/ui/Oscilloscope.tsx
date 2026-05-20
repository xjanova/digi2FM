import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

interface Props {
  active?: boolean;
  height?: number;
}

// One bit period = 1/6 of screen width.
const FRAME_MS = 1000 / 30; // 30 fps is plenty for FSK-look
const SAMPLES = 80;          // path resolution

/**
 * Animated FSK waveform on a tinted glassy panel with grid + corner labels.
 *
 * Built on react-native-svg (not Skia, since we don't ship that dependency).
 * 30fps is enough for the "live scope" look without burning battery.
 */
export default function Oscilloscope({ active = false, height = 140 }: Props) {
  const { accent, palette } = useTheme();
  const [w, setW] = useState(0);
  const tRef = useRef(0);
  const [tick, setTick] = useState(0);

  // Sweep overlay slides L→R, 2.4s linear loop (only when active).
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      tRef.current += active ? 0.06 : 0.01;
      setTick((n) => (n + 1) % 1_000_000);
    }, FRAME_MS);
    return () => clearInterval(iv);
  }, [active]);

  useEffect(() => {
    if (!active) {
      sweep.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 2400, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, [active, sweep]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // Build the FSK path. (`tick` is a dependency to force re-render each frame.)
  const path = (() => {
    if (w <= 0) return '';
    const t = tRef.current;
    const amp = active ? height * 0.32 : height * 0.04;
    const cy = height / 2;
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const x = (i / SAMPLES) * w;
      const px = x / w;
      const bit = Math.floor(px * 6 + t * 0.3) % 2;
      const freq = bit === 0 ? 0.04 : 0.075;
      const wobble = active ? Math.sin(x * 0.005 + t) * 1.5 : 0;
      const y = cy + Math.sin(x * freq + t * (active ? 2.5 : 0.5)) * amp + wobble;
      d += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    // Silence the "unused" warning when active is false.
    void tick;
    return d;
  })();

  // Grid lines
  const gridStep = 20;
  const cols = w > 0 ? Math.floor(w / gridStep) : 0;
  const rows = Math.floor(height / gridStep);

  const sweepLeft = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-w * 0.4, w],
  });

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.wrap,
        { height, borderColor: palette.border, backgroundColor: 'rgba(0,0,0,0.4)' },
      ]}
    >
      {/* radial tint */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: accent.soft, opacity: 0.5 }]}
      />

      {w > 0 && (
        <Svg width={w} height={height}>
          <Defs>
            <LinearGradient id="scopeGlow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={accent.base} stopOpacity={0} />
              <Stop offset="0.5" stopColor={accent.base} stopOpacity={0.35} />
              <Stop offset="1" stopColor={accent.base} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* grid */}
          {Array.from({ length: cols }).map((_, i) => (
            <Line key={`v${i}`} x1={i * gridStep} y1={0} x2={i * gridStep} y2={height}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {Array.from({ length: rows }).map((_, i) => (
            <Line key={`h${i}`} x1={0} y1={i * gridStep} x2={w} y2={i * gridStep}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {/* center line */}
          <Line x1={0} y1={height / 2} x2={w} y2={height / 2}
            stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

          {/* waveform */}
          <Path d={path} stroke={accent.base} strokeWidth={1.6} fill="none" />
        </Svg>
      )}

      {/* sweep overlay (rendered as a tinted gradient rect that slides) */}
      {active && w > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: w * 0.4,
            left: sweepLeft,
          }}
        >
          <Svg width="100%" height="100%">
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#scopeGlow)" />
          </Svg>
        </Animated.View>
      )}

      {/* corner labels */}
      <Text style={[styles.cornerTL, type.monoTiny, { color: 'rgba(255,255,255,0.4)' }]}>
        SCOPE · CH1 {active ? '· LIVE' : '· STBY'}
      </Text>
      <Text style={[styles.cornerTR, type.monoTiny, { color: 'rgba(255,255,255,0.4)' }]}>
        44.1kHz · 16b
      </Text>
      <Text style={[styles.cornerBL, type.monoTiny, { color: accent.base }]}>
        ▲ MARK 1200Hz
      </Text>
      <Text style={[styles.cornerBR, type.monoTiny, { color: palette.warm }]}>
        ▼ SPACE 2200Hz
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cornerTL: { position: 'absolute', top: 8, left: 10, textTransform: 'uppercase' },
  cornerTR: { position: 'absolute', top: 8, right: 10 },
  cornerBL: { position: 'absolute', bottom: 8, left: 10, textTransform: 'uppercase' },
  cornerBR: { position: 'absolute', bottom: 8, right: 10, textTransform: 'uppercase' },
});
