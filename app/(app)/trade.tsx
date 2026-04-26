import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-gifted-charts';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';

import { useAppStore } from '../../src/store/useAppStore';
import {
  formatCurrency,
  formatPercent,
  formatShares,
  formatVolume,
  formatRelativeTime,
} from '../../src/utils/formatters';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { placeOrder } from '../../src/services/tradingEngine';
import {
  getStockProfile,
  getChartData,
  searchStocks,
  getCompanyNews,
  type SearchResult,
} from '../../src/services/stockApi';
import { auth } from '../../src/services/firebase';
import { getUserById, getPortfolio, initPortfolio, updatePortfolio } from '../../src/services/auth';
import type { Stock, ChartDataPoint, ChartPeriod, NewsArticle, User, Portfolio } from '../../src/types';
import { useT } from '../../src/constants/translations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.base * 2;
const CHART_PERIODS: ChartPeriod[] = ['1D', '1W', '1M', '1Y', '5Y'];

// ─── Seeded placeholder chart data ─────────────────────────────────────────

function chartPointsForPeriod(period: ChartPeriod, basePrice: number): ChartDataPoint[] {
  // Period config: points, stepMs between bars, volatility scale
  const config: Record<ChartPeriod, { points: number; stepMs: number; volScale: number }> = {
    '1D':  { points: 78,  stepMs: 5 * 60_000,            volScale: 0.35 },   // 5-min bars, ~6.5 hrs
    '1W':  { points: 130, stepMs: 15 * 60_000,           volScale: 0.6 },    // 15-min bars
    '1M':  { points: 150, stepMs: 60 * 60_000,           volScale: 1.2 },    // hourly bars
    '1Y':  { points: 252, stepMs: 24 * 3600_000,         volScale: 3.0 },    // daily bars
    '5Y':  { points: 260, stepMs: 7 * 24 * 3600_000,     volScale: 6.0 },    // weekly bars
  };
  const { points, stepMs, volScale } = config[period];
  const dailyVol = 0.025; // base daily volatility
  const vol = dailyVol * volScale;

  // Seeded pseudo-random — include period so each timeframe looks different
  const baseSeed = Math.round(basePrice * 1000) + period.charCodeAt(0) * 137;
  let rngState = baseSeed;
  function seededRandom(): number {
    rngState = (rngState * 1664525 + 1013904223) & 0x7fffffff;
    return rngState / 0x7fffffff;
  }
  function normalRandom(): number {
    const u1 = seededRandom() || 0.001;
    const u2 = seededRandom();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Work backwards from current price using geometric Brownian motion
  const now = Date.now();
  const prices: number[] = [basePrice];
  for (let i = 1; i < points; i++) {
    const prev = prices[i - 1];
    const drift = -0.0002;
    const shock = normalRandom() * vol;
    prices.push(prev * Math.exp(-(drift + shock)));
  }
  prices.reverse(); // oldest → newest

  return prices.map((close, i) => {
    const timestamp = now - (points - 1 - i) * stepMs;
    const intraVol = close * vol * 0.3;
    const open = close + (seededRandom() - 0.5) * intraVol;
    const high = Math.max(open, close) + seededRandom() * intraVol * 0.5;
    const low = Math.min(open, close) - seededRandom() * intraVol * 0.5;
    const volume = Math.floor(5_000_000 + seededRandom() * 30_000_000);
    return {
      timestamp,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    };
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TradeScreen() {
  const { user, portfolio, setUser, setPortfolio, setQuote, appColorMode, appTabColors, watchlist, addToWatchlist, removeFromWatchlist } = useAppStore();
  const t = useT();
  const tabColor = appTabColors['trade'] ?? '#00C853';
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;
  const screenBg = isLight ? C.bg.primary : Colors.bg.primary;
  const params = useLocalSearchParams<{ symbol?: string }>();

  // Recover user and portfolio from Firebase if Zustand store is empty
  // (handles race condition where auth listener hasn't finished yet)
  useEffect(() => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    if (!user) {
      getUserById(firebaseUser.uid).then((data) => {
        if (data) {
          setUser(data as User);
        } else {
          // Firestore doc missing — use minimal user from Firebase Auth
          setUser({
            id: firebaseUser.uid,
            username: firebaseUser.displayName || 'Player',
            displayName: firebaseUser.displayName || 'Player',
            email: firebaseUser.email || '',
            accountNumber: '',
            level: 1, xp: 0, achievements: [], badges: [],
            clubIds: [], friendIds: [], country: '',
            createdAt: Date.now(), lastActive: Date.now(),
            onboardingComplete: true, startingBalance: 0,
          } as User);
        }
      }).catch(() => {});
    }

    if (!portfolio) {
      getPortfolio(firebaseUser.uid).then((data) => {
        if (data) {
          const p = data as Record<string, unknown>;
          if (!p.holdings) p.holdings = [];
          setPortfolio(p as Portfolio);
        }
      }).catch(() => {});
    }
  }, [user, portfolio]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stock state
  const [stock, setStock] = useState<Stock | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  // Chart state
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('1M');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // Order panel state
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPriceInput, setLimitPriceInput] = useState('');
  const [inputMode, setInputMode] = useState<'dollars' | 'shares'>('dollars');
  const [inputValue, setInputValue] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Derived values ────────────────────────────────────────────────────────

  const isGain = (stock?.changePercent ?? 0) >= 0;
  const priceColor = isGain ? Colors.market.gain : Colors.market.loss;
  const priceColorBg = isGain ? Colors.market.gainBg : Colors.market.lossBg;

  const currentHolding = portfolio?.holdings.find(h => h.symbol === stock?.symbol);
  const sharesOwned = currentHolding?.shares ?? 0;
  const availableCash = portfolio?.cashBalance ?? 0;

  const parsedInput = parseFloat(inputValue) || 0;
  const estimatedShares = inputMode === 'dollars' && stock
    ? parsedInput / stock.price
    : parsedInput;
  const estimatedCost = inputMode === 'shares' && stock
    ? parsedInput * stock.price
    : parsedInput;

  // Use Firebase Auth directly as the source of truth for authentication.
  // Always read auth.currentUser live (not via useCallback cache) since it
  // can become available after the component mounts.
  const getAuthUserId = (): string | null => {
    if (user?.id) return user.id;
    return auth.currentUser?.uid ?? null;
  };

  const canPlaceOrder = parsedInput > 0 && !!stock;

  const handleOrderButtonPress = useCallback(async () => {
    if (!stock) {
      Toast.show({
        type: 'error',
        text1: 'Select a stock first',
        text2: 'Search for a stock using the search bar above, then tap a result.',
      });
      return;
    }

    // Check auth — if store has no user, try to recover from Firebase Auth
    let activeUser = user;
    if (!activeUser) {
      const fbUser = auth.currentUser;
      if (fbUser) {
        // Recover user into the store
        try {
          const data = await getUserById(fbUser.uid);
          if (data) {
            activeUser = data as User;
          } else {
            activeUser = {
              id: fbUser.uid,
              username: fbUser.displayName || 'Player',
              displayName: fbUser.displayName || 'Player',
              email: fbUser.email || '',
              accountNumber: '', level: 1, xp: 0,
              achievements: [], badges: [], clubIds: [], friendIds: [],
              country: '', createdAt: Date.now(), lastActive: Date.now(),
              onboardingComplete: true, startingBalance: 0,
            } as User;
          }
          setUser(activeUser);
        } catch {
          activeUser = {
            id: fbUser.uid,
            username: fbUser.displayName || 'Player',
            displayName: fbUser.displayName || 'Player',
            email: fbUser.email || '',
            accountNumber: '', level: 1, xp: 0,
            achievements: [], badges: [], clubIds: [], friendIds: [],
            country: '', createdAt: Date.now(), lastActive: Date.now(),
            onboardingComplete: true, startingBalance: 0,
          } as User;
          setUser(activeUser);
        }
      }
    }

    if (!activeUser) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please log in to trade.' });
      return;
    }

    // Also recover portfolio if store is empty
    let activePortfolio = useAppStore.getState().portfolio;
    if (!activePortfolio) {
      try {
        const pData = await getPortfolio(activeUser.id);
        if (pData) {
          const p = pData as Record<string, unknown>;
          if (!p.holdings) p.holdings = [];
          activePortfolio = p as Portfolio;
          setPortfolio(activePortfolio);
        }
      } catch {}
    }

    // 🛑 The previous "Portfolio restored" safety net called initPortfolio()
    // any time local cash hit $0 and holdings was empty — but a stale or
    // mid-load local copy could trigger this and OVERWRITE the real
    // Firestore portfolio. Now: double-check Firestore directly before
    // doing anything destructive. Only init if the remote is also empty.
    if (activePortfolio && activePortfolio.cashBalance === 0 && (!activePortfolio.holdings || activePortfolio.holdings.length === 0)) {
      const remote = await getPortfolio(activeUser.id).catch(() => null) as Record<string, unknown> | null;
      const remoteCash = (remote?.cashBalance as number) ?? 0;
      const remoteHoldings = (remote?.holdings as unknown[]) ?? [];
      if (remote && (remoteCash > 0 || remoteHoldings.length > 0)) {
        // Firestore has real data — our local copy was stale. Reload, don't wipe.
        if (!remote.holdings) remote.holdings = [];
        activePortfolio = remote as Portfolio;
        setPortfolio(activePortfolio);
      } else {
        // Genuinely empty everywhere — safe to init.
        const startBal = activePortfolio.startingBalance || activeUser.startingBalance || 10000;
        try {
          await initPortfolio(activeUser.id, startBal);
          activePortfolio = { ...activePortfolio, cashBalance: startBal, totalValue: startBal, startingBalance: startBal };
          setPortfolio(activePortfolio);
          Toast.show({ type: 'success', text1: 'Portfolio restored', text2: `Your $${startBal.toLocaleString()} balance has been restored.` });
        } catch {}
      }
    }
    // If portfolio doesn't exist at all, create one
    if (!activePortfolio) {
      const startBal = activeUser.startingBalance || 10000;
      try {
        await initPortfolio(activeUser.id, startBal);
        activePortfolio = {
          userId: activeUser.id, cashBalance: startBal, startingBalance: startBal,
          totalValue: startBal, investedValue: 0, totalGainLoss: 0, totalGainLossPercent: 0,
          holdings: [], orders: [], createdAt: Date.now(),
        } as Portfolio;
        setPortfolio(activePortfolio);
        Toast.show({ type: 'success', text1: 'Portfolio created', text2: `Starting with $${startBal.toLocaleString()}.` });
      } catch {}
    }

    const activeCash = activePortfolio?.cashBalance ?? 0;
    const activeHolding = activePortfolio?.holdings?.find((h: any) => h.symbol === stock.symbol);
    const activeSharesOwned = activeHolding?.shares ?? 0;

    if (!inputValue || parsedInput <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Enter an amount',
        text2: inputMode === 'dollars'
          ? 'Type a dollar amount to invest, e.g. 100'
          : 'Type the number of shares to trade, e.g. 1',
      });
      return;
    }
    // Allow 1-cent tolerance for floating-point drift from fractional share math.
    // Without this, typing exactly the displayed cash fails because the stored
    // value is ~$X.99999998 due to accumulated fractional-share rounding.
    if (orderSide === 'buy' && parsedInput > activeCash + 0.01 && inputMode === 'dollars') {
      Toast.show({ type: 'error', text1: 'Insufficient funds', text2: `You only have ${formatCurrency(activeCash)} available.` });
      return;
    }
    if (orderSide === 'sell' && estimatedShares > activeSharesOwned) {
      Toast.show({ type: 'error', text1: 'Not enough shares', text2: `You only own ${formatShares(activeSharesOwned)} ${stock.symbol}.` });
      return;
    }
    setShowConfirmModal(true);
  }, [stock, user, inputValue, parsedInput, inputMode, orderSide, estimatedShares]);

  // ─── Auto-load stock from navigation params ────────────────────────────────

  useEffect(() => {
    const sym = params.symbol;
    if (sym && sym !== stock?.symbol) {
      handleSelectStock(sym);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.symbol]);

  // ─── Search ────────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 1) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setIsSearching(true);
    setShowSearchResults(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchStocks(text);
      setSearchResults(results.slice(0, 10));
      setIsSearching(false);
    }, 400);
  }, []);

  const loadNews = useCallback(async (symbol: string, showSpinner = true) => {
    if (showSpinner) setIsLoadingNews(true);
    try {
      const articles = await getCompanyNews(symbol);
      setNews(articles);
    } finally {
      if (showSpinner) setIsLoadingNews(false);
    }
  }, []);

  const handleSelectStock = useCallback(async (symbol: string) => {
    setShowSearchResults(false);
    setSearchQuery(symbol);
    setInputValue('');
    setIsLoadingStock(true);
    try {
      const profile = await getStockProfile(symbol);
      if (profile) {
        setStock(profile);
        setQuote(symbol, {
          symbol,
          price: profile.price,
          change: profile.change,
          changePercent: profile.changePercent,
          timestamp: Date.now(),
        });
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    } finally {
      setIsLoadingStock(false);
    }
    await loadNews(symbol);
  }, [fadeAnim, setQuote, loadNews]);

  // Refresh news whenever the Buy/Sell screen regains focus (e.g. user
  // navigates back to it) and poll periodically while it's open, so the
  // news feed stays current as people use the app.
  useFocusEffect(
    useCallback(() => {
      const symbol = stock?.symbol;
      if (!symbol) return;
      loadNews(symbol, false);
      const id = setInterval(() => loadNews(symbol, false), 60_000);
      return () => clearInterval(id);
    }, [stock?.symbol, loadNews])
  );

  // ─── Chart data ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!stock) return;
    setIsLoadingChart(true);
    let cancelled = false;
    (async () => {
      const apiData = await getChartData(stock.symbol, chartPeriod, stock.price);
      if (cancelled) return;
      const isReal = apiData.length > 0;
      const data = isReal ? apiData : chartPointsForPeriod(chartPeriod, stock.price);
      console.log(`[Chart] ${stock.symbol} ${chartPeriod}: ${isReal ? 'REAL Yahoo data' : 'FALLBACK mock data'}, ${data.length} points, range: $${Math.min(...data.map(p=>p.close)).toFixed(2)} - $${Math.max(...data.map(p=>p.close)).toFixed(2)}`);
      setChartData(data);
      setIsLoadingChart(false);
    })();
    return () => { cancelled = true; };
  }, [stock?.symbol, chartPeriod]);

  // ─── Derived chart values ──────────────────────────────────────────────────

  // Pre-normalize data: subtract the baseline so the chart line fills the
  // full vertical area instead of being squished at the top.
  const chartBaseline = useMemo(() => {
    if (!chartData.length) return 0;
    const closes = chartData.map(p => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || max * 0.01;
    return min - range * 0.08; // 8% padding below min
  }, [chartData]);

  const chartLineData = useMemo(
    () => chartData.map(p => ({ value: p.close - chartBaseline })),
    [chartData, chartBaseline]
  );

  const chartTopValue = useMemo(() => {
    if (!chartData.length) return 100;
    const closes = chartData.map(p => p.close);
    const max = Math.max(...closes);
    const min = Math.min(...closes);
    const range = max - min || max * 0.01;
    return (max + range * 0.08) - chartBaseline;
  }, [chartData, chartBaseline]);

  const yAxisLabelFormatter = useCallback((val: string) => {
    const n = Number(val) + chartBaseline;
    if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    if (n >= 100) return `$${n.toFixed(0)}`;
    if (n >= 10) return `$${n.toFixed(1)}`;
    return `$${n.toFixed(2)}`;
  }, [chartBaseline]);

  const chartColor = chartData.length && chartData[chartData.length - 1].close >= chartData[0].close
    ? Colors.market.gain
    : Colors.market.loss;

  // ─── Order placement ───────────────────────────────────────────────────────

  const handlePlaceOrder = useCallback(async () => {
    // Get userId from store or Firebase Auth directly
    const storeUser = useAppStore.getState().user;
    const userId = storeUser?.id ?? auth.currentUser?.uid;
    if (!canPlaceOrder || !userId || !stock) return;
    setShowConfirmModal(false);
    setIsPlacingOrder(true);
    try {
      const parsedLimit = parseFloat(limitPriceInput) || 0;
      const result = await placeOrder({
        userId,
        symbol: stock.symbol,
        type: orderSide,
        ...(inputMode === 'dollars'
          ? { dollarAmount: parsedInput }
          : { shares: parsedInput }),
        orderType,
        ...(orderType === 'limit' && parsedLimit > 0 ? { limitPrice: parsedLimit } : {}),
        userName: storeUser?.displayName ?? auth.currentUser?.displayName ?? 'Player',
        country: storeUser?.country ?? '',
      });
      if (result.success) {
        if (result.status === 'pending') {
          Toast.show({
            type: 'info',
            text1: 'Limit Order Placed',
            text2: `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${stock.symbol} when price ${orderSide === 'buy' ? '≤' : '≥'} ${formatCurrency(parsedLimit)}`,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'Order Filled',
            text2: `${orderSide === 'buy' ? 'Bought' : 'Sold'} ${formatShares(result.filledShares ?? 0)} ${stock.symbol} @ ${formatCurrency(result.filledPrice ?? 0)}`,
          });
        }
        setInputValue('');
        setLimitPriceInput('');
        setOrderType('market');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Order Failed',
          text2: result.error ?? 'Something went wrong.',
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Order Failed',
        text2: 'Unable to place order. Please try again.',
      });
    } finally {
      setIsPlacingOrder(false);
    }
  }, [canPlaceOrder, stock, orderSide, inputMode, parsedInput, orderType, limitPriceInput]);

  // ─── Render helpers ────────────────────────────────────────────────────────

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleSelectStock(item.symbol)}
    >
      <View style={styles.searchResultLeft}>
        <Text style={styles.searchResultSymbol}>{item.displaySymbol || item.symbol}</Text>
        <Text style={styles.searchResultName} numberOfLines={1}>{item.name}</Text>
      </View>
      <Text style={styles.searchResultType}>{item.type}</Text>
    </TouchableOpacity>
  );

  const handleNewsPress = useCallback((article: NewsArticle) => {
    // Track article reads for deep_researcher achievement
    const currentUser = useAppStore.getState().user;
    if (currentUser) {
      const count = ((currentUser as any).newsArticlesRead ?? 0) + 1;
      const updated = { ...currentUser, newsArticlesRead: count };
      useAppStore.getState().setUser(updated as User);
      import('../../src/services/auth').then(({ updateUser: uu }) => {
        uu(currentUser.id, { newsArticlesRead: count }).catch(() => {});
      });
    }
    // Navigate to the news article detail screen
    if (article.url) {
      import('expo-router').then(({ router: r }) => {
        r.push({ pathname: '/(app)/news-article', params: { url: article.url, headline: article.headline, source: article.source } });
      });
    }
  }, []);

  const renderNewsItem = (article: NewsArticle) => (
    <TouchableOpacity key={article.id} style={styles.newsCard} onPress={() => handleNewsPress(article)} activeOpacity={0.7}>
      <View style={styles.newsHeader}>
        <Text style={styles.newsSource}>{article.source}</Text>
        <Text style={styles.newsTime}>{formatRelativeTime(article.publishedAt)}</Text>
      </View>
      <Text style={styles.newsHeadline} numberOfLines={3}>{article.headline}</Text>
      {article.summary ? (
        <Text style={styles.newsSummary} numberOfLines={2}>{article.summary}</Text>
      ) : null}
    </TouchableOpacity>
  );

  // ─── Confirmation modal content ────────────────────────────────────────────

  const confirmOrderShares = inputMode === 'dollars' ? estimatedShares : parsedInput;
  const confirmOrderCost = inputMode === 'dollars' ? parsedInput : estimatedCost;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {/* Header */}
        <LinearGradient
          colors={[`${tabColor}CC`, `${tabColor}88`, `${tabColor}22`, screenBg] as any}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Trade</Text>
        </LinearGradient>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('search_stocks')}
              placeholderTextColor={Colors.text.tertiary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
              autoCapitalize="characters"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Dropdown */}
          {showSearchResults && (
            <View style={styles.searchDropdown}>
              {isSearching ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator color={Colors.brand.primary} size="small" />
                  <Text style={styles.searchLoadingText}>Searching…</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <Text style={styles.noResultsText}>{t('no_results')}</Text>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={item => item.symbol}
                  renderItem={renderSearchResult}
                  keyboardShouldPersistTaps="handled"
                  style={styles.searchList}
                />
              )}
            </View>
          )}
        </View>

        {/* Loading state */}
        {isLoadingStock && (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={Colors.brand.primary} size="large" />
            <Text style={styles.loadingText}>Loading stock…</Text>
          </View>
        )}

        {/* Empty state */}
        {!isLoadingStock && !stock && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📈</Text>
            <Text style={styles.emptyTitle}>{t('find_stock')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('search_stock_desc')}
            </Text>
          </View>
        )}

        {/* Stock detail + order panel */}
        {!isLoadingStock && stock && (
          <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Stock Header ── */}
              <View style={styles.stockHeader}>
                <View style={styles.stockTitleRow}>
                  <View style={styles.stockTitleLeft}>
                    <Text style={styles.stockName} numberOfLines={1}>{stock.name}</Text>
                    <View style={styles.stockMeta}>
                      <Text style={styles.stockSymbol}>{stock.symbol}</Text>
                      {stock.exchange ? (
                        <Text style={styles.stockExchange}> · {stock.exchange}</Text>
                      ) : null}
                      <View style={[
                        styles.marketStatusBadge,
                        { backgroundColor: stock.isOpen ? Colors.market.gainBg : Colors.market.lossBg },
                      ]}>
                        <Text style={[
                          styles.marketStatusText,
                          { color: stock.isOpen ? Colors.market.gain : Colors.market.loss },
                        ]}>
                          {stock.isOpen ? t('open') : t('closed')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentPrice}>{formatCurrency(stock.price)}</Text>
                    <View style={[styles.changeBadge, { backgroundColor: priceColorBg, alignSelf: 'flex-start', marginTop: 4 }]}>
                      <Text style={[styles.changeText, { color: priceColor }]}>
                        {stock.change >= 0 ? '+' : ''}{formatCurrency(stock.change)} ({formatPercent(stock.changePercent)})
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (watchlist.includes(stock.symbol)) {
                        removeFromWatchlist(stock.symbol);
                        Toast.show({ type: 'success', text1: `${stock.symbol} removed from watchlist` });
                      } else {
                        addToWatchlist(stock.symbol);
                        Toast.show({ type: 'success', text1: `${stock.symbol} added to watchlist` });
                      }
                    }}
                    style={[
                      styles.watchlistHeaderBtn,
                      watchlist.includes(stock.symbol) && styles.watchlistHeaderBtnActive,
                    ]}
                  >
                    <Text style={styles.watchlistHeaderBtnIcon}>
                      {watchlist.includes(stock.symbol) ? '★' : '☆'}
                    </Text>
                    <Text style={[
                      styles.watchlistHeaderBtnText,
                      watchlist.includes(stock.symbol) && styles.watchlistHeaderBtnTextActive,
                    ]}>
                      {watchlist.includes(stock.symbol) ? t('watching') : t('watch')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Chart ── */}
              <View style={styles.chartContainer}>
                {isLoadingChart ? (
                  <View style={styles.chartPlaceholder}>
                    <ActivityIndicator color={Colors.brand.primary} />
                  </View>
                ) : chartLineData.length > 0 ? (
                  <LineChart
                    data={chartLineData}
                    width={CHART_WIDTH - Spacing.base * 2 - 50}
                    height={200}
                    color={chartColor}
                    thickness={1.5}
                    hideDataPoints
                    areaChart
                    startFillColor={chartColor}
                    endFillColor={Colors.bg.primary}
                    startOpacity={0.2}
                    endOpacity={0}
                    backgroundColor={Colors.bg.secondary}
                    yAxisColor="transparent"
                    xAxisColor={Colors.border.default}
                    rulesColor={Colors.chart.grid}
                    rulesType="solid"
                    yAxisTextStyle={{ color: Colors.text.tertiary, fontSize: 9 }}
                    formatYLabel={yAxisLabelFormatter}
                    yAxisLabelWidth={46}
                    xAxisLabelTextStyle={{ color: Colors.text.tertiary, fontSize: 9 }}
                    maxValue={chartTopValue}
                    noOfSections={4}
                    adjustToWidth
                    disableScroll
                  />
                ) : (
                  <View style={styles.chartPlaceholder}>
                    <Text style={styles.noDataText}>No chart data available</Text>
                  </View>
                )}

                {/* Period Selector */}
                <View style={styles.periodSelector}>
                  {CHART_PERIODS.map(period => (
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
                        chartPeriod === period && styles.periodButtonTextActive,
                      ]}>
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── Key Stats ── */}
              <View style={styles.statsGrid}>
                <StatItem label="Market Cap" value={stock.marketCap ? formatCurrency(stock.marketCap, 'USD', true) : '—'} />
                <StatItem label="P/E Ratio" value={stock.pe ? stock.pe.toFixed(2) : '—'} />
                <StatItem label={t('volume')} value={formatVolume(stock.volume)} />
                <StatItem label={t('w52_high')} value={stock.high52w ? formatCurrency(stock.high52w) : '—'} />
                <StatItem label={t('w52_low')} value={stock.low52w ? formatCurrency(stock.low52w) : '—'} />
                {stock.dividend != null && (
                  <StatItem label={t('dividend')} value={formatPercent(stock.dividend)} />
                )}
              </View>

              {/* ── Order Panel ── */}
              <View style={styles.orderPanel}>
                <Text style={styles.sectionTitle}>{t('place_order')}</Text>

                {/* Buy / Sell Toggle */}
                <View style={styles.sideToggle}>
                  <TouchableOpacity
                    style={[
                      styles.sideButton,
                      orderSide === 'buy' && styles.sideButtonBuyActive,
                    ]}
                    onPress={() => setOrderSide('buy')}
                  >
                    <Text style={[
                      styles.sideButtonText,
                      orderSide === 'buy' && styles.sideButtonTextActive,
                    ]}>{t('buy')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sideButton,
                      orderSide === 'sell' && styles.sideButtonSellActive,
                    ]}
                    onPress={() => setOrderSide('sell')}
                  >
                    <Text style={[
                      styles.sideButtonText,
                      orderSide === 'sell' && styles.sideButtonTextActive,
                    ]}>{t('sell')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Market / Limit Toggle */}
                <View style={styles.inputModeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.inputModeButton,
                      orderType === 'market' && styles.inputModeButtonActive,
                    ]}
                    onPress={() => { setOrderType('market'); setLimitPriceInput(''); }}
                  >
                    <Text style={[
                      styles.inputModeText,
                      orderType === 'market' && styles.inputModeTextActive,
                    ]}>Market</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.inputModeButton,
                      orderType === 'limit' && styles.inputModeButtonActive,
                    ]}
                    onPress={() => setOrderType('limit')}
                  >
                    <Text style={[
                      styles.inputModeText,
                      orderType === 'limit' && styles.inputModeTextActive,
                    ]}>Limit</Text>
                  </TouchableOpacity>
                </View>

                {/* Limit Price Input */}
                {orderType === 'limit' && (
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.amountPrefix}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      value={limitPriceInput}
                      onChangeText={text => setLimitPriceInput(text.replace(/[^0-9.]/g, ''))}
                      placeholder={`Limit price (now ${formatCurrency(stock.price)})`}
                      placeholderTextColor={Colors.text.tertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

                {/* Dollars / Shares Toggle */}
                <View style={styles.inputModeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.inputModeButton,
                      inputMode === 'dollars' && styles.inputModeButtonActive,
                    ]}
                    onPress={() => { setInputMode('dollars'); setInputValue(''); }}
                  >
                    <Text style={[
                      styles.inputModeText,
                      inputMode === 'dollars' && styles.inputModeTextActive,
                    ]}>{t('dollars')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.inputModeButton,
                      inputMode === 'shares' && styles.inputModeButtonActive,
                    ]}
                    onPress={() => { setInputMode('shares'); setInputValue(''); }}
                  >
                    <Text style={[
                      styles.inputModeText,
                      inputMode === 'shares' && styles.inputModeTextActive,
                    ]}>{t('num_shares')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Numeric Input */}
                <View style={styles.amountInputContainer}>
                  <Text style={styles.amountPrefix}>
                    {inputMode === 'dollars' ? '$' : '#'}
                  </Text>
                  <TextInput
                    style={styles.amountInput}
                    value={inputValue}
                    onChangeText={text => setInputValue(text.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    placeholderTextColor={Colors.text.tertiary}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Estimate row */}
                {parsedInput > 0 && (
                  <View style={styles.estimateRow}>
                    {inputMode === 'dollars' ? (
                      <Text style={styles.estimateText}>
                        ≈ {formatShares(estimatedShares)} shares @ {formatCurrency(stock.price)}
                      </Text>
                    ) : (
                      <Text style={styles.estimateText}>
                        ≈ {formatCurrency(estimatedCost)} total
                      </Text>
                    )}
                  </View>
                )}

                {/* Balance / Shares row */}
                <View style={styles.balanceRow}>
                  {orderSide === 'buy' ? (
                    <>
                      <Text style={styles.balanceLabel}>{t('available_cash')}</Text>
                      <Text style={styles.balanceValue}>{formatCurrency(availableCash)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.balanceLabel}>{t('shares_owned')}</Text>
                      <Text style={styles.balanceValue}>{formatShares(sharesOwned)} {stock.symbol}</Text>
                    </>
                  )}
                </View>

                {/* Sell All Button — only visible when player owns shares */}
                {sharesOwned > 0 && (
                  <TouchableOpacity
                    style={{ backgroundColor: Colors.market.lossBg, borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center', marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.market.loss + '44' }}
                    onPress={() => {
                      setOrderSide('sell');
                      setInputMode('shares');
                      setInputValue(String(sharesOwned));
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={{ color: Colors.market.loss, fontSize: FontSize.base, fontWeight: FontWeight.bold }}>
                      Sell All {formatShares(sharesOwned)} {stock.symbol}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Place Order Button */}
                <TouchableOpacity
                  style={[styles.placeOrderButton, !canPlaceOrder && styles.placeOrderButtonDisabled]}
                  onPress={handleOrderButtonPress}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={
                      orderSide === 'buy'
                        ? ['#00C853', '#00A846']
                        : ['#FF3D57', '#D9002E']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.placeOrderGradient, !canPlaceOrder && { opacity: 0.4 }]}
                  >
                    <Text style={styles.placeOrderText}>
                      {orderSide === 'buy' ? t('buy') : t('sell')} {stock.symbol}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* ── Company Description ── */}
              {stock.description ? (
                <View style={styles.descriptionCard}>
                  <Text style={styles.sectionTitle}>{t('about_company')} {stock.name}</Text>
                  <Text style={styles.descriptionText}>{stock.description}</Text>
                </View>
              ) : null}

              {/* ── News ── */}
              <View style={styles.newsSection}>
                <Text style={styles.sectionTitle}>{t('recent_news')}</Text>
                {isLoadingNews ? (
                  <ActivityIndicator
                    color={Colors.brand.primary}
                    style={{ marginTop: Spacing.base }}
                  />
                ) : news.length === 0 ? (
                  <Text style={styles.noDataText}>{t('no_recent_news')}</Text>
                ) : (
                  news.map(renderNewsItem)
                )}
              </View>

              {/* Spacer handled by scrollContent paddingBottom */}
            </ScrollView>
          </Animated.View>
        )}
      </KeyboardAvoidingView>

      {/* ── Order Confirmation Modal ── */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>{t('confirm_order')}</Text>

            {stock && (
              <>
                <View style={[
                  styles.modalOrderTypeBadge,
                  { backgroundColor: orderSide === 'buy' ? Colors.market.gainBg : Colors.market.lossBg },
                ]}>
                  <Text style={[
                    styles.modalOrderTypeText,
                    { color: orderSide === 'buy' ? Colors.market.gain : Colors.market.loss },
                  ]}>
                    {orderType === 'limit'
                      ? (orderSide === 'buy' ? '▲ LIMIT BUY' : '▼ LIMIT SELL')
                      : (orderSide === 'buy' ? '▲ MARKET BUY' : '▼ MARKET SELL')}
                  </Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>{t('symbol')}</Text>
                  <Text style={styles.modalValue}>{stock.symbol}</Text>
                </View>
                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>{t('order_type')}</Text>
                  <Text style={styles.modalValue}>{orderType === 'limit' ? 'Limit Order' : t('market_order')}</Text>
                </View>
                <View style={styles.modalDivider} />

                {orderType === 'limit' && parseFloat(limitPriceInput) > 0 ? (
                  <>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Limit Price</Text>
                      <Text style={styles.modalValue}>{formatCurrency(parseFloat(limitPriceInput))}</Text>
                    </View>
                    <View style={styles.modalDivider} />
                  </>
                ) : null}

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>{t('quantity')}</Text>
                  <Text style={styles.modalValue}>
                    {formatShares(confirmOrderShares)} shares
                  </Text>
                </View>
                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>{orderType === 'limit' ? 'Current Price' : t('est_price')}</Text>
                  <Text style={styles.modalValue}>{formatCurrency(stock.price)}</Text>
                </View>
                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>{t('est_total')}</Text>
                  <Text style={[styles.modalValue, styles.modalValueLarge]}>
                    {formatCurrency(confirmOrderCost)}
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowConfirmModal(false)}
                  >
                    <Text style={styles.modalCancelText}>{t('cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={handlePlaceOrder}
                    disabled={isPlacingOrder}
                  >
                    <LinearGradient
                      colors={
                        orderSide === 'buy'
                          ? ['#00C853', '#00A846']
                          : ['#FF3D57', '#D9002E']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.modalConfirmGradient}
                    >
                      {isPlacingOrder ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.modalConfirmText}>
                          {orderSide === 'buy' ? t('confirm_buy') : t('confirm_sell')}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── StatItem ────────────────────────────────────────────────────────────────

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#05200A',
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    zIndex: 100,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  clearIcon: {
    color: Colors.text.tertiary,
    fontSize: 14,
    paddingLeft: Spacing.sm,
  },
  searchDropdown: {
    position: 'absolute',
    top: '100%',
    left: Spacing.base,
    right: Spacing.base,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    maxHeight: 280,
    zIndex: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  searchList: {
    maxHeight: 280,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  searchResultLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  searchResultSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  searchResultName: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  searchResultType: {
    fontSize: FontSize.xs,
    color: Colors.brand.primary,
    backgroundColor: 'rgba(0,179,230,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
  },
  searchLoadingText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginLeft: Spacing.sm,
  },
  noResultsText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    padding: Spacing.base,
    textAlign: 'center',
  },

  // Loading & Empty
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
  },
  loadingText: {
    color: Colors.text.secondary,
    fontSize: FontSize.base,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: 160,
  },

  // Stock Header
  stockHeader: {
    marginBottom: Spacing.base,
  },
  stockTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stockTitleLeft: {
    flex: 1,
  },
  stockName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  stockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  stockSymbol: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.brand.primary,
  },
  stockExchange: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
  },
  marketStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  marketStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  currentPrice: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  changeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  changeText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },
  watchlistHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.brand.primary,
    backgroundColor: 'transparent',
  },
  watchlistHeaderBtnActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  watchlistHeaderBtnIcon: {
    fontSize: 18,
    color: Colors.brand.primary,
  },
  watchlistHeaderBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.brand.primary,
  },
  watchlistHeaderBtnTextActive: {
    color: '#fff',
  },

  // Chart
  chartContainer: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
  },
  chartPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    gap: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: 'transparent',
  },
  periodButtonActive: {
    backgroundColor: Colors.bg.input,
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

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: Spacing.base,
    overflow: 'hidden',
  },
  statItem: {
    width: '33.33%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    borderRightWidth: 1,
    borderRightColor: Colors.border.subtle,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },

  // Order Panel
  orderPanel: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.base,
  },
  sideToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: Spacing.md,
  },
  sideButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  sideButtonBuyActive: {
    backgroundColor: Colors.market.gainBg,
    borderWidth: 1,
    borderColor: Colors.market.gain,
  },
  sideButtonSellActive: {
    backgroundColor: Colors.market.lossBg,
    borderWidth: 1,
    borderColor: Colors.market.loss,
  },
  sideButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.tertiary,
  },
  sideButtonTextActive: {
    color: Colors.text.primary,
  },
  inputModeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  inputModeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: 'transparent',
  },
  inputModeButtonActive: {
    borderColor: Colors.brand.primary,
    backgroundColor: 'rgba(0,179,230,0.08)',
  },
  inputModeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.tertiary,
  },
  inputModeTextActive: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.semibold,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.focus,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  amountPrefix: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.secondary,
    marginRight: Spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    paddingVertical: 0,
  },
  estimateRow: {
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  estimateText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  balanceLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  balanceValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  placeOrderButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  placeOrderButtonDisabled: {
    opacity: 0.5,
  },
  placeOrderGradient: {
    paddingVertical: Spacing.base,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  placeOrderText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.4,
  },

  // Description
  descriptionCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  descriptionText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },

  // News
  newsSection: {
    marginBottom: Spacing.base,
  },
  newsCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  newsSource: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.brand.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  newsTime: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  newsHeadline: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 4,
  },
  newsSummary: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bg.tertiary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['3xl'],
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.border.default,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border.default,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  modalOrderTypeBadge: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: Spacing.base,
  },
  modalOrderTypeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  modalLabel: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
  },
  modalValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  modalValueLarge: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.input,
  },
  modalCancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  modalConfirmButton: {
    flex: 2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  modalConfirmGradient: {
    paddingVertical: Spacing.base,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  modalConfirmText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
});
