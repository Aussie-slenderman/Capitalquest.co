import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { initPortfolio, updateUser } from '../../src/services/auth';
import { useAppStore } from '../../src/store/useAppStore';
import { ACHIEVEMENTS, getLevelFromXP } from '../../src/constants/achievements';
import { Colors, FontSize, FontWeight } from '../../src/constants/theme';
import { setRegistrationInProgress } from '../_layout';

const STARTING_BALANCE = 10000;

export default function SetupScreen() {
  const { user, setUser, setShowWelcomePopup } = useAppStore();

  useEffect(() => {
    if (!user) return;
    (async () => {
      // 🛑 CRITICAL SAFETY CHECK
      // setup.tsx was historically called every time it mounted, including
      // for returning users — which wiped their entire portfolio (holdings,
      // cash, gains, trade history) by overwriting the Firestore document
      // with a fresh $10k portfolio. If the user has already completed
      // onboarding, just send them to the dashboard and DO NOT touch their
      // portfolio.
      if (user.onboardingComplete) {
        // Make sure the registration flag is cleared in case we got here
        // via a stale/cached redirect, then bail out.
        setRegistrationInProgress(false);
        router.replace('/(app)/dashboard');
        return;
      }
      try {
        // Belt-and-braces: even for first-time setup, if a portfolio already
        // exists in Firestore (e.g. partial signup, retry after refresh),
        // don't overwrite it. Only init when there's truly no data.
        const { getPortfolio } = await import('../../src/services/auth');
        const existing = await getPortfolio(user.id).catch(() => null);
        if (existing && (existing as any).startingBalance) {
          console.warn('[CQ Setup] Skipping initPortfolio — portfolio already exists for', user.id);
          setRegistrationInProgress(false);
          router.replace('/(app)/dashboard');
          return;
        }
        await initPortfolio(user.id, STARTING_BALANCE);
        // Award first_login achievement
        const firstLoginAch = ACHIEVEMENTS.find(a => a.id === 'first_login');
        const newAchs = firstLoginAch
          ? [{ ...firstLoginAch, unlockedAt: Date.now() }]
          : [];
        const newXP = firstLoginAch ? firstLoginAch.xpReward : 0;
        const newLevel = getLevelFromXP(newXP);
        // Persist onboarding + welcome flag + achievement to DB
        await updateUser(user.id, {
          startingBalance: STARTING_BALANCE,
          onboardingComplete: true,
          welcomeShown: false,
          achievements: newAchs,
          xp: newXP,
          level: newLevel.level,
        });
        setUser({
          ...user,
          startingBalance: STARTING_BALANCE,
          onboardingComplete: true,
          welcomeShown: false,
          achievements: newAchs as any,
          xp: newXP,
          level: newLevel.level,
        });
        if (firstLoginAch) {
          useAppStore.getState().setPendingAchievement({ ...firstLoginAch, unlockedAt: Date.now() } as any);
        }
      } catch {
        // Non-critical — still route to dashboard
      }
      setShowWelcomePopup(true);
      // Registration flow is complete — allow auth listener to navigate again
      setRegistrationInProgress(false);
      router.replace('/(app)/dashboard');
    })();
  }, [user?.id]); // Re-runs if user becomes available after initial mount

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>💰</Text>
      <Text style={styles.title}>Setting Up Your Portfolio</Text>
      <Text style={styles.subtitle}>Starting you off with $10,000</Text>
      <ActivityIndicator color={Colors.brand.primary} size="large" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emoji: { fontSize: 56 },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  spinner: { marginTop: 16 },
});
