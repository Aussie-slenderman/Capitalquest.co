import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform, AppState } from 'react-native';
import { Tabs, router } from 'expo-router';

const TAB_ICONS = {
  learn: require('../../assets/tabs/learn.png'),
  buySell: require('../../assets/tabs/buy-sell.png'),
  portfolio: require('../../assets/tabs/portfolio.png'),
  social: require('../../assets/tabs/social.png'),
  awards: require('../../assets/tabs/awards.png'),
};
import { useAppStore } from '../../src/store/useAppStore';
import {
  listenToPortfolio,
  listenToChatRooms,
  listenToTradeProposals,
  listenToClubInvites,
  fetchPendingInvites,
} from '../../src/services/auth';
import { refreshPortfolioPrices } from '../../src/services/tradingEngine';
import { subscribeToPrices } from '../../src/services/stockApi';
import { Colors, FontSize, FontWeight } from '../../src/constants/theme';
import { useT } from '../../src/constants/translations';
import { ACHIEVEMENTS, getLevelFromXP } from '../../src/constants/achievements';
import { POPULAR_STOCKS } from '../../src/constants/stocks';
import { updateUser } from '../../src/services/auth';
import type { Portfolio, ChatRoom, Achievement } from '../../src/types';
import AchievementToast from '../../src/components/AchievementToast';
import Sidebar from '../../src/components/Sidebar';

export default function AppLayout() {
  const t = useT();
  const {
    user, setPortfolio, setChatRooms, setUnreadCount, unreadCount,
    portfolio, setQuote,
    appAccentColor, appColorMode,
    clubInvites,
    isSidebarOpen, setSidebarOpen,
  } = useAppStore();

  const socialBadgeCount = (unreadCount ?? 0) + (clubInvites?.length ?? 0);

  // Return to dashboard whenever app comes back to foreground (native only —
  // on web, AppState fires on every browser-tab switch which would be disruptive)
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        router.replace('/(app)/dashboard');
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Listen to portfolio changes
  useEffect(() => {
    if (!user?.id) return;
    const unsub = listenToPortfolio(user.id, (data) => {
      setPortfolio(data as Portfolio);
    });
    return unsub;
  }, [user?.id]);

  // Retroactive achievement check — runs once when portfolio is available
  const hasCheckedAchievements = useRef(false);
  useEffect(() => {
    if (!user?.id || !portfolio || hasCheckedAchievements.current) return;
    hasCheckedAchievements.current = true;

    const alreadyUnlocked = new Set(
      (user.achievements || []).filter((a: any) => a.unlockedAt).map((a: any) => a.id)
    );
    const newlyUnlocked: any[] = [];

    const stockData = POPULAR_STOCKS.reduce((map, s) => { map[s.symbol] = s; return map; }, {} as Record<string, typeof POPULAR_STOCKS[0]>);
    const holdingStocks = portfolio.holdings.map(h => stockData[h.symbol]).filter(Boolean);
    const holdingSectors = new Set(holdingStocks.map(s => s.sector));
    const holdingExchanges = new Set(holdingStocks.map(s => s.exchange));
    const hasInternational = holdingStocks.some(s => s.country !== 'US');
    const hasETF = holdingStocks.some(s => s.sector === 'ETF');
    const totalValue = portfolio.totalValue || 1;
    const maxPct = Math.max(...portfolio.holdings.map(h => (h.currentValue / totalValue) * 100), 0);
    const isBalanced = portfolio.holdings.length >= 2 && maxPct <= 30;
    const gainDollars = portfolio.totalGainLoss ?? 0;
    const gainPercent = (gainDollars / (portfolio.startingBalance || 1)) * 100;
    const orders = portfolio.orders ?? [];
    const filledBuys = orders.filter(o => o.type === 'buy' && o.status === 'filled' && o.filledAt);
    const now = Date.now();
    const BLUE_CHIPS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'JPM', 'V', 'BRK.B', 'KO', 'JNJ', 'PG', 'WMT'];

    for (const ach of ACHIEVEMENTS) {
      if (alreadyUnlocked.has(ach.id)) continue;
      let shouldUnlock = false;
      switch (ach.id) {
        case 'first_login': shouldUnlock = true; break;
        case 'first_trade': shouldUnlock = orders.length > 0; break;
        case 'etf_explorer': shouldUnlock = hasETF; break;
        case 'sector_scout': shouldUnlock = holdingSectors.size >= 3; break;
        case 'the_diversifier': shouldUnlock = portfolio.holdings.length >= 10; break;
        case 'global_nomad': shouldUnlock = hasInternational; break;
        case 'cross_exchange_pro': shouldUnlock = holdingExchanges.size >= 2; break;
        case 'steady_hands':
          shouldUnlock = portfolio.holdings.some(h => {
            const fb = filledBuys.find(o => o.symbol === h.symbol);
            return fb?.filledAt && (now - fb.filledAt) >= 30 * 24 * 60 * 60 * 1000;
          });
          break;
        case 'balanced_ledger': shouldUnlock = isBalanced; break;
        case 'growth_chaser':
          shouldUnlock = holdingStocks.some(s => !BLUE_CHIPS.includes(s.symbol) && s.sector !== 'ETF');
          break;
        case 'blue_chip_anchor':
          shouldUnlock = portfolio.holdings.some(h => {
            if (!BLUE_CHIPS.includes(h.symbol)) return false;
            const fb = filledBuys.find(o => o.symbol === h.symbol);
            return fb?.filledAt && (now - fb.filledAt) >= 14 * 24 * 60 * 60 * 1000;
          });
          break;
        case 'profit_milestone': shouldUnlock = gainPercent >= 10; break;
      }
      if (shouldUnlock) {
        newlyUnlocked.push({ ...ach, unlockedAt: Date.now() });
        alreadyUnlocked.add(ach.id);
      }
    }

    if (newlyUnlocked.length > 0) {
      const existing = user.achievements || [];
      const merged = [...existing, ...newlyUnlocked];
      const xpGained = newlyUnlocked.reduce((sum: number, a: any) => sum + a.xpReward, 0);
      const newXP = (user.xp || 0) + xpGained;
      const newLevel = getLevelFromXP(newXP);
      const updatedUser = { ...user, achievements: merged, xp: newXP, level: newLevel.level };
      useAppStore.getState().setUser(updatedUser);
      updateUser(user.id, { achievements: merged, xp: newXP, level: newLevel.level }).catch(() => {});
    }
  }, [user?.id, portfolio]);

  // Refresh portfolio prices every 30s
  useEffect(() => {
    if (!user?.id) return;
    refreshPortfolioPrices(user.id);
    const interval = setInterval(() => refreshPortfolioPrices(user.id!), 30_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Load watchlist from Firestore on login
  useEffect(() => {
    if (!user?.id) return;
    import('../../src/services/firebase').then(({ loadWatchlist }) => {
      loadWatchlist(user.id).then((symbols) => {
        if (Array.isArray(symbols)) {
          useAppStore.getState().setWatchlist(symbols);
        }
      }).catch(() => {});
    });
  }, [user?.id]);

  // Subscribe to real-time WebSocket prices for watchlist
  const watchlist = useAppStore(s => s.watchlist);
  useEffect(() => {
    const unsub = subscribeToPrices(watchlist, (symbol, quote) => {
      setQuote(symbol, quote);
    });
    return unsub;
  }, [watchlist]);

  // Listen to chat rooms
  useEffect(() => {
    if (!user?.id) return;
    const unsub = listenToChatRooms(user.id, (rooms) => {
      setChatRooms(rooms as ChatRoom[]);
    });
    return unsub;
  }, [user?.id]);

  // Listen to club invites from Firestore (replaces local state entirely)
  useEffect(() => {
    if (!user?.id) return;

    const mapInvites = (invites: Array<{ id: string; type?: string; clubId?: string; clubName?: string; fromUserId: string; fromUsername: string; sentAt: number }>) =>
      invites.map(inv => ({
        id: inv.id,
        type: (inv.type === 'friend_request' ? 'friend_request' : 'club_invite') as 'club_invite' | 'friend_request',
        clubId: inv.clubId,
        clubName: inv.clubName,
        fromUserId: inv.fromUserId,
        fromUsername: inv.fromUsername,
        sentAt: inv.sentAt,
      }));

    // Real-time listener
    let unsub: (() => void) | undefined;
    try {
      unsub = listenToClubInvites(user.id, (invites) => {
        const typed = invites as Array<{ id: string; type?: string; clubId?: string; clubName?: string; fromUserId: string; fromUsername: string; sentAt: number }>;
        useAppStore.setState({ clubInvites: mapInvites(typed) });
      });
    } catch (err) {
      console.error('Failed to start invite listener:', err);
    }

    // Also do a one-time fetch as backup in case the listener fails silently
    fetchPendingInvites(user.id).then((invites) => {
      const typed = invites as Array<{ id: string; type?: string; clubId?: string; clubName?: string; fromUserId: string; fromUsername: string; sentAt: number }>;
      if (typed.length > 0) {
        useAppStore.setState({ clubInvites: mapInvites(typed) });
      }
    }).catch((err) => {
      console.error('Failed to fetch invites:', err);
    });

    return () => { if (unsub) unsub(); };
  }, [user?.id]);

  // Listen to trade proposals
  useEffect(() => {
    if (!user?.id) return;
    const unsub = listenToTradeProposals(user.id, (proposals) => {
      if (proposals.length > 0) {
        setUnreadCount(unreadCount + proposals.length);
      }
    });
    return unsub;
  }, [user?.id]);

  const tabBarBg = appColorMode === 'light' ? '#F0F2F8' : Colors.bg.secondary;
  const tabBarBorder = appColorMode === 'light' ? 'rgba(0,0,0,0.12)' : Colors.border.default;
  const screenBg = Colors.bg.primary;

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: screenBg },
        tabBarStyle: [styles.tabBar, { display: isSidebarOpen ? 'none' : 'flex' }],
        tabBarActiveTintColor: appAccentColor,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarShowLabel: false,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      {/* ── Visible tabs ── */}
      <Tabs.Screen
        name="tutorial"
        options={{
          title: t('learn'),
          tabBarIcon: ({ focused }) => <TabImageIcon source={TAB_ICONS.learn} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Buy & Sell',
          tabBarIcon: ({ focused }) => <TabImageIcon source={TAB_ICONS.buySell} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: t('portfolio'),
          tabBarIcon: ({ focused }) => <TabImageIcon source={TAB_ICONS.portfolio} focused={focused} />,
        }}
      />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
      <Tabs.Screen name="advisor" options={{ href: null }} />

      {/* ── Dashboard (hidden — accessible via CapitalQuest title tap) ── */}
      <Tabs.Screen name="dashboard" options={{ href: null, tabBarStyle: { display: 'none' } }} />

      <Tabs.Screen
        name="social"
        options={{
          title: t('social'),
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 90, height: 90 }}>
              <TabImageIcon source={TAB_ICONS.social} focused={focused} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{socialBadgeCount > 9 ? '9+' : socialBadgeCount}</Text>
              </View>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="trophy-road"
        options={{
          title: 'Awards',
          tabBarIcon: ({ focused }) => <TabImageIcon source={TAB_ICONS.awards} focused={focused} />,
        }}
      />
      <Tabs.Screen name="shop" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />

      {/* ── Hidden routes (no tab icon) ── */}
      <Tabs.Screen name="trade"         options={{ href: null }} />
      <Tabs.Screen name="buy-bling"     options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="news-article"  options={{ href: null }} />
    </Tabs>
    <AchievementToast />
    <Sidebar visible={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

function TabImageIcon({
  source,
  focused,
}: {
  source: any;
  focused: boolean;
}) {
  return (
    <Image
      source={source}
      style={[styles.tabImage, { opacity: focused ? 1 : 0.5 }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    elevation: 0,
    height: 110,
    paddingBottom: 10,
    paddingTop: 0,
    paddingHorizontal: 10,
  },
  tabItem: {
    paddingHorizontal: 4,
    minWidth: 0,
  },
  // Tab image icon
  tabImage: {
    width: 90,
    height: 90,
  },
  // Notification badge
  badge: {
    position: 'absolute',
    top: -2,
    right: 9.5,
    backgroundColor: Colors.market.loss,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },
});
