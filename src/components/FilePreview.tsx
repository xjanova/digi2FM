import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SelectedFile } from '../types';
import { formatFileSize, formatDuration } from '../utils/FileUtils';
import { estimateTransferTime } from '../protocol/FileChunker';

interface Props {
  file: SelectedFile;
  baudRate: number;
}

export default function FilePreview({ file, baudRate }: Props) {
  const estimatedTime = estimateTransferTime(file.size, baudRate);

  return (
    <View style={styles.container}>
      <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
      <View style={styles.details}>
        <Text style={styles.detail}>Size: {formatFileSize(file.size)}</Text>
        <Text style={styles.detail}>Type: {file.mimeType}</Text>
        <Text style={styles.detail}>Est. Time: {formatDuration(estimatedTime)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  fileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  details: {
    gap: 4,
  },
  detail: {
    color: '#999',
    fontSize: 13,
  },
});
