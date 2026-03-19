import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import SessionScreen from '../screens/SessionScreen';
import SendScreen from '../screens/SendScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const icons: Record<string, string> = {
  Session: '🔗',
  Send: '📡',
  Receive: '📻',
  Settings: '⚙️',
};

const TabIcon = ({ label, color }: { label: string; color: string }) => (
  <Text style={{ color, fontSize: 20 }}>{icons[label] || '?'}</Text>
);

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#e0e0e0',
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#333' },
        tabBarActiveTintColor: '#00d4ff',
        tabBarInactiveTintColor: '#666',
      }}
    >
      <Tab.Screen
        name="Session"
        component={SessionScreen}
        options={{
          title: 'Session',
          tabBarIcon: ({ color }) => <TabIcon label="Session" color={color} />,
        }}
      />
      <Tab.Screen
        name="Send"
        component={SendScreen}
        options={{
          title: 'Send',
          tabBarIcon: ({ color }) => <TabIcon label="Send" color={color} />,
        }}
      />
      <Tab.Screen
        name="Receive"
        component={ReceiveScreen}
        options={{
          title: 'Receive',
          tabBarIcon: ({ color }) => <TabIcon label="Receive" color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon label="Settings" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
