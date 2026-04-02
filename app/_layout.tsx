import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { onAuthChange, getUserById } from '../src/services/auth';
import { getPortfolio } from '../src/services/firebase';
import { useAppStore } from '../src/store/useAppStore';
import { Colors } from '../src/constants/theme';
import AchievementOverlay from '../src/components/AchievementOverlay';

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface EBState { hasError: boolean; error: Error | null }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CapitalQuest] Uncaught error:', error.message, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: Colors.bg.primary, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ color: Colors.text.primary, fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ color: Colors.text.secondary, fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
            {this.state.error?.message ?? 'An unexpected error occurred. Please try again.'}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

SplashScreen.preventAutoHideAsync();

// Global flag: when true, the auth listener skips navigation (registration flow is in progress)
export let isRegistrationInProgress = false;
export function setRegistrationInProgress(v: boolean) { isRegistrationInProgress = v; }

// Global flag: when true, the auth listener skips navigation (login flow handles its own routing)
export let isLoginInProgress = false;
export function setLoginInProgress(v: boolean) { isLoginInProgress = v; }

export default function RootLayout() {
  const { setUser, setAuthLoading, setShowWelcomePopup, setPortfolio, resetUserData } = useAppStore();

  useEffect(() => {
    let previousUid: string | null = null;
    const unsub = onAuthChange(async (session: unknown) => {
      const s = session as { uid?: string } | null;
      if (s?.uid) {
        // Reset all user-specific data when switching to a different account
        if (previousUid && previousUid !== s.uid) {
          resetUserData();
        }
        previousUid = s.uid;
        const userData = await getUserById(s.uid);
        setUser(userData as import('../src/types').User);
        // Load saved settings from Firestore
        const ud = userData as Record<string, unknown> | null;
        if (ud?.settings) {
          const saved = ud.settings as Record<string, unknown>;
          if (saved.appColorMode) useAppStore.setState({ appColorMode: saved.appColorMode as 'dark' | 'light' });
          if (saved.appAccentColor) useAppStore.setState({ appAccentColor: saved.appAccentColor as string });
          if (saved.appTileStyle) useAppStore.setState({ appTileStyle: saved.appTileStyle as 'default' | 'vivid' | 'glass' });
          if (saved.appTabColors) useAppStore.setState({ appTabColors: saved.appTabColors as Record<string, string> });
        }
        // Load portfolio from Firestore so holdings persist across sessions
        try {
          const portfolio = await getPortfolio(s.uid);
          if (portfolio && (portfolio as Record<string, unknown>).holdings) {
            setPortfolio(portfolio as import('../src/types').Portfolio);
            // Save daily snapshot for weekly email chart
            const p = portfolio as import('../src/types').Portfolio;
            import('../src/services/firebase').then(({ savePortfolioSnapshot }) => {
              savePortfolioSnapshot(s.uid, p.totalValue, p.cashBalance, p.totalGainLoss ?? 0, p.totalGainLossPercent ?? 0).catch(() => {});
            });
          }
        } catch (err) {
          console.warn('[CQ] Portfolio load failed, will retry via listener:', err);
        }
        // If registration or login flow is in progress, don't navigate — let the flow handle it
        if (isRegistrationInProgress || isLoginInProgress) {
          setAuthLoading(false);
          return;
        }

        const ud2 = userData as Record<string, unknown> | null;
        // Check if this is an existing user (has username OR createdAt)
        const isExistingUser = ud2 && (ud2.username || ud2.createdAt);

        if (isExistingUser) {
          // Existing user signing in — ALWAYS go straight to dashboard
          if (!ud2!.onboardingComplete) {
            import('../src/services/auth').then(({ updateUser }) => {
              updateUser(s.uid, { onboardingComplete: true }).catch(() => {});
            });
          }
          if (!ud2!.welcomeShown) {
            setShowWelcomePopup(true);
          }
          router.replace('/(app)/dashboard');
        } else {
          // Brand new account — no user doc yet, send to onboarding
          router.replace('/(auth)/setup');
        }
      } else {
        resetUserData();
        setUser(null);
        previousUid = null;
        router.replace('/(auth)/welcome');
      }
      setAuthLoading(false);
      await SplashScreen.hideAsync();
    });
    return unsub as () => void;
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg.primary }}>
        <StatusBar style="light" backgroundColor={Colors.bg.primary} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg.primary } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <Toast />
        <AchievementOverlay />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
