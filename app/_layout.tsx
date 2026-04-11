import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { onAuthChange, getUserById } from '../src/services/auth';
import { getPortfolio, getPortfolioHistory } from '../src/services/firebase';
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

// Global flag: when true, login is in progress — prevent auth listener from navigating to welcome
export let isLoginInProgress = false;
export function setLoginInProgress(v: boolean) { isLoginInProgress = v; }


export default function RootLayout() {
  const { setUser, setAuthLoading, setShowWelcomePopup, setPortfolio, resetUserData } = useAppStore();

  useEffect(() => {
    let previousUid: string | null = null;
    let currentCallId = 0; // guard against stale async callbacks
    const unsub = onAuthChange(async (session: unknown) => {
      const callId = ++currentCallId; // each invocation gets a unique ID
      const s = session as { uid?: string } | null;
      if (s?.uid) {
        // Clear login flag — auth confirmed
        isLoginInProgress = false;
        // Reset all user-specific data when switching to a different account
        if (previousUid && previousUid !== s.uid) {
          resetUserData();
        }
        previousUid = s.uid;
        let userData: unknown = null;
        try {
          userData = await getUserById(s.uid);
        } catch (err) {
          console.warn('[CQ] getUserById failed:', err);
        }
        // If Firestore user doc is missing, build a minimal user from auth session
        // so the app is still functional (trade, portfolio, etc.)
        const authSession = session as { uid: string; displayName?: string; email?: string };
        if (!userData) {
          userData = {
            id: authSession.uid,
            username: authSession.displayName || 'Player',
            displayName: authSession.displayName || 'Player',
            email: authSession.email || '',
            accountNumber: '',
            level: 1,
            xp: 0,
            achievements: [],
            badges: [],
            clubIds: [],
            friendIds: [],
            country: '',
            createdAt: Date.now(),
            lastActive: Date.now(),
            onboardingComplete: true,
            startingBalance: 0,
          };
        }
        // Always set the user — even if a newer auth event fired while we were
        // awaiting, the user should never be left as null when authenticated.
        setUser(userData as import('../src/types').User);
        // If a newer auth event fired while we were awaiting, skip the rest
        // (settings, portfolio, navigation) — the newer call will handle those.
        if (callId !== currentCallId) return;
        // Load saved settings from Firestore
        const ud = userData as Record<string, unknown> | null;
        if (ud?.settings) {
          const saved = ud.settings as Record<string, unknown>;
          if (saved.appColorMode) useAppStore.setState({ appColorMode: saved.appColorMode as 'dark' | 'light' });
          if (saved.appAccentColor) useAppStore.setState({ appAccentColor: saved.appAccentColor as string });
          if (saved.appTileStyle) useAppStore.setState({ appTileStyle: saved.appTileStyle as 'default' | 'vivid' | 'glass' });
          if (saved.appTabColors) useAppStore.setState({ appTabColors: saved.appTabColors as Record<string, string> });
          if (saved.appLanguage) useAppStore.setState({ appLanguage: saved.appLanguage as string });
        }
        // Load portfolio from Firestore so holdings persist across sessions
        try {
          const portfolio = await getPortfolio(s.uid);
          if (callId !== currentCallId) return; // bail if stale
          if (portfolio) {
            const pRaw = portfolio as Record<string, unknown>;
            // Ensure holdings array exists even if missing from Firestore
            if (!pRaw.holdings) pRaw.holdings = [];
            // Load hourly history for the 30-day performance chart
            try {
              const history = await getPortfolioHistory(s.uid);
              if (history.length > 0) pRaw.history = history;
            } catch { /* non-critical */ }
            setPortfolio(pRaw as import('../src/types').Portfolio);
            // Save daily snapshot for weekly email chart + hourly for performance chart
            const p = pRaw as import('../src/types').Portfolio;
            import('../src/services/firebase').then(({ savePortfolioSnapshot, saveHourlySnapshot }) => {
              savePortfolioSnapshot(s.uid, p.totalValue, p.cashBalance, p.totalGainLoss ?? 0, p.totalGainLossPercent ?? 0).catch(() => {});
              saveHourlySnapshot(s.uid, p.totalValue).catch(() => {});
            });
          }
        } catch (err) {
          console.warn('[CQ] Portfolio load failed, will retry via listener:', err);
        }
        // If registration flow is in progress, don't navigate — let register handle it
        if (isRegistrationInProgress) {
          setAuthLoading(false);
          return;
        }

        // Always go to dashboard when user is authenticated
        // (setup screen is only reached from the registration flow)
        if (ud && !ud.onboardingComplete) {
          import('../src/services/auth').then(({ updateUser }) => {
            updateUser(s.uid, { onboardingComplete: true }).catch(() => {});
          });
        }
        // Mark welcomeShown for old users who never had it set
        if (ud && !ud.welcomeShown) {
          import('../src/services/auth').then(({ updateUser: upd }) => {
            upd(s.uid, { welcomeShown: true }).catch(() => {});
          });
        }
        router.replace('/(app)/dashboard');
      } else {
        // No user session — but skip redirect to welcome if login is actively in progress
        // (the login screen will handle navigation on success/failure)
        if (isLoginInProgress || isRegistrationInProgress) {
          setAuthLoading(false);
          await SplashScreen.hideAsync();
          return;
        }
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
