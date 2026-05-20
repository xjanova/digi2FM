import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';

interface Props {
  children: React.ReactNode;
  /** Optional right-aligned slot (mono chip etc.). */
  right?: React.ReactNode;
  marginTop?: number;
}

export default function SectionLabel({ children, right, marginTop = 4 }: Props) {
  const { palette } = useTheme();
  return (
    <View style={[styles.row, { marginTop }]}>
      <Text style={[type.eyebrow, { color: palette.textDim }]}>
        {String(children).toUpperCase()}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
});
