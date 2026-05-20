import React from 'react';
import {
  Pressable, StyleSheet, Text, View, StyleProp, ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';

export type GlowVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  children: string;
  onPress?: () => void;
  variant?: GlowVariant;
  disabled?: boolean;
  full?: boolean;
  /** Optional leading icon (SVG element). */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single tappable button used everywhere. Press feedback is a 0.98 scale
 * + slight glow boost on primary.
 */
export default function GlowButton({
  children, onPress, variant = 'primary', disabled, full, icon, style,
}: Props) {
  const { accent, palette } = useTheme();

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const colors = {
    primary: {
      bg: accent.base,
      fg: '#001218',
      border: 'transparent',
      glow: accent.glow,
    },
    secondary: {
      bg: 'rgba(255,255,255,0.04)',
      fg: palette.text,
      border: palette.borderStrong,
      glow: 'transparent',
    },
    danger: {
      bg: palette.dangerSoft,
      fg: palette.danger,
      border: palette.dangerBorder,
      glow: 'transparent',
    },
    ghost: {
      bg: 'transparent',
      fg: palette.textMute,
      border: palette.border,
      glow: 'transparent',
    },
  }[variant];

  const disabledBg = 'rgba(255,255,255,0.05)';
  const disabledFg = palette.textDim;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: disabled ? disabledBg : colors.bg,
          borderColor: colors.border,
          width: full ? '100%' : undefined,
          alignSelf: full ? 'stretch' : 'flex-start',
          // iOS shadow glow (Android approximates with elevation when primary).
          shadowColor: isPrimary && !disabled ? accent.base : '#000',
          shadowOffset: { width: 0, height: isPrimary ? 0 : 8 },
          shadowOpacity: isPrimary && !disabled ? 0.6 : 0,
          shadowRadius: isPrimary && !disabled ? 16 : 0,
          elevation: isPrimary && !disabled ? 8 : 0,
          opacity: pressed && !disabled ? 0.92 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <View style={styles.inner}>
        {icon}
        <Text
          style={[
            type.buttonLabel,
            { color: disabled ? disabledFg : colors.fg },
          ]}
        >
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
