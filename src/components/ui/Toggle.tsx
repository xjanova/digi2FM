import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ value, onValueChange, disabled }: Props) {
  const { accent, palette } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [anim, value]);

  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 21] });

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      style={[
        styles.track,
        {
          backgroundColor: value ? accent.base : 'rgba(255,255,255,0.10)',
          shadowColor: value ? accent.base : 'transparent',
          shadowOpacity: value ? 0.6 : 0,
          shadowRadius: value ? 8 : 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: value ? 4 : 0,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            left,
            backgroundColor: value ? '#001218' : palette.text,
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
