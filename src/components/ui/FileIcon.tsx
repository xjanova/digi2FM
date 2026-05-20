import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, palette as pal, radius } from '../../theme/tokens';

interface Props {
  /** Filename or extension; "photo.jpg" or "jpg" both work. */
  kind?: string;
  size?: number;
}

function classify(kind: string | undefined): { label: string; color: string } {
  const raw = (kind ?? 'doc').toLowerCase();
  const ext = raw.includes('.') ? raw.split('.').pop()! : raw;
  if (['pdf'].includes(ext))                                       return { label: 'PDF', color: pal.fileColorPdf };
  if (['jpg','jpeg','png','gif','heic','webp'].includes(ext))      return { label: 'IMG', color: pal.fileColorImg };
  if (['mp3','wav','m4a','flac','ogg'].includes(ext))              return { label: 'AUD', color: pal.fileColorAud };
  if (['zip','tar','gz'].includes(ext))                            return { label: 'ZIP', color: pal.fileColorZip };
  return { label: ext.slice(0, 3).toUpperCase(), color: '' };
}

/**
 * Geometric file thumbnail (no emoji). Width = size, height = size * 1.2.
 * Folded-corner notch in top-right is rendered as a deep-bg square with two
 * adjacent borders that match the extension color.
 */
export default function FileIcon({ kind, size = 36 }: Props) {
  const { accent, palette } = useTheme();
  const { label, color } = classify(kind);
  const accentColor = color || accent.base;
  const w = size;
  const h = Math.round(size * 1.2);

  return (
    <View
      style={[
        styles.card,
        {
          width: w,
          height: h,
          borderColor: accentColor,
        },
      ]}
    >
      {/* folded corner */}
      <View
        style={[
          styles.notch,
          {
            backgroundColor: palette.bgDeep,
            borderLeftColor: accentColor,
            borderBottomColor: accentColor,
          },
        ]}
      />
      <Text
        style={[
          styles.code,
          { color: accentColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderRadius: radius.file,
    justifyContent: 'flex-end',
    padding: 4,
    overflow: 'hidden',
  },
  notch: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 4,
  },
  code: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    letterSpacing: 0.4,
  },
});
