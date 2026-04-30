import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle, Polygon, Line } from 'react-native-svg';
import { router } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

const { width, height } = Dimensions.get('window');

const FEATURES = [
  { icon: '📈', title: 'Real-Time Markets', desc: 'Trade with live prices from global exchanges' },
  { icon: '🏆', title: 'Compete & Level Up', desc: 'Climb leaderboards and unlock achievements' },
  { icon: '🤝', title: 'Trading Clubs', desc: 'Form clubs and trade together with friends' },
  { icon: '🐉', title: 'Unlock Rare Avatars & Pets', desc: 'Earn exclusive dragons, pets and cosmetics as you trade' },
];

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[{ flex: 1 }, Platform.OS === 'web' && { height: '100vh' as any }]}>
      {/* Disclaimer banner — web only */}
      {Platform.OS === 'web' && (
        <View style={styles.disclaimerBanner}>
          <Text style={styles.disclaimerText}>
            🎮  THIS IS A GAME ONLY — NO REAL MONEY IS INVOLVED. ALL TRADES ARE VIRTUAL.
          </Text>
        </View>
      )}
    <LinearGradient
      colors={[Colors.bg.primary, '#0D1529', Colors.bg.primary]}
      style={styles.container}
    >
      {/* Glow orb */}
      <View style={styles.orb} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          {/* Hero chart — dips then rockets up */}
          <View style={styles.chartWrapper}>
            <Svg width={260} height={130} viewBox="0 0 260 130">
              <Defs>
                <SvgGrad id="greenFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#00C853" stopOpacity="0.28" />
                  <Stop offset="1" stopColor="#00C853" stopOpacity="0.0" />
                </SvgGrad>
                <SvgGrad id="redFill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FF3D57" stopOpacity="0.0" />
                  <Stop offset="1" stopColor="#FF3D57" stopOpacity="0.22" />
                </SvgGrad>
              </Defs>

              {/* ── Grid lines ── */}
              <Line x1="10" y1="27"  x2="250" y2="27"  stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <Line x1="10" y1="54"  x2="250" y2="54"  stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <Line x1="10" y1="81"  x2="250" y2="81"  stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <Line x1="10" y1="108" x2="250" y2="108" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <Line x1="68"  y1="10" x2="68"  y2="118" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <Line x1="126" y1="10" x2="126" y2="118" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              <Line x1="184" y1="10" x2="184" y2="118" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

              {/* ── Area fills ── */}
              <Path d="M 10,43 L 68,70 L 68,118 L 10,118 Z"        fill="url(#redFill)" />
              <Path d="M 68,70 L 126,44 L 126,118 L 68,118 Z"       fill="url(#greenFill)" />
              <Path d="M 126,44 L 184,112 L 184,118 L 126,118 Z"    fill="url(#redFill)" />
              <Path d="M 184,112 L 248,10 L 248,118 L 184,118 Z"    fill="url(#greenFill)" />

              {/* ── Line 1: down (red) ── */}
              <Path d="M 10,43 L 68,70"   stroke="#FF3D57" strokeWidth="2.5" fill="none" strokeLinecap="square" />
              {/* ── Line 2: up a bit (green) ── */}
              <Path d="M 68,70 L 126,44"  stroke="#00C853" strokeWidth="2.5" fill="none" strokeLinecap="square" />
              {/* ── Line 3: down more (red) ── */}
              <Path d="M 126,44 L 184,112" stroke="#FF3D57" strokeWidth="2.5" fill="none" strokeLinecap="square" />
              {/* ── Line 4: steep up (green) ── */}
              <Path d="M 184,112 L 248,10" stroke="#00C853" strokeWidth="2.5" fill="none" strokeLinecap="square" />

              {/* Junction dots between segments */}
              <Circle cx="68"  cy="70"  r="3" fill="#FF3D57" />
              <Circle cx="126" cy="44"  r="3" fill="#00C853" />
              <Circle cx="184" cy="112" r="3.5" fill="#FF3D57" />
              <Circle cx="184" cy="112" r="7"   fill="#FF3D57" fillOpacity="0.15" />

              {/* Peak dot + glow */}
              <Circle cx="248" cy="10" r="5"  fill="#00C853" />
              <Circle cx="248" cy="10" r="11" fill="#00C853" fillOpacity="0.18" />
              {/* Arrow head */}
              <Polygon points="248,3 242,14 254,14" fill="#00C853" />
            </Svg>
          </View>

          <Text style={styles.appName}>Rookie Markets</Text>
          <Text style={styles.tagline}>Practice. Trade. Prosper.</Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureEmoji}>{f.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.brand.primary, '#0096C7']}
              style={styles.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryButtonText}>Get Started — It's Free</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.ageNote}>Recommended ages 8–18 · No real money involved</Text>

        <TouchableOpacity
          style={styles.modButton}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.location.href = '/moderator-login.html';
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.modButtonText}>🛡️ Moderator Log In</Text>
        </TouchableOpacity>
      </Animated.View>
      </ScrollView>
    </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  disclaimerBanner: {
    backgroundColor: '#F5C518',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  disclaimerText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  orb: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.brand.primary,
    opacity: 0.06,
  },
  content: {
    width: '100%',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: 60,
    paddingBottom: 40,
    gap: 32,
  },
  logoContainer: { alignItems: 'center', gap: 6 },
  chartWrapper: {
    width: 260,
    height: 130,
    marginBottom: 6,
    // subtle border + background so the chart pops
    backgroundColor: 'rgba(0,184,83,0.05)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,200,83,0.15)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FontSize.md,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  features: { gap: 16 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bg.secondary,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: { fontSize: 22 },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  featureDesc: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  buttons: { gap: 12 },
  primaryButton: { borderRadius: Radius.lg, overflow: 'hidden' },
  primaryGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  primaryButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  secondaryButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  ageNote: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  modButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
    alignItems: 'center',
    alignSelf: 'center',
  },
  modButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.tertiary,
    letterSpacing: 0.3,
  },
});
