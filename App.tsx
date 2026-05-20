import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { SettingsProvider } from './src/context/SettingsContext';
import { UpdateProvider } from './src/context/UpdateContext';
import UpdateModal from './src/components/UpdateModal';

export default function App() {
  return (
    <SettingsProvider>
      <UpdateProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
          <UpdateModal />
        </NavigationContainer>
      </UpdateProvider>
    </SettingsProvider>
  );
}
