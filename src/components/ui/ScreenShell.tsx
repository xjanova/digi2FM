import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { space } from '../../theme/tokens';

interface Props {
  children: React.ReactNode;
  /** Top padding override (defaults to 24). */
  padTop?: number;
}

/** Standard scrollable screen body with the soft accent gradient at the top. */
export default function ScreenShell({ children, padTop = space.screenPadTop }: Props) {
  const { accent, palette } = useTheme();
  return (
    <View style={[styles.bg, { backgroundColor: palette.bgDeep }]}>
      {/* faint accent wash at the top — emulates radial-gradient */}
      <View pointerEvents="none" style={[styles.wash, { backgroundColor: accent.soft }]} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingTop: padTop,
          paddingHorizontal: space.screenPadH,
          paddingBottom: space.screenPadBot,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, position: 'relative' },
  flex: { flex: 1 },
  wash: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 200,
    opacity: 0.6,
  },
});
