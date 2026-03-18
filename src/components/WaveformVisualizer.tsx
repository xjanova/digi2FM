import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface Props {
  isActive: boolean;
  barCount?: number;
}

export default function WaveformVisualizer({ isActive, barCount = 20 }: Props) {
  const animations = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (isActive) {
      const animList = animations.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.3 + Math.random() * 0.7,
              duration: 200 + Math.random() * 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.1 + Math.random() * 0.3,
              duration: 200 + Math.random() * 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        )
      );
      animList.forEach(a => a.start());
      return () => animList.forEach(a => a.stop());
    } else {
      animations.forEach(anim => anim.setValue(0.2));
    }
  }, [isActive]);

  return (
    <View style={styles.container}>
      {animations.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              transform: [{ scaleY: anim }],
              backgroundColor: isActive ? '#00d4ff' : '#333',
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 3,
    marginVertical: 16,
  },
  bar: {
    width: 6,
    height: 60,
    borderRadius: 3,
  },
});
