import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import AppHeader from '../../src/components/AppHeader';
import { useT } from '../../src/constants/translations';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import {
  formatCurrency,
  formatPercent,
  formatShares,
  formatRelativeTime,
  formatDate,
} from '../../src/utils/formatters';
import {
  Colors,
  LightColors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
} from '../../src/constants/theme';
import type { Holding, Order } from '../../src/types';

// ─── Level helper ─────────────────────────────────────────────────────────────

const LEVEL_TITLES = [
  'Beginner', 'Novice', 'Apprentice', 'Trader',
  'Pro Trader', 'Expert', 'Master', 'Elite', 'Legend', 'Wolf of Wall St.',
];

const XP_PER_LEVEL = 500;

function getLevelInfo(level: number, xp: number) {
  const clampedLevel = Math.max(1, Math.min(10, level));
  const xpInCurrentLevel = xp % XP_PER_LEVEL;
  const xpProgress = xpInCurrentLevel / XP_PER_LEVEL;
  const levelColor = Colors.levels[clampedLevel - 1] ?? Colors.brand.primary;
  const title = LEVEL_TITLES[clampedLevel - 1] ?? 'Legend';
  return { clampedLevel, xpInCurrentLevel, xpProgress, levelColor, title };
}

// ─── Chart data seeding ───────────────────────────────────────────────────────

function buildChartData(totalValue: number, startingBalance: number, portfolioHistory?: { timestamp: number; totalValue: number }[]): { value: number }[] {
  // Use real portfolio history if available, filtered to current month only
  if (portfolioHistory && portfolioHistory.length > 0) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonthData = portfolioHistory.filter(p => p.timestamp >= monthStart);

    if (thisMonthData.length > 0) {
      const values = thisMonthData.map(p => p.totalValue);
      const mn = Math.min(...values);
      const mx = Math.max(...values);
      const range = mx - mn || 1;
      return thisMonthData.map(p => ({
        value: ((p.totalValue - mn) / range) * 95 + 5,
      }));
    }
  }

  // No data for this month — return empty
  return [];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const t = useT();
  const { user, portfolio, quotes, isSidebarOpen, setSidebarOpen, appColorMode } = useAppStore();
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;

  const totalValue = portfolio?.totalValue ?? 0;
  const cashBalance = portfolio?.cashBalance ?? 0;
  const startingBalance = portfolio?.startingBalance ?? 10000;
  const totalGainLoss = portfolio?.totalGainLoss ?? 0;
  const totalGainLossPercent = portfolio?.totalGainLossPercent ?? 0;
  const holdings: Holding[] = portfolio?.holdings ?? [];
  const orders: Order[] = portfolio?.orders ?? [];
  const isGain = totalGainLoss >= 0;

  const { clampedLevel, xpInCurrentLevel, xpProgress, levelColor, title: levelTitle } =
    getLevelInfo(user?.level ?? 1, user?.xp ?? 0);

  const chartData = useMemo(
    () => buildChartData(totalValue, startingBalance, portfolio?.history),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portfolio?.userId, portfolio?.history, totalValue],
  );

  const portfolioAgeDays = useMemo(() => {
    if (!portfolio?.createdAt) return 0;
    return Math.floor((Date.now() - portfolio.createdAt) / 86_400_000);
  }, [portfolio?.createdAt]);

  // Holdings with live prices merged
  const enrichedHoldings = useMemo(() => {
    return holdings.map(h => {
      const q = quotes[h.symbol];
      const currentPrice = q?.price ?? h.currentPrice ?? 0;
      const currentValue = currentPrice * h.shares;
      const gainLoss = currentValue - h.totalCost;
      const gainLossPercent = h.totalCost > 0 ? (gainLoss / h.totalCost) * 100 : 0;
      return { ...h, currentPrice, currentValue, gainLoss, gainLossPercent };
    });
  }, [holdings, quotes]);

  // Performance stats
  const biggestWinner = useMemo(() => {
    if (enrichedHoldings.length === 0) return null;
    return enrichedHoldings.reduce((best, h) =>
      h.gainLossPercent > best.gainLossPercent ? h : best,
    );
  }, [enrichedHoldings]);

  const biggestLoser = useMemo(() => {
    if (enrichedHoldings.length === 0) return null;
    return enrichedHoldings.reduce((worst, h) =>
      h.gainLossPercent < worst.gainLossPercent ? h : worst,
    );
  }, [enrichedHoldings]);

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => (b.filledAt ?? b.createdAt) - (a.filledAt ?? a.createdAt))
        .slice(0, 10),
    [orders],
  );

  const handleStockPress = (symbol: string) => {
    router.push({ pathname: '/(app)/trade', params: { symbol } });
  };

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: C.bg.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg.primary} />
      <AppHeader title={t('portfolio')} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* XP / Level bar */}
        <View style={[styles.levelCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
          <View style={styles.levelHeader}>
            <View style={[styles.levelBadge, { backgroundColor: C.bg.tertiary }]}>
              <Text style={[styles.levelNumber, { color: levelColor }]}>Lv.{clampedLevel}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={[styles.levelTitle, { color: C.text.primary }]}>{levelTitle}</Text>
              <Text style={[styles.levelXp, { color: C.text.tertiary }]}>
                {xpInCurrentLevel} / {XP_PER_LEVEL} XP
              </Text>
            </View>
            <Text style={[styles.levelPercent, { color: C.text.secondary }]}>{Math.round(xpProgress * 100)}%</Text>
          </View>
          <View style={[styles.xpBarTrack, { backgroundColor: C.bg.tertiary }]}>
            <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%`, backgroundColor: levelColor }]} />
          </View>
        </View>

        {/* Portfolio Value Hero */}
        <View style={[styles.heroCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
          <Text style={[styles.heroLabel, { color: C.text.secondary }]}>{t('total_portfolio_value')}</Text>
          <Text style={[styles.heroValue, { color: C.text.primary }]}>{formatCurrency(totalValue)}</Text>
          <View style={styles.heroPnlRow}>
            <View style={[styles.heroPnlBadge, {
              backgroundColor: isGain ? Colors.market.gainBg : Colors.market.lossBg,
            }]}>
              <Text style={[styles.heroPnlText, { color: isGain ? Colors.market.gain : Colors.market.loss }]}>
                {isGain ? '▲ +' : '▼ '}
                {formatCurrency(Math.abs(totalGainLoss))}{'  '}
                ({formatPercent(totalGainLossPercent)})
              </Text>
            </View>
          </View>
          <View style={[styles.cashRow, { borderTopColor: C.border.default }]}>
            <View style={styles.cashItem}>
              <Text style={[styles.cashLabel, { color: C.text.tertiary }]}>{t('cash_balance')}</Text>
              <Text style={[styles.cashValue, { color: C.text.primary }]}>{formatCurrency(cashBalance)}</Text>
            </View>
            <View style={[styles.cashDivider, { backgroundColor: C.border.default }]} />
            <View style={styles.cashItem}>
              <Text style={[styles.cashLabel, { color: C.text.tertiary }]}>{t('invested')}</Text>
              <Text style={[styles.cashValue, { color: C.text.primary }]}>
                {formatCurrency(portfolio?.investedValue ?? 0)}
              </Text>
            </View>
            <View style={[styles.cashDivider, { backgroundColor: C.border.default }]} />
            <View style={styles.cashItem}>
              <Text style={[styles.cashLabel, { color: C.text.tertiary }]}>{t('starting')}</Text>
              <Text style={[styles.cashValue, { color: C.text.primary }]}>{formatCurrency(startingBalance)}</Text>
            </View>
          </View>
        </View>

        {/* Portfolio Chart */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>{t('performance_30d')}</Text>
        </View>
        <View style={[styles.chartCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
          {chartData.length > 0 ? (
            <LineChart
              data={chartData}
              width={320}
              height={200}
              color={totalGainLoss >= 0 ? Colors.market.gain : Colors.market.loss}
              thickness={2}
              hideDataPoints
              startFillColor={(totalGainLoss >= 0 ? Colors.market.gain : Colors.market.loss) + '40'}
              endFillColor={(totalGainLoss >= 0 ? Colors.market.gain : Colors.market.loss) + '05'}
              startOpacity={0.3}
              endOpacity={0}
              areaChart
              hideRules
              hideYAxisText
              hideAxesAndRules={false}
              yAxisColor="transparent"
              xAxisColor={Colors.border.default}
              backgroundColor="transparent"
              adjustToWidth
              initialSpacing={0}
              endSpacing={0}
              minValue={0}
              noOfSections={4}
            />
          ) : (
            <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.text.tertiary, fontSize: 14 }}>{t('no_perf_data')}</Text>
            </View>
          )}
        </View>

        {/* Holdings */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>{t('holdings')} ({enrichedHoldings.length})</Text>
        </View>

        {enrichedHoldings.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={[styles.emptyText, { color: C.text.secondary }]}>{t('no_holdings')}</Text>
            <Text style={[styles.emptySubtext, { color: C.text.tertiary }]}>{t('buy_first_stock')}</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(app)/trade')}
            >
              <Text style={styles.emptyButtonText}>{t('start_trading')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            {enrichedHoldings.map((holding, i) => {
              const up = holding.gainLoss >= 0;
              return (
                <TouchableOpacity
                  key={holding.symbol}
                  style={[styles.holdingRow, i < enrichedHoldings.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border.subtle }]}
                  onPress={() => handleStockPress(holding.symbol)}
                >
                  <View style={styles.holdingLeft}>
                    <View style={[styles.holdingAvatar, { backgroundColor: C.bg.input, borderColor: C.border.default }]}>
                      <Text style={styles.holdingAvatarText}>{holding.symbol.charAt(0)}</Text>
                    </View>
                    <View style={styles.holdingMeta}>
                      <Text style={[styles.holdingSymbol, { color: C.text.primary }]}>{holding.symbol}</Text>
                      <Text style={[styles.holdingShares, { color: C.text.secondary }]}>
                        {formatShares(holding.shares)} shares
                      </Text>
                      <Text style={[styles.holdingAvgCost, { color: C.text.tertiary }]}>
                        {t('avg')} {formatCurrency(holding.avgCostBasis)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.holdingRight}>
                    <Text style={[styles.holdingValue, { color: C.text.primary }]}>{formatCurrency(holding.currentValue)}</Text>
                    <Text style={[styles.holdingPrice, { color: C.text.tertiary }]}>@ {formatCurrency(holding.currentPrice)}</Text>
                    <Text style={[styles.holdingGainLoss, { color: up ? Colors.market.gain : Colors.market.loss }]}>
                      {up ? '+' : ''}{formatCurrency(holding.gainLoss)}
                    </Text>
                    <View style={[
                      styles.holdingPctBadge,
                      { backgroundColor: up ? Colors.market.gainBg : Colors.market.lossBg },
                    ]}>
                      <Text style={[styles.holdingPct, { color: up ? Colors.market.gain : Colors.market.loss }]}>
                        {formatPercent(holding.gainLossPercent)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Performance Stats */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>{t('performance_stats')}</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={styles.statIcon}>🏆</Text>
            <Text style={[styles.statLabel, { color: C.text.tertiary }]}>{t('best_trade')}</Text>
            <Text style={[styles.statValue, { color: Colors.market.gain }]}>
              {biggestWinner ? biggestWinner.symbol : '—'}
            </Text>
            {biggestWinner && (
              <Text style={[styles.statSub, { color: Colors.market.gain }]}>
                {formatPercent(biggestWinner.gainLossPercent)}
              </Text>
            )}
          </View>
          <View style={[styles.statCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={styles.statIcon}>📉</Text>
            <Text style={[styles.statLabel, { color: C.text.tertiary }]}>{t('worst_trade')}</Text>
            <Text style={[styles.statValue, { color: Colors.market.loss }]}>
              {biggestLoser ? biggestLoser.symbol : '—'}
            </Text>
            {biggestLoser && (
              <Text style={[styles.statSub, { color: Colors.market.loss }]}>
                {formatPercent(biggestLoser.gainLossPercent)}
              </Text>
            )}
          </View>
          <View style={[styles.statCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={styles.statIcon}>🔁</Text>
            <Text style={[styles.statLabel, { color: C.text.tertiary }]}>{t('total_trades')}</Text>
            <Text style={[styles.statValue, { color: C.text.primary }]}>{orders.length}</Text>
            <Text style={[styles.statSub, { color: C.text.tertiary }]}>{t('orders_placed')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={styles.statIcon}>📅</Text>
            <Text style={[styles.statLabel, { color: C.text.tertiary }]}>{t('portfolio_age')}</Text>
            <Text style={[styles.statValue, { color: C.text.primary }]}>{portfolioAgeDays}</Text>
            <Text style={[styles.statSub, { color: C.text.tertiary }]}>{t('days_active')}</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>{t('recent_activity')}</Text>
        </View>

        {recentOrders.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={[styles.emptyText, { color: C.text.secondary }]}>{t('no_transactions')}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            {recentOrders.map((order, i) => {
              const isBuy = order.type === 'buy';
              const ts = order.filledAt ?? order.createdAt;
              const isFilled = order.status === 'filled';
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.activityRow, i < recentOrders.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border.subtle }]}
                  onPress={() => handleStockPress(order.symbol)}
                >
                  <View style={[styles.activityIcon, {
                    backgroundColor: isBuy ? Colors.market.gainBg : Colors.market.lossBg,
                  }]}>
                    <Text style={[styles.activityIconText, {
                      color: isBuy ? Colors.market.gain : Colors.market.loss,
                    }]}>
                      {isBuy ? '▲' : '▼'}
                    </Text>
                  </View>
                  <View style={styles.activityMeta}>
                    <View style={styles.activityTitleRow}>
                      <Text style={[styles.activityType, { color: C.text.primary }]}>{isBuy ? t('bought') : t('sold')}</Text>
                      <Text style={styles.activitySymbol}>{order.symbol}</Text>
                    </View>
                    <Text style={[styles.activityDetail, { color: C.text.secondary }]}>
                      {order.filledShares != null
                        ? `${formatShares(order.filledShares)} shares`
                        : order.shares != null
                        ? `${formatShares(order.shares)} shares`
                        : '—'}
                      {order.filledPrice != null
                        ? ` @ ${formatCurrency(order.filledPrice)}`
                        : ''}
                    </Text>
                    <Text style={[styles.activityTime, { color: C.text.tertiary }]}>{formatRelativeTime(ts)}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    {order.filledPrice != null && order.filledShares != null ? (
                      <Text style={[styles.activityTotal, {
                        color: isBuy ? Colors.market.loss : Colors.market.gain,
                      }]}>
                        {isBuy ? '-' : '+'}{formatCurrency(order.filledPrice * order.filledShares)}
                      </Text>
                    ) : (
                      <Text style={[styles.activityTotal, { color: C.text.primary }]}>—</Text>
                    )}
                    <View style={[styles.activityStatusBadge, {
                      backgroundColor:
                        order.status === 'filled'
                          ? Colors.market.gainBg
                          : order.status === 'cancelled' || order.status === 'rejected'
                          ? Colors.market.lossBg
                          : C.bg.tertiary,
                    }]}>
                      <Text style={[styles.activityStatus, {
                        color:
                          order.status === 'filled'
                            ? Colors.market.gain
                            : order.status === 'cancelled' || order.status === 'rejected'
                            ? Colors.market.loss
                            : C.text.secondary,
                      }]}>
                        {order.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A7840',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.base,
  },

  // Level
  levelCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.sm,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  levelNumber: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.extrabold,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  levelXp: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  levelPercent: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  xpBarTrack: {
    height: 6,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  // Hero
  heroCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  heroValue: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    letterSpacing: -1,
  },
  heroPnlRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
  },
  heroPnlBadge: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  heroPnlText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  cashRow: {
    flexDirection: 'row',
    width: '100%',
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  cashItem: {
    flex: 1,
    alignItems: 'center',
  },
  cashDivider: {
    width: 1,
    backgroundColor: Colors.border.default,
  },
  cashLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cashValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },

  // Chart
  chartCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    alignItems: 'center',
  },

  // Generic card
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
  },

  // Holdings
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  holdingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  holdingAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  holdingAvatarText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.brand.primary,
  },
  holdingMeta: {
    flex: 1,
  },
  holdingSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  holdingShares: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  holdingAvgCost: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  holdingRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  holdingValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  holdingPrice: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  holdingGainLoss: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  holdingPctBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
  holdingPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  statSub: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconText: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },
  activityMeta: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  activityType: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  activitySymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.brand.primary,
  },
  activityDetail: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  activityTime: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityTotal: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  activityStatusBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
  },
  activityStatus: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.base,
  },
  emptyText: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
  },
  emptyButton: {
    marginTop: Spacing.base,
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  emptyButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.bg.primary,
  },

  bottomPadding: {
    height: Spacing.xl,
  },
});
