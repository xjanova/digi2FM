import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabId = 'Session' | 'Send' | 'Receive' | 'Settings';

/** Inline SVG icons for the bottom tab bar. */
export default function TabBarIcon({ id, color, size = 22 }: { id: TabId; color: string; size?: number }) {
  switch (id) {
    case 'Session':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth={1.6} />
          <Circle cx="18" cy="12" r="3" stroke={color} strokeWidth={1.6} />
          <Path d="M9 12h6" stroke={color} strokeWidth={1.6} strokeDasharray="2 2" />
        </Svg>
      );
    case 'Send':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 4 v14 m0 -14 l-5 5 m5 -5 l5 5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5 20 h14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    case 'Receive':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 20 V6 m0 14 l-5 -5 m5 5 l5 -5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5 4 h14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    case 'Settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.6} />
          <Path
            d="M12 3 v3 M12 18 v3 M21 12 h-3 M6 12 H3 M16.5 5.5 l-2 2 M9.5 14.5 l-2 2 M16.5 18.5 l-2 -2 M9.5 9.5 l-2 -2"
            stroke={color} strokeWidth={1.6} strokeLinecap="round"
          />
        </Svg>
      );
  }
}
