import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts as useGrotesk,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';
import {
  useFonts as useMono,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  useFonts as useSerif,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';

import AppNavigator from './src/navigation/AppNavigator';
import { SettingsProvider } from './src/context/SettingsContext';
import { UpdateProvider } from './src/context/UpdateContext';
import UpdateModal from './src/components/UpdateModal';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function ThemedRoot() {
  const { palette, accent } = useTheme();

  const [groteskOk] = useGrotesk({
    SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold,
  });
  const [monoOk] = useMono({
    JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_600SemiBold,
  });
  const [serifOk] = useSerif({ InstrumentSerif_400Regular_Italic });

  const ready = groteskOk && monoOk && serifOk;

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.bgDeep,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={accent.base} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bgDeep }}>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: accent.base,
            background: palette.bgDeep,
            card: palette.bgDeep,
            text: palette.text,
            border: palette.border,
            notification: accent.base,
          },
          // RN Navigation 7 requires `fonts` in the Theme; minimal stub.
          fonts: {
            regular: { fontFamily: 'SpaceGrotesk_400Regular', fontWeight: '400' },
            medium:  { fontFamily: 'SpaceGrotesk_500Medium',  fontWeight: '500' },
            bold:    { fontFamily: 'SpaceGrotesk_600SemiBold', fontWeight: '600' },
            heavy:   { fontFamily: 'SpaceGrotesk_600SemiBold', fontWeight: '700' },
          },
        }}
      >
        <StatusBar style="light" />
        <AppNavigator />
        {/* Modal renders on top of navigator; consumes UpdateContext. */}
        <UpdateModal />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    // SafeAreaProvider must wrap everything so child screens / headers can
    // read insets for notches and bottom home bars.
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <UpdateProvider>
            <ThemedRoot />
          </UpdateProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
