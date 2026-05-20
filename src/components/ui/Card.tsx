import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, space } from '../../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  strong?: boolean;
  /** Use a tinted accent background instead of neutral card bg. */
  accentTint?: boolean;
  /** Add a 1px accent border when true. */
  accentBorder?: boolean;
}

export default function Card({
  children,
  style,
  padded = true,
  strong = false,
  accentTint = false,
  accentBorder = false,
}: CardProps) {
  const { accent, palette } = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: accentTint ? accent.soft : strong ? palette.bgCardStrong : palette.bgCard,
          borderColor: accentBorder ? accent.base : palette.border,
          padding: padded ? space.cardPad : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderWidth: 1,
  },
});
