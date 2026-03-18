import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TransferStatus } from '../types';

interface Props {
  status: TransferStatus;
}

const STATUS_CONFIG: Record<TransferStatus, { text: string; color: string }> = {
  idle: { text: 'Ready', color: '#666' },
  preparing: { text: 'Preparing...', color: '#ffa500' },
  syncing: { text: 'Syncing...', color: '#ffa500' },
  sending_header: { text: 'Sending Header', color: '#00d4ff' },
  sending_data: { text: 'Transmitting Data', color: '#00d4ff' },
  sending_eof: { text: 'Finalizing', color: '#00d4ff' },
  waiting_sync: { text: 'Waiting for Signal...', color: '#ffa500' },
  receiving_header: { text: 'Receiving Header', color: '#00ff88' },
  receiving_data: { text: 'Receiving Data', color: '#00ff88' },
  reassembling: { text: 'Reassembling File', color: '#00ff88' },
  completed: { text: 'Complete!', color: '#00ff88' },
  error: { text: 'Error', color: '#ff4444' },
};

export default function StatusIndicator({ status }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const config = STATUS_CONFIG[status];
  const isActive = !['idle', 'completed', 'error'].includes(status);

  useEffect(() => {
    if (isActive) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isActive]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: config.color, opacity: pulseAnim },
        ]}
      />
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
