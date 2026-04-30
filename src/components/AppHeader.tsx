import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../store/useAppStore';
import { Colors, LightColors, FontSize, FontWeight, Spacing } from '../constants/theme';

// Static require so Metro bundles the asset alongside the JS bundle.
const ROOKIE_MARKETS_LOGO = require('../../assets/rookie-markets-logo.png');

interface AppHeaderProps {
  /** Screen name shown on the left */
  title: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  const {
    notifications, unreadCount,
    appColorMode,
    isSidebarOpen, setSidebarOpen,
  } = useAppStore();

  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;

  const unreadNotifs =
    notifications.filter(n => !n.read).length + (unreadCount ?? 0);

  return (
    <View style={[styles.header, { backgroundColor: C.bg.primary, borderBottomColor: C.border.default }]}>
      {/* Left: logo + wordmark — taps go to dashboard */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/dashboard' as never)}
        activeOpacity={0.7}
        style={styles.logoTouchable}
        accessibilityRole="link"
        accessibilityLabel="Rookie Markets home"
      >
        <Image
          source={ROOKIE_MARKETS_LOGO}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={[styles.logoWordmark, { color: C.text.primary }]}>
          Rookie Markets
        </Text>
      </TouchableOpacity>

      {/* Right: bell → hamburger */}
      <View style={styles.right}>

        {/* 🔔 Bell */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(app)/notifications' as never)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconEmoji}>🔔</Text>
          {unreadNotifs > 0 && <View style={[styles.notifDot, { borderColor: C.bg.primary }]} />}
        </TouchableOpacity>

        {/* ☰ Sidebar toggle */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setSidebarOpen(!isSidebarOpen)}
          activeOpacity={0.7}
        >
          {isSidebarOpen ? (
            <Text style={[styles.closeText, { color: C.text.secondary }]}>✕</Text>
          ) : (
            <View style={styles.hamburger}>
              <View style={[styles.hLine, { backgroundColor: C.text.secondary }]} />
              <View style={[styles.hLine, { width: 14, backgroundColor: C.text.secondary }]} />
              <View style={[styles.hLine, { backgroundColor: C.text.secondary }]} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  logoTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Square R-icon logo, sized to match the old text logo height.
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  logoWordmark: {
    fontSize: 18,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // Icon buttons
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconEmoji: { fontSize: 20 },
  closeText: { color: Colors.text.secondary, fontSize: 20 },

  // Notification dot
  notifDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.market.loss,
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },

  // Hamburger lines
  hamburger: { gap: 4, alignItems: 'flex-end' },
  hLine: {
    width: 20,
    height: 2,
    backgroundColor: Colors.text.secondary,
    borderRadius: 2,
  },
});
