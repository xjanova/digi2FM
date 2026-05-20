import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  active?: boolean;
  count?: number;
  height?: number;
}

/**
 * EQ-style frequency bars. Two gaussian peaks centered at MARK (≈25%) and
 * SPACE (≈63%) of the bar count, animated every 90ms.
 */
export default function SpectrumBars({ active = true, count = 24, height = 60 }: Props) {
  const { accent, palette } = useTheme();
  const [bars, setBars] = useState<number[]>(() => Array(count).fill(0.3));
  const ivRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!active) {
      setBars(Array(count).fill(0.06));
      return;
    }
    const markIdx = Math.round(count * 0.25);
    const spaceIdx = Math.round(count * 0.625);
    ivRef.current = setInterval(() => {
      setBars(() =>
        Array.from({ length: count }, (_, i) => {
          const mark = Math.exp(-Math.pow((i - markIdx) / 2.2, 2)) * (0.7 + Math.random() * 0.3);
          const space = Math.exp(-Math.pow((i - spaceIdx) / 2.2, 2)) * (0.55 + Math.random() * 0.4);
          const noise = Math.random() * 0.12;
          return Math.min(1, Math.max(0.05, mark + space + noise));
        })
      );
    }, 90);
    return () => {
      if (ivRef.current) clearInterval(ivRef.current);
    };
  }, [active, count]);

  const midpoint = Math.floor(count / 2);

  return (
    <View style={[styles.row, { height }]}>
      {bars.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${v * 100}%`,
            backgroundColor: i < midpoint ? accent.base : palette.warm,
            opacity: active ? 0.85 : 0.25,
            borderRadius: 1,
            shadowColor: i < midpoint ? accent.base : palette.warm,
            shadowOpacity: active ? 0.6 : 0,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
            elevation: active ? 1 : 0,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingVertical: 4,
  },
});
