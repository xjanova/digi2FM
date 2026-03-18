import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  progress: number; // 0-1
  label?: string;
}

export default function ProgressBar({ progress, label }: Props) {
  const percentage = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%` }]} />
      </View>
      <Text style={styles.percentage}>{percentage}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 12,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 4,
  },
  track: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#00d4ff',
    borderRadius: 4,
  },
  percentage: {
    color: '#00d4ff',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
});
