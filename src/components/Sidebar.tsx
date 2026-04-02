import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '../store/useAppStore';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../constants/theme';
import { formatCurrency, formatPercent, formatShares } from '../utils/formatters';
import { getXPProgress } from '../constants/achievements';
import { router } from 'expo-router';

const SIDEBAR_WIDTH = 300;
const TRENDING_SYMBOLS = ['NVDA', 'TSLA', 'META', 'AAPL', 'MSFT'];

const NAV_TABS = [
  { icon: '📊', label: 'Markets',   route: '/(app)/home' },
  { icon: '💼', label: 'Portfolio', route: '/(app)/portfolio' },
  { icon: '📈', label: 'Trade',     route: '/(app)/trade' },
  { icon: '🏆', label: 'Ranks',     route: '/(app)/leaderboard' },
  { icon: '💬', label: 'Social',    route: '/(app)/social' },
  { icon: '🎖️', label: 'Trophy',   route: '/(app)/trophy-road' },
  { icon: '👤', label: 'Profile',   route: '/(app)/profile' },
];

// ─── Level color helper ───────────────────────────────────────────────────────

function getLevelColor(level: number): string {
  return Colors.levels[Math.min(level - 1, Colors.levels.length - 1)] ?? Colors.levels[0];
}

// ─── Initials Avatar ──────────────────────────────────────────────────────────

function InitialsAvatar({
  name,
  size = 40,
  color = Colors.brand.primary,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '33',
        borderWidth: 1.5,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.38,
          fontWeight: FontWeight.bold,
          color,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const { user, portfolio, watchlist, quotes } = useAppStore();

  // ─── Slide animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: SIDEBAR_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateX, overlayOpacity]);

  if (!visible) {
    // Keep component mounted for exit animation; guard with pointer-events
  }

  // ─── Top Movers ─────────────────────────────────────────────────────────────

  const topMovers = watchlist
    .map((symbol) => ({
      symbol,
      quote: quotes[symbol],
    }))
    .filter((s) => s.quote !== undefined)
    .sort((a, b) =>
      Math.abs(b.quote!.changePercent) - Math.abs(a.quote!.changePercent)
    )
    .slice(0, 5);

  // ─── Trending Stocks ─────────────────────────────────────────────────────────

  const trendingStocks = TRENDING_SYMBOLS.map((symbol) => ({
    symbol,
    quote: quotes[symbol],
  }));

  // ─── Level Progress ──────────────────────────────────────────────────────────

  const xp = user?.xp ?? 0;
  const xpProgress = getXPProgress(xp);
  const levelColor = getLevelColor(xpProgress.current.level);

  // ─── Navigate to trade ───────────────────────────────────────────────────────

  const navigateToTrade = (symbol: string) => {
    onClose();
    router.push({ pathname: '/(app)/trade', params: { symbol } } as never);
  };

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sidebar Panel */}
      <Animated.View
        style={[
          styles.sidebar,
          {
            transform: [{ translateX }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {/* Close Button */}
        <View style={styles.closeRow}>
          <Text style={styles.sidebarHeading}>Overview</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing['2xl'] }}
        >
          {/* ── Navigation Tabs ──────────────────────────────────────────── */}
          <SectionHeader title="Navigate" />
          <View style={styles.navGrid}>
            {NAV_TABS.map(tab => (
              <TouchableOpacity
                key={tab.route}
                style={styles.navItem}
                onPress={() => {
                  onClose();
                  router.push(tab.route as never);
                }}
              >
                <Text style={styles.navIcon}>{tab.icon}</Text>
                <Text style={styles.navLabel}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Section 1: My Holdings ───────────────────────────────────── */}
          <SectionHeader title="My Holdings" />
          {!portfolio || portfolio.holdings.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No holdings yet</Text>
            </View>
          ) : (
            portfolio.holdings.map((holding) => {
              const isGain = holding.gainLossPercent >= 0;
              const changeColor = isGain ? Colors.market.gain : Colors.market.loss;
              return (
                <TouchableOpacity
                  key={holding.symbol}
                  style={styles.holdingRow}
                  onPress={() => navigateToTrade(holding.symbol)}
                >
                  <View style={styles.holdingLeft}>
                    <Text style={styles.holdingSymbol}>{holding.symbol}</Text>
                    <Text style={styles.holdingShares}>
                      {formatShares(holding.shares)} shares
                    </Text>
                  </View>
                  <View style={styles.holdingRight}>
                    <Text style={styles.holdingValue}>
                      {formatCurrency(holding.currentValue)}
                    </Text>
                    <Text style={[styles.holdingChange, { color: changeColor }]}>
                      {isGain ? '+' : ''}
                      {formatPercent(holding.gainLossPercent)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* ── Section 2: Top Movers ────────────────────────────────────── */}
          <SectionHeader title="Top Movers Today" />
          {topMovers.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No market data yet</Text>
            </View>
          ) : (
            topMovers.map(({ symbol, quote }) => {
              if (!quote) return null;
              const isGain = quote.changePercent >= 0;
              const changeColor = isGain ? Colors.market.gain : Colors.market.loss;
              const badgeBg = isGain ? Colors.market.gainBg : Colors.market.lossBg;
              return (
                <View key={symbol} style={styles.moverRow}>
                  <View style={[styles.moverBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.moverBadgeText, { color: changeColor }]}>
                      {isGain ? '▲' : '▼'}{' '}
                      {formatPercent(Math.abs(quote.changePercent), false)}
                    </Text>
                  </View>
                  <View style={styles.moverInfo}>
                    <Text style={styles.moverSymbol}>{symbol}</Text>
                    <Text style={styles.moverPrice}>
                      {formatCurrency(quote.price)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.buyBtn}
                    onPress={() => navigateToTrade(symbol)}
                  >
                    <Text style={styles.buyBtnText}>BUY</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          {/* ── Section 3: Trending Stocks ───────────────────────────────── */}
          <SectionHeader title="Trending Stocks" />
          {trendingStocks.map(({ symbol, quote }) => (
            <TouchableOpacity
              key={symbol}
              style={styles.trendingRow}
              onPress={() => navigateToTrade(symbol)}
            >
              <InitialsAvatar name={symbol} size={34} color={Colors.brand.accent} />
              <View style={styles.trendingInfo}>
                <Text style={styles.trendingSymbol}>{symbol}</Text>
                {quote ? (
                  <Text
                    style={[
                      styles.trendingChange,
                      {
                        color:
                          quote.changePercent >= 0
                            ? Colors.market.gain
                            : Colors.market.loss,
                      },
                    ]}
                  >
                    {quote.changePercent >= 0 ? '+' : ''}
                    {formatPercent(quote.changePercent)}
                  </Text>
                ) : (
                  <Text style={styles.trendingChange}>—</Text>
                )}
              </View>
              <Text style={styles.trendingPrice}>
                {quote ? formatCurrency(quote.price) : '—'}
              </Text>
            </TouchableOpacity>
          ))}

          {/* ── Section 4: Level Progress ────────────────────────────────── */}
          <SectionHeader title="Your Level Progress" />
          <View style={styles.levelCard}>
            <View style={styles.levelTopRow}>
              <Text style={styles.levelIcon}>{xpProgress.current.icon}</Text>
              <View style={styles.levelDetails}>
                <Text style={[styles.levelTitle, { color: levelColor }]}>
                  {xpProgress.current.title}
                </Text>
                <Text style={styles.levelSubtitle}>
                  Level {xpProgress.current.level}
                  {xpProgress.nextLevel
                    ? ` → ${xpProgress.nextLevel.title}`
                    : ' (Max Level)'}
                </Text>
              </View>
            </View>

            {/* XP Progress Bar */}
            <View style={styles.xpBarContainer}>
              <View style={styles.xpBarTrack}>
                <Animated.View
                  style={[
                    styles.xpBarFill,
                    {
                      width: `${Math.min(xpProgress.progress * 100, 100)}%`,
                      backgroundColor: levelColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.xpLabelRow}>
                <Text style={styles.xpLabel}>
                  {xpProgress.xpInLevel.toLocaleString()} XP
                </Text>
                {xpProgress.nextLevel && (
                  <Text style={styles.xpLabel}>
                    {xpProgress.xpNeeded.toLocaleString()} XP needed
                  </Text>
                )}
              </View>
            </View>

            {xpProgress.nextLevel && (
              <View style={styles.nextMilestoneRow}>
                <Text style={styles.nextMilestoneLabel}>Next milestone</Text>
                <View
                  style={[
                    styles.nextMilestoneBadge,
                    { backgroundColor: getLevelColor(xpProgress.nextLevel.level) + '22' },
                  ]}
                >
                  <Text style={styles.nextMilestoneIcon}>
                    {xpProgress.nextLevel.icon}
                  </Text>
                  <Text
                    style={[
                      styles.nextMilestoneText,
                      { color: getLevelColor(xpProgress.nextLevel.level) },
                    ]}
                  >
                    {xpProgress.nextLevel.title}
                  </Text>
                </View>
              </View>
            )}
          </View>

        </ScrollView>
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 100,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.bg.secondary,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border.default,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20,
  },

  // Navigation grid
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  navItem: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 4,
  },
  navIcon: { fontSize: 20 },
  navLabel: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
  },

  // Header
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  sidebarHeading: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  closeBtnText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Section Headers
  sectionHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Empty State
  emptySection: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },

  // Holdings
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  holdingLeft: {
    flex: 1,
  },
  holdingSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  holdingShares: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  holdingChange: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },

  // Top Movers
  moverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    gap: Spacing.sm,
  },
  moverBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  moverBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  moverInfo: {
    flex: 1,
  },
  moverSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  moverPrice: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  buyBtn: {
    backgroundColor: Colors.brand.primary + '22',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  buyBtnText: {
    color: Colors.brand.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  // Trending Stocks
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    gap: Spacing.sm,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  trendingChange: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 2,
    color: Colors.text.tertiary,
  },
  trendingPrice: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },

  // Level Card
  levelCard: {
    margin: Spacing.base,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  levelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  levelIcon: {
    fontSize: 32,
  },
  levelDetails: {
    flex: 1,
  },
  levelTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  levelSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  xpBarContainer: {
    marginBottom: Spacing.md,
  },
  xpBarTrack: {
    height: 8,
    backgroundColor: Colors.bg.primary,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  xpBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  nextMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  nextMilestoneLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  nextMilestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    gap: 4,
  },
  nextMilestoneIcon: {
    fontSize: FontSize.sm,
  },
  nextMilestoneText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // Add Email
  addEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.brand.primary + '40',
    gap: Spacing.sm,
  },
  addEmailIcon: {
    fontSize: 24,
  },
  addEmailTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  addEmailSub: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  addEmailArrow: {
    fontSize: FontSize.lg,
    color: Colors.brand.primary,
    fontWeight: FontWeight.bold,
  },
});
