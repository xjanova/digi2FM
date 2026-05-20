import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import SessionScreen from '../screens/SessionScreen';
import SendScreen from '../screens/SendScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import TabBarIcon, { TabId } from '../components/ui/TabBarIcon';

const Tab = createBottomTabNavigator();

const SHORT_LABELS: Record<TabId, string> = {
  Session: 'SESS',
  Send: 'TX',
  Receive: 'RX',
  Settings: 'CFG',
};

/** Custom app header bar — shows brand mark + Bell·202 status. */
function AppHeader() {
  const { accent, palette } = useTheme();
  // Respect the notch / status bar so the header sits below the system UI
  // on iPhones with a Dynamic Island and Android devices with a punch-hole.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 20,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        backgroundColor: 'rgba(0,0,0,0.3)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 22, height: 22, borderRadius: 6,
            backgroundColor: accent.soft,
            borderWidth: 1, borderColor: accent.base,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Svg width={10} height={10} viewBox="0 0 12 12">
            <Path d="M1 6 c1.5 -2 4 -2 5 0 s3.5 2 5 0" stroke={accent.base}
              strokeWidth={1.4} fill="none" strokeLinecap="round" />
          </Svg>
        </View>
        <Text style={{
          fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 0.8, color: palette.text,
        }}>
          digi2fm
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: palette.success,
            shadowColor: palette.success,
            shadowOpacity: 0.7,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
            elevation: 2,
          }}
        />
        <Text style={{
          fontFamily: fonts.mono, fontSize: 10, color: palette.textDim, letterSpacing: 1.0,
        }}>
          BELL·202
        </Text>
      </View>
    </View>
  );
}

/** Single source of truth for the per-screen tab options. */
function makeTabOptions(id: TabId, accentColor: string, dimColor: string) {
  return {
    headerShown: false,
    tabBarShowLabel: true,
    tabBarLabel: ({ focused }: { focused: boolean }) => (
      <Text
        style={{
          fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.4,
          color: focused ? accentColor : dimColor,
          marginTop: 2,
        }}
      >
        {SHORT_LABELS[id]}
      </Text>
    ),
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabBarIcon id={id} color={focused ? accentColor : dimColor} />
    ),
  };
}

export default function AppNavigator() {
  const { accent, palette } = useTheme();
  // Bottom inset for devices with a home indicator (iPhone X+) / gesture
  // nav bar — pad the tab bar so labels don't sit under it.
  const insets = useSafeAreaInsets();
  return (
    <>
      <AppHeader />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: accent.base,
          tabBarInactiveTintColor: palette.textDim,
          tabBarStyle: {
            backgroundColor: 'rgba(7,9,14,0.95)',
            borderTopColor: palette.border,
            borderTopWidth: 1,
            paddingTop: 8,
            paddingBottom: Math.max(12, insets.bottom),
            height: 56 + Math.max(12, insets.bottom),
          },
        }}
      >
        <Tab.Screen
          name="Session"
          component={SessionScreen}
          options={makeTabOptions('Session', accent.base, palette.textDim)}
        />
        <Tab.Screen
          name="Send"
          component={SendScreen}
          options={makeTabOptions('Send', accent.base, palette.textDim)}
        />
        <Tab.Screen
          name="Receive"
          component={ReceiveScreen}
          options={makeTabOptions('Receive', accent.base, palette.textDim)}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={makeTabOptions('Settings', accent.base, palette.textDim)}
        />
      </Tab.Navigator>
    </>
  );
}
