import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Modal,
  TextInput,
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
import type { Holding, Order, Portfolio, PortfolioPrivacy, Transaction } from '../../src/types';
import { reconstructPortfolioHistory, type HistoryPoint } from '../../src/services/portfolioHistory';
import { getTransactions } from '../../src/services/auth';

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

// ─── Chart period types & helpers ─────────────────────────────────────────────

type PortfolioChartPeriod = '1W' | '1M' | '1Y' | 'YTD' | 'ALL';
const PORTFOLIO_CHART_PERIODS: PortfolioChartPeriod[] = ['1W', '1M', '1Y', 'YTD', 'ALL'];

function getPeriodCutoff(period: PortfolioChartPeriod): number {
  const now = Date.now();
  switch (period) {
    case '1W':  return now - 7 * 24 * 60 * 60 * 1000;
    case '1M':  return now - 30 * 24 * 60 * 60 * 1000;
    case '1Y':  return now - 365 * 24 * 60 * 60 * 1000;
    case 'YTD': {
      const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
      return jan1;
    }
    case 'ALL':  return 0;
  }
}

function getPeriodLabel(period: PortfolioChartPeriod): string {
  switch (period) {
    case '1W':  return '7-Day Performance';
    case '1M':  return '30-Day Performance';
    case '1Y':  return '1-Year Performance';
    case 'YTD': return 'Year-to-Date Performance';
    case 'ALL': return 'All-Time Performance';
  }
}

function getDateRangeText(period: PortfolioChartPeriod, createdAt?: number): string {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: now.getFullYear() !== d.getFullYear() ? 'numeric' : undefined } as any);
  const cutoff = getPeriodCutoff(period);
  const startDate = period === 'ALL' && createdAt ? new Date(createdAt) : new Date(cutoff);
  return `${fmt(startDate)} – ${fmt(now)}`;
}

interface ChartResult {
  data: { value: number }[];
  baseline: number;
  topValue: number;
  startValue: number;
  endValue: number;
  changeAmount: number;
  changePercent: number;
  dataPoints: number;
  isFlat: boolean;
  coverageRatio: number; // 0-1: what fraction of the period the data covers
}

function buildChartData(
  totalValue: number,
  portfolioHistory?: { timestamp: number; totalValue: number }[],
  period: PortfolioChartPeriod = '1M',
  accountCreatedAt?: number,
): ChartResult {
  const empty: ChartResult = {
    data: [], baseline: 0, topValue: 100,
    startValue: 0, endValue: 0, changeAmount: 0, changePercent: 0,
    dataPoints: 0, isFlat: true, coverageRatio: 1,
  };

  if (portfolioHistory && portfolioHistory.length > 0) {
    const cutoff = getPeriodCutoff(period);
    const filtered = portfolioHistory
      .filter(p => p.timestamp >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (filtered.length > 0) {
      const values = filtered.map(p => p.totalValue);
      const mn = Math.min(...values);
      const mx = Math.max(...values);
      const startVal = filtered[0].totalValue;
      const endVal = filtered[filtered.length - 1].totalValue;
      const changeAmount = endVal - startVal;
      const changePercent = startVal > 0 ? (changeAmount / startVal) * 100 : 0;
      const isFlat = mx - mn < 0.01;

      // Calculate how much of the selected period the data actually covers
      const now = Date.now();
      const periodDuration = now - cutoff;
      const dataStart = accountCreatedAt && accountCreatedAt > cutoff ? accountCreatedAt : filtered[0].timestamp;
      const dataDuration = now - dataStart;
      // For ALL period or when data covers entire period, ratio = 1
      // For 1Y/YTD when account is newer than the period, ratio < 1
      const coverageRatio = period === 'ALL' ? 1 : Math.min(1, dataDuration / periodDuration);

      // Calculate baseline and topValue
      let baseline: number;
      let topValue: number;
      if (isFlat) {
        const spread = mn * 0.025 || 50;
        baseline = mn - spread;
        topValue = spread * 2;
      } else {
        const range = mx - mn;
        const padding = range * 0.08;
        baseline = mn - padding;
        topValue = (mx + padding) - baseline;
      }

      let dataPoints = filtered.map(p => ({ value: p.totalValue - baseline }));
      if (dataPoints.length === 1) {
        dataPoints.push({ ...dataPoints[0] });
      }

      return {
        data: dataPoints, baseline, topValue,
        startValue: startVal, endValue: endVal,
        changeAmount, changePercent,
        dataPoints: filtered.length, isFlat,
        coverageRatio,
      };
    }
  }

  // No history data — show flat line at current value
  if (totalValue > 0) {
    const spread = totalValue * 0.025 || 50;
    const baseline = totalValue - spread;
    const topValue = spread * 2;
    const pts = [{ value: totalValue - baseline }, { value: totalValue - baseline }];
    return {
      data: pts, baseline, topValue,
      startValue: totalValue, endValue: totalValue,
      changeAmount: 0, changePercent: 0,
      dataPoints: 1, isFlat: true, coverageRatio: 1,
    };
  }
  return empty;
}

function getOrderTimestamp(order: Order): number {
  return order.filledAt ?? order.createdAt ?? 0;
}

function transactionFromOrder(order: Order, userId: string): Transaction | null {
  if (order.status !== 'filled') return null;
  const timestamp = getOrderTimestamp(order);
  const shares = order.filledShares ?? order.shares ?? 0;
  const price = order.filledPrice ?? order.limitPrice ?? 0;
  if (!timestamp || shares <= 0 || price <= 0) return null;

  const orderTotal = (order as Order & { total?: number }).total;
  return {
    id: order.id,
    userId,
    symbol: order.symbol,
    type: order.type,
    shares,
    price,
    total: typeof orderTotal === 'number' ? orderTotal : shares * price,
    timestamp,
  };
}

function mergeTransactionSources(
  transactions: Transaction[],
  orders: Order[],
  userId: string,
): Transaction[] {
  const merged = [...transactions];
  const orderTransactions = orders
    .map(order => transactionFromOrder(order, userId))
    .filter((tx): tx is Transaction => tx != null);

  for (const orderTx of orderTransactions) {
    const duplicate = merged.some(tx =>
      tx.symbol === orderTx.symbol &&
      tx.type === orderTx.type &&
      Math.abs(tx.shares - orderTx.shares) < 1e-6 &&
      Math.abs(tx.price - orderTx.price) < 0.01 &&
      Math.abs(tx.timestamp - orderTx.timestamp) < 10_000
    );
    if (!duplicate) merged.push(orderTx);
  }

  return merged.sort((a, b) => b.timestamp - a.timestamp);
}

function getPortfolioHistoryStateKey(portfolio: Portfolio | null): string {
  if (!portfolio) return 'none';
  const holdingsKey = (portfolio.holdings ?? [])
    .map(h => [
      h.symbol,
      h.shares,
      h.currentPrice,
      h.currentValue,
      h.totalCost,
    ].join(':'))
    .sort()
    .join('|');
  const orders = portfolio.orders ?? [];
  const latestOrderTime = orders.reduce(
    (latest, order) => Math.max(latest, getOrderTimestamp(order)),
    0,
  );
  const history = portfolio.history ?? [];
  const latestHistory = history[history.length - 1];

  return [
    portfolio.cashBalance,
    portfolio.totalValue,
    portfolio.investedValue,
    holdingsKey,
    orders.length,
    latestOrderTime,
    history.length,
    latestHistory?.timestamp ?? 0,
    latestHistory?.totalValue ?? 0,
  ].join(';');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioScreen() {
  const t = useT();
  const { user, setUser, portfolio, quotes, isSidebarOpen, setSidebarOpen, appColorMode, pendingOrders, removePendingOrder } = useAppStore();
  const [showPortfolio, setShowPortfolio] = useState(false);
  const savedName = (user as any)?.portfolioName;
  const [portfolioName, setPortfolioName] = useState(savedName || 'Portfolio 1');
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacySetting, setPrivacySetting] = useState<PortfolioPrivacy>(
    (portfolio as any)?.privacy ?? 'private'
  );
  const [allowedAccounts, setAllowedAccounts] = useState<string[]>(
    (portfolio as any)?.allowedAccountNumbers ?? []
  );
  const [newAccountInput, setNewAccountInput] = useState('');

  // Sync portfolio name when user data loads from Firestore
  React.useEffect(() => {
    if (savedName && savedName !== portfolioName) setPortfolioName(savedName);
  }, [savedName]);

  // Sync privacy setting from portfolio data
  React.useEffect(() => {
    const p = (portfolio as any)?.privacy;
    if (p && p !== privacySetting) setPrivacySetting(p);
  }, [(portfolio as any)?.privacy]);

  // Sync allowed accounts from portfolio data
  React.useEffect(() => {
    const a = (portfolio as any)?.allowedAccountNumbers;
    if (Array.isArray(a)) setAllowedAccounts(a);
  }, [(portfolio as any)?.allowedAccountNumbers]);

  const saveAllowedAccounts = async (next: string[]) => {
    setAllowedAccounts(next);
    if (user) {
      try {
        const { updatePortfolioAllowedAccounts } = await import('../../src/services/firebase');
        await updatePortfolioAllowedAccounts(user.id, next);
      } catch {}
    }
  };
  const addAllowedAccount = () => {
    const n = newAccountInput.trim();
    if (!/^\d{8}$/.test(n)) {
      if (typeof window !== 'undefined') window.alert('Enter a valid 8-digit player number');
      return;
    }
    if (allowedAccounts.includes(n)) return;
    saveAllowedAccounts([...allowedAccounts, n]);
    setNewAccountInput('');
  };
  const removeAllowedAccount = (num: string) => {
    saveAllowedAccounts(allowedAccounts.filter(a => a !== num));
  };
  const [chartPeriod, setChartPeriod] = useState<PortfolioChartPeriod>('1M');
  const [reconstructedHistory, setReconstructedHistory] = useState<HistoryPoint[] | null>(null);
  const historyCacheRef = React.useRef<Map<string, HistoryPoint[]>>(new Map());
  const portfolioHistoryStateKey = useMemo(
    () => getPortfolioHistoryStateKey(portfolio),
    [portfolio],
  );

  // Reconstruct history from transactions when Firestore snapshots are
  // missing / too sparse to span the selected period.
  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!portfolio || !user?.id) { setReconstructedHistory(null); return; }

      // Check if existing stored history already covers the period
      const existing = (portfolio.history ?? []) as { timestamp: number; totalValue: number }[];
      const cutoffByPeriod: Record<PortfolioChartPeriod, number> = {
        '1W': Date.now() - 7 * 86400000,
        '1M': Date.now() - 30 * 86400000,
        '1Y': Date.now() - 365 * 86400000,
        'YTD': new Date(new Date().getFullYear(), 0, 1).getTime(),
        'ALL': portfolio.createdAt ?? 0,
      };
      const cutoff = cutoffByPeriod[chartPeriod];
      const inPeriod = existing.filter(p => p.timestamp >= cutoff);
      const values = inPeriod.map(p => p.totalValue);
      const rangeIsMeaningful = values.length >= 2 &&
        (Math.max(...values) - Math.min(...values) > 0.01);

      if (rangeIsMeaningful) {
        setReconstructedHistory(null); // let buildChartData use portfolio.history
        return;
      }

      // Check cache
      const cacheKey = `${user.id}:${chartPeriod}:${portfolioHistoryStateKey}`;
      const cached = historyCacheRef.current.get(cacheKey);
      if (cached) { setReconstructedHistory(cached); return; }

      try {
        const txRaw = await getTransactions(user.id);
        const tx = mergeTransactionSources(
          (txRaw as Transaction[]) ?? [],
          portfolio.orders ?? [],
          user.id,
        );
        const reconstructed = await reconstructPortfolioHistory(portfolio, tx, chartPeriod);
        if (cancelled) return;
        historyCacheRef.current.set(cacheKey, reconstructed);
        setReconstructedHistory(reconstructed);
      } catch {
        if (!cancelled) setReconstructedHistory(null);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [user?.id, chartPeriod, portfolioHistoryStateKey]);

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

  const chartResult = useMemo(
    () => buildChartData(totalValue, reconstructedHistory ?? portfolio?.history, chartPeriod, portfolio?.createdAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portfolio?.userId, portfolio?.history, reconstructedHistory, totalValue, chartPeriod, portfolio?.createdAt],
  );

  // Chart spacing: for periods where data doesn't cover the full range (e.g. 1Y but account is 3 months old),
  // push the line to the right so it only fills the proportional width
  const CHART_WIDTH = 280;
  const chartCoverage = chartResult.coverageRatio;
  const dataWidth = CHART_WIDTH * chartCoverage;
  const chartInitialSpacing = CHART_WIDTH - dataWidth + 4;
  const chartSpacing = chartResult.data.length > 1
    ? (dataWidth - 8) / (chartResult.data.length - 1)
    : dataWidth;

  const chartBaseline = chartResult.baseline;
  const chartTopValue = chartResult.topValue;

  const formatYLabel = useCallback((val: string) => {
    const n = Number(val) + chartBaseline;
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
    return '$' + Math.round(n);
  }, [chartBaseline]);

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

  // Portfolio selector screen
  if (!showPortfolio) {
    const gainColor = isGain ? Colors.market.gain : Colors.market.loss;
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: C.bg.primary }]}>
          <StatusBar barStyle="light-content" backgroundColor={C.bg.primary} />
          <AppHeader title={t('portfolio')} />
          <View style={{ flex: 1, padding: Spacing.base, paddingTop: Spacing.xl }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: C.text.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md }}>
              My Portfolios
            </Text>
            <View
              style={{
                backgroundColor: C.bg.secondary,
                borderRadius: Radius.xl,
                padding: Spacing.lg,
                borderWidth: 1.5,
                borderColor: Colors.brand.primary + '55',
                shadowColor: Colors.brand.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowPortfolio(true)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.brand.primary + '22', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>📊</Text>
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary }}>{portfolioName}</Text>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); setRenameInput(portfolioName); setRenameVisible(true); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <Text style={{ fontSize: 14 }}>✏️</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 2 }}>
                        {holdings.length} holding{holdings.length !== 1 ? 's' : ''} · {portfolioAgeDays} day{portfolioAgeDays !== 1 ? 's' : ''} old
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 18, color: C.text.tertiary }}>›</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: Spacing.xs }}>
                  <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold, color: C.text.primary }}>
                    {formatCurrency(totalValue)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: gainColor }}>
                    {isGain ? '+' : ''}{formatCurrency(totalGainLoss)}
                  </Text>
                  <Text style={{ fontSize: FontSize.sm, color: gainColor }}>
                    ({isGain ? '+' : ''}{totalGainLossPercent.toFixed(2)}%)
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Privacy Options — inside card */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTopWidth: 1,
                  borderTopColor: C.border.default,
                  marginTop: Spacing.md,
                  paddingTop: Spacing.md,
                }}
                onPress={() => setPrivacyOpen(!privacyOpen)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16 }}>
                    {privacySetting === 'private' ? '\u{1F512}' : privacySetting === 'friends_only' ? '\u{1F465}' : privacySetting === 'specific_friends' ? '\u{1F511}' : '\u{1F30D}'}
                  </Text>
                  <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: C.text.secondary }}>
                    Privacy Options
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary }}>
                    {privacySetting === 'private' ? 'Private' : privacySetting === 'friends_only' ? 'Friends Only' : privacySetting === 'specific_friends' ? 'Specific Friends' : 'Public'}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.text.tertiary }}>{privacyOpen ? '\u25B2' : '\u25BC'}</Text>
                </View>
              </TouchableOpacity>

              {privacyOpen && (
                <View style={{
                  borderRadius: Radius.md,
                  marginTop: Spacing.sm,
                  borderWidth: 1,
                  borderColor: C.border.default,
                  overflow: 'hidden',
                }}>
                  {([
                    { key: 'private' as PortfolioPrivacy, label: 'Private', desc: 'Only you can see this portfolio', icon: '\u{1F512}' },
                    { key: 'friends_only' as PortfolioPrivacy, label: 'Friends Only', desc: 'All friends can view', icon: '\u{1F465}' },
                    { key: 'specific_friends' as PortfolioPrivacy, label: 'Specific Friends Only', desc: 'Only account numbers you add', icon: '\u{1F511}' },
                    { key: 'public' as PortfolioPrivacy, label: 'Public', desc: 'Anyone can view from leaderboard', icon: '\u{1F30D}' },
                  ]).map((opt, idx) => {
                    const selected = privacySetting === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: Spacing.md,
                          backgroundColor: selected ? Colors.brand.primary + '15' : 'transparent',
                          borderTopWidth: idx > 0 ? 1 : 0,
                          borderTopColor: C.border.default,
                        }}
                        activeOpacity={0.7}
                        onPress={async () => {
                          setPrivacySetting(opt.key);
                          if (opt.key !== 'specific_friends') setPrivacyOpen(false);
                          if (user) {
                            try {
                              const { updatePortfolioPrivacy } = await import('../../src/services/firebase');
                              await updatePortfolioPrivacy(user.id, opt.key);
                            } catch {}
                          }
                        }}
                      >
                        <View style={{
                          width: 20, height: 20, borderRadius: 10,
                          borderWidth: 2,
                          borderColor: selected ? Colors.brand.primary : C.text.tertiary,
                          alignItems: 'center', justifyContent: 'center',
                          marginRight: 10,
                        }}>
                          {selected && (
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brand.primary }} />
                          )}
                        </View>
                        <Text style={{ fontSize: 16, marginRight: 8 }}>{opt.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary }}>
                            {opt.label}
                          </Text>
                          <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 2 }}>
                            {opt.desc}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {privacySetting === 'specific_friends' && (
                    <View style={{ padding: Spacing.md, borderTopWidth: 1, borderTopColor: C.border.default }}>
                      <Text style={{ fontSize: FontSize.xs, color: C.text.secondary, marginBottom: 6 }}>
                        Add 8-digit player numbers of friends allowed to view
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                        <TextInput
                          style={{ flex: 1, backgroundColor: C.bg.tertiary, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: C.text.primary, borderWidth: 1, borderColor: C.border.default, fontSize: FontSize.sm }}
                          placeholder="12345678"
                          placeholderTextColor={C.text.tertiary}
                          value={newAccountInput}
                          onChangeText={setNewAccountInput}
                          keyboardType="number-pad"
                          maxLength={8}
                        />
                        <TouchableOpacity
                          onPress={addAllowedAccount}
                          style={{ backgroundColor: Colors.brand.primary, borderRadius: Radius.sm, paddingHorizontal: 14, justifyContent: 'center' }}
                        >
                          <Text style={{ color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold }}>Add</Text>
                        </TouchableOpacity>
                      </View>
                      {allowedAccounts.length === 0 ? (
                        <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, fontStyle: 'italic' }}>No players added yet</Text>
                      ) : (
                        allowedAccounts.map((num) => (
                          <View key={num} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                            <Text style={{ fontSize: FontSize.sm, color: C.text.primary, fontFamily: 'monospace' }}>#{num}</Text>
                            <TouchableOpacity onPress={() => removeAllowedAccount(num)}>
                              <Text style={{ fontSize: FontSize.xs, color: Colors.market.loss, fontWeight: FontWeight.semibold }}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Add Portfolio card */}
            <View
              style={{
                backgroundColor: C.bg.secondary,
                borderRadius: Radius.xl,
                padding: Spacing.lg,
                marginTop: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.brand.gold + '44',
                borderStyle: 'dashed',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.brand.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>➕</Text>
                </View>
                <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary }}>Add Portfolio</Text>
              </View>
              <Text style={{ fontSize: FontSize.sm, color: C.text.secondary, lineHeight: 20, marginBottom: Spacing.md }}>
                Get another $10,000 virtual dollars to trade with a fresh strategy. Only your best-performing portfolio counts on the ranked leaderboard.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: Colors.brand.gold,
                  borderRadius: Radius.lg,
                  paddingVertical: 14,
                  alignItems: 'center',
                  shadowColor: Colors.brand.gold,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
                activeOpacity={0.8}
                onPress={() => {
                  if (typeof window !== 'undefined') {
                    window.alert('Coming soon! Multiple portfolios will be available in a future update.');
                  }
                }}
              >
                <Text style={{ color: '#0A0E1A', fontSize: FontSize.base, fontWeight: FontWeight.extrabold, letterSpacing: 0.3 }}>Add Portfolio</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Rename Modal */}
          <Modal visible={renameVisible} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl }}>
              <View style={{ width: '100%', backgroundColor: C.bg.secondary, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: C.border.default }}>
                <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: C.text.primary, marginBottom: Spacing.md }}>✏️  Rename Portfolio</Text>
                <TextInput
                  style={{ backgroundColor: C.bg.tertiary, borderRadius: Radius.md, padding: 14, fontSize: FontSize.base, color: C.text.primary, borderWidth: 1, borderColor: C.border.default, marginBottom: Spacing.md }}
                  value={renameInput}
                  onChangeText={setRenameInput}
                  placeholder="Portfolio name"
                  placeholderTextColor={Colors.text.tertiary}
                  autoFocus
                  maxLength={30}
                />
                <TouchableOpacity
                  style={{ backgroundColor: Colors.brand.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.sm, opacity: renameInput.trim() ? 1 : 0.4 }}
                  disabled={!renameInput.trim()}
                  onPress={async () => {
                    const name = renameInput.trim();
                    if (!name) return;
                    setPortfolioName(name);
                    setRenameVisible(false);
                    if (user) {
                      try {
                        const { updateUser } = await import('../../src/services/auth');
                        await updateUser(user.id, { portfolioName: name });
                      } catch {}
                    }
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold }}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ paddingVertical: 10, alignItems: 'center' }} onPress={() => setRenameVisible(false)}>
                  <Text style={{ color: C.text.tertiary, fontWeight: FontWeight.semibold }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: C.bg.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg.primary} />
      <AppHeader title={t('portfolio')} />

      {/* Back to portfolio selector */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: 4 }}
        onPress={() => setShowPortfolio(false)}
      >
        <Text style={{ color: Colors.brand.primary, fontSize: FontSize.base }}>‹ Back</Text>
        <Text style={{ color: C.text.secondary, fontSize: FontSize.sm }}> {portfolioName}</Text>
      </TouchableOpacity>

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

        {/* Period selector buttons — ABOVE the chart */}
        <View style={[styles.periodSelectorContainer, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
          {PORTFOLIO_CHART_PERIODS.map(period => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                chartPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setChartPeriod(period)}
            >
              <Text style={[
                styles.periodButtonText,
                { color: C.text.tertiary },
                chartPeriod === period && styles.periodButtonTextActive,
              ]}>
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Portfolio Chart */}
        <View style={[styles.chartCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
          {/* Period header inside chart card */}
          {(() => {
            // Fall back to lifetime portfolio P&L when the chart period
            // has no meaningful variation (common on brand new accounts
            // or when Firestore snapshots are missing).
            const usingFallback = chartResult.isFlat && Math.abs(totalGainLoss) > 0.01;
            const displayChange = usingFallback ? totalGainLoss : chartResult.changeAmount;
            const displayPercent = usingFallback ? totalGainLossPercent : chartResult.changePercent;
            const noChange = chartResult.isFlat && !usingFallback;
            const up = displayChange >= 0;
            const moveColor = up ? Colors.market.gain : Colors.market.loss;
            return (
              <>
                <View style={styles.chartHeaderRow}>
                  <Text style={[styles.chartHeaderTitle, { color: C.text.primary }]}>{getPeriodLabel(chartPeriod)}</Text>
                  <Text style={{
                    fontSize: FontSize.lg,
                    fontWeight: FontWeight.bold as any,
                    color: noChange ? C.text.primary : moveColor,
                  }}>
                    {noChange
                      ? formatCurrency(chartResult.endValue)
                      : `${up ? '+' : ''}${formatCurrency(displayChange)}`
                    }
                  </Text>
                </View>
                <View style={styles.chartSubRow}>
                  <Text style={{ color: C.text.tertiary, fontSize: FontSize.xs }}>
                    {getDateRangeText(chartPeriod, portfolio?.createdAt)}
                  </Text>
                  <Text style={{
                    fontSize: FontSize.xs,
                    color: noChange ? C.text.tertiary : moveColor,
                  }}>
                    {noChange
                      ? 'No change'
                      : `${up ? '+' : ''}${displayPercent.toFixed(2)}%`
                    }
                  </Text>
                </View>
              </>
            );
          })()}

          {chartResult.data.length > 0 ? (
            <LineChart
              data={chartResult.data}
              width={CHART_WIDTH}
              height={160}
              color={chartResult.changeAmount >= 0 ? Colors.market.gain : Colors.market.loss}
              thickness={2}
              hideDataPoints={chartResult.dataPoints > 30}
              dataPointsColor={chartResult.changeAmount >= 0 ? Colors.market.gain : Colors.market.loss}
              dataPointsRadius={3}
              startFillColor={(chartResult.changeAmount >= 0 ? Colors.market.gain : Colors.market.loss) + '40'}
              endFillColor={(chartResult.changeAmount >= 0 ? Colors.market.gain : Colors.market.loss) + '05'}
              startOpacity={0.3}
              endOpacity={0}
              areaChart
              hideRules
              hideAxesAndRules={false}
              yAxisColor="transparent"
              xAxisColor={C.border.default}
              yAxisTextStyle={{ color: C.text.tertiary, fontSize: 10 }}
              formatYLabel={formatYLabel}
              yAxisLabelWidth={50}
              maxValue={chartTopValue}
              noOfSections={4}
              backgroundColor="transparent"
              spacing={chartSpacing}
              initialSpacing={chartInitialSpacing}
              endSpacing={4}
              minValue={0}
            />
          ) : (
            <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.text.tertiary, fontSize: 14 }}>{t('no_perf_data')}</Text>
            </View>
          )}
        </View>

        {/* Pending Limit Orders */}
        {pendingOrders.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.text.primary }]}>Pending Orders ({pendingOrders.length})</Text>
            </View>
            <View style={[styles.card, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
              {pendingOrders.map((order, i) => {
                const isBuy = order.type === 'buy';
                return (
                  <View key={order.id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: C.border.default, marginVertical: Spacing.sm }} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm }}>
                      {/* Left: Order info */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <View style={{
                            backgroundColor: isBuy ? Colors.market.gainBg : Colors.market.lossBg,
                            paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm,
                          }}>
                            <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: isBuy ? Colors.market.gain : Colors.market.loss }}>
                              {isBuy ? 'LIMIT BUY' : 'LIMIT SELL'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: C.text.primary }}>{order.symbol}</Text>
                        </View>
                        <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary }}>
                          {formatShares(order.shares ?? 0)} shares · Target: {formatCurrency(order.limitPrice ?? 0)}
                        </Text>
                        <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 2 }}>
                          Placed {formatRelativeTime(order.createdAt)}
                        </Text>
                      </View>
                      {/* Right: Status + Cancel */}
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={{ backgroundColor: Colors.brand.gold + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm }}>
                          <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.brand.gold }}>PENDING</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removePendingOrder(order.id)}
                          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                        >
                          <Text style={{ fontSize: FontSize.xs, color: Colors.market.loss, fontWeight: FontWeight.semibold }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

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

        {/* Privacy Options */}
        <View style={{ marginHorizontal: Spacing.base, marginTop: Spacing.lg }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: C.bg.secondary,
              borderRadius: Radius.lg,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: C.border.default,
            }}
            onPress={() => setPrivacyOpen(!privacyOpen)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>
                {privacySetting === 'private' ? '\u{1F512}' : privacySetting === 'friends_only' ? '\u{1F465}' : privacySetting === 'specific_friends' ? '\u{1F511}' : '\u{1F30D}'}
              </Text>
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary }}>
                Privacy Options
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary }}>
                {privacySetting === 'private' ? 'Private' : privacySetting === 'friends_only' ? 'Friends Only' : privacySetting === 'specific_friends' ? 'Specific Friends' : 'Public'}
              </Text>
              <Text style={{ fontSize: 12, color: C.text.tertiary }}>{privacyOpen ? '\u25B2' : '\u25BC'}</Text>
            </View>
          </TouchableOpacity>

          {privacyOpen && (
            <View style={{
              backgroundColor: C.bg.secondary,
              borderRadius: Radius.lg,
              marginTop: 4,
              borderWidth: 1,
              borderColor: C.border.default,
              overflow: 'hidden',
            }}>
              {([
                { key: 'private' as PortfolioPrivacy, label: 'Private', desc: 'Only you can see this portfolio', icon: '\u{1F512}' },
                { key: 'friends_only' as PortfolioPrivacy, label: 'Friends Only', desc: 'Friends can view from chat', icon: '\u{1F465}' },
                { key: 'public' as PortfolioPrivacy, label: 'Public', desc: 'Anyone can view from leaderboard', icon: '\u{1F30D}' },
              ]).map((opt, idx) => {
                const selected = privacySetting === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: Spacing.md,
                      backgroundColor: selected ? Colors.brand.primary + '15' : 'transparent',
                      borderTopWidth: idx > 0 ? 1 : 0,
                      borderTopColor: C.border.default,
                    }}
                    activeOpacity={0.7}
                    onPress={async () => {
                      setPrivacySetting(opt.key);
                      if (opt.key !== 'specific_friends') setPrivacyOpen(false);
                      if (user) {
                        try {
                          const { updatePortfolioPrivacy } = await import('../../src/services/firebase');
                          await updatePortfolioPrivacy(user.id, opt.key);
                        } catch {}
                      }
                    }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 10,
                      borderWidth: 2,
                      borderColor: selected ? Colors.brand.primary : C.text.tertiary,
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: 10,
                    }}>
                      {selected && (
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brand.primary }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: C.text.primary }}>
                        {opt.label}
                      </Text>
                      <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {privacySetting === 'specific_friends' && (
                <View style={{ padding: Spacing.md, borderTopWidth: 1, borderTopColor: C.border.default }}>
                  <Text style={{ fontSize: FontSize.xs, color: C.text.secondary, marginBottom: 6 }}>
                    Add 8-digit player numbers of friends allowed to view
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    <TextInput
                      style={{ flex: 1, backgroundColor: C.bg.tertiary, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8, color: C.text.primary, borderWidth: 1, borderColor: C.border.default, fontSize: FontSize.sm }}
                      placeholder="12345678"
                      placeholderTextColor={C.text.tertiary}
                      value={newAccountInput}
                      onChangeText={setNewAccountInput}
                      keyboardType="number-pad"
                      maxLength={8}
                    />
                    <TouchableOpacity
                      onPress={addAllowedAccount}
                      style={{ backgroundColor: Colors.brand.primary, borderRadius: Radius.sm, paddingHorizontal: 14, justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                  {allowedAccounts.length === 0 ? (
                    <Text style={{ fontSize: FontSize.xs, color: C.text.tertiary, fontStyle: 'italic' }}>No players added yet</Text>
                  ) : (
                    allowedAccounts.map((num) => (
                      <View key={num} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                        <Text style={{ fontSize: FontSize.sm, color: C.text.primary, fontFamily: 'monospace' }}>#{num}</Text>
                        <TouchableOpacity onPress={() => removeAllowedAccount(num)}>
                          <Text style={{ fontSize: FontSize.xs, color: Colors.market.loss, fontWeight: FontWeight.semibold }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          )}
        </View>

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
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.sm,
    marginBottom: 2,
  },
  chartHeaderTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  chartSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  periodSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    padding: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: 'transparent',
  },
  periodButtonActive: {
    backgroundColor: Colors.brand.primary + '20',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
  },
  periodButtonText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.medium,
  },
  periodButtonTextActive: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.bold,
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
