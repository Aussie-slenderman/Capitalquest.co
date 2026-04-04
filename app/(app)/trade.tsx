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
import { useLocalSearchParams } from 'expo-router';

import { useAppStore } from '../../src/store/useAppStore';
import {
  formatCurrency,
  formatPercent,
  formatShares,
  formatVolume,
  formatRelativeTime,
} from '../../src/utils/formatters';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { placeOrder } from '../../src/services/tradingEngine';
import {
  getStockProfile,
  getChartData,
  searchStocks,
  getCompanyNews,
  type SearchResult,
} from '../../src/services/stockApi';
import type { Stock, ChartDataPoint, ChartPeriod, NewsArticle } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - Spacing.base * 2;
const CHART_PERIODS: ChartPeriod[] = ['1D', '1W', '1M', '1Y', '5Y'];

// ─── Seeded placeholder chart data ─────────────────────────────────────────

function generateSeededChartData(
  basePrice: number,
  points: number,
  seed: number
): ChartDataPoint[] {
  let price = basePrice;
  const now = Date.now();
  const intervalMs = (86400 * 1000) / points;
  const rng = (i: number) => {
    const x = Math.sin(seed + i * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };
  // Box-Muller for more natural price movements
  const normalRng = (i: number) => {
    const u1 = rng(i * 2) || 0.001;
    const u2 = rng(i * 2 + 1);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const vol = 0.015; // ~1.5% per step for realistic intraday movement
  return Array.from({ length: points }, (_, i) => {
    const shock = normalRng(i) * vol;
    const drift = 0.0001; // slight upward bias
    price = price * Math.exp(drift + shock);
    price = Math.max(price * 0.3, price); // floor
    const intraVol = price * vol * 0.4;
    const open = price + (rng(i + 100) - 0.5) * intraVol;
    const high = Math.max(open, price) + rng(i + 200) * intraVol * 0.5;
    const low = Math.min(open, price) - rng(i + 300) * intraVol * 0.5;
    return {
      timestamp: now - (points - i) * intervalMs,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      volume: Math.floor(rng(i + 400) * 10_000_000),
    };
  });
}

function chartPointsForPeriod(period: ChartPeriod, basePrice: number): ChartDataPoint[] {
  const countMap: Record<ChartPeriod, number> = {
    '1D': 78, '1W': 130, '1M': 150, '3M': 180, '6M': 200, '1Y': 252, '5Y': 260,
  };
  const seed = basePrice * 1000;
  return generateSeededChartData(basePrice, countMap[period], seed);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TradeScreen() {
  const { user, portfolio, setQuote, appColorMode, appTabColors, watchlist, addToWatchlist, removeFromWatchlist } = useAppStore();
  const tabColor = appTabColors['trade'] ?? '#00C853';
  const isLight = appColorMode === 'light';
  const screenBg = isLight ? '#EDFFF5' : '#05200A';
  const params = useLocalSearchParams<{ symbol?: string }>();

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

  const canPlaceOrder = parsedInput > 0 && !!stock && !!user && !!portfolio;

  const handleOrderButtonPress = useCallback(() => {
    if (!stock) return;
    if (!user || !portfolio) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please log in to trade.' });
      return;
    }
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
    if (orderSide === 'buy' && parsedInput > availableCash && inputMode === 'dollars') {
      Toast.show({ type: 'error', text1: 'Insufficient funds', text2: `You only have ${formatCurrency(availableCash)} available.` });
      return;
    }
    if (orderSide === 'sell' && estimatedShares > sharesOwned) {
      Toast.show({ type: 'error', text1: 'Not enough shares', text2: `You only own ${formatShares(sharesOwned)} ${stock.symbol}.` });
      return;
    }
    setShowConfirmModal(true);
  }, [stock, user, portfolio, inputValue, parsedInput, inputMode, orderSide, availableCash, estimatedShares, sharesOwned]);

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

  const handleSelectStock = useCallback(async (symbol: string) => {
    setShowSearchResults(false);
    setSearchQuery(symbol);
    setInputValue('');
    setIsLoadingStock(true);
    setIsLoadingNews(true);
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
    try {
      const articles = await getCompanyNews(symbol);
      setNews(articles);
    } finally {
      setIsLoadingNews(false);
    }
  }, [fadeAnim, setQuote]);

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
    if (!canPlaceOrder || !user || !stock) return;
    setShowConfirmModal(false);
    setIsPlacingOrder(true);
    try {
      const result = await placeOrder({
        userId: user.id,
        symbol: stock.symbol,
        type: orderSide,
        ...(inputMode === 'dollars'
          ? { dollarAmount: parsedInput }
          : { shares: parsedInput }),
        userName: user.displayName,
        country: user.country,
      });
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: `Order Filled`,
          text2: `${orderSide === 'buy' ? 'Bought' : 'Sold'} ${formatShares(result.filledShares ?? 0)} ${stock.symbol} @ ${formatCurrency(result.filledPrice ?? 0)}`,
        });
        setInputValue('');
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
  }, [canPlaceOrder, user, stock, orderSide, inputMode, parsedInput]);

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

  const renderNewsItem = (article: NewsArticle) => (
    <View key={article.id} style={styles.newsCard}>
      <View style={styles.newsHeader}>
        <Text style={styles.newsSource}>{article.source}</Text>
        <Text style={styles.newsTime}>{formatRelativeTime(article.publishedAt)}</Text>
      </View>
      <Text style={styles.newsHeadline} numberOfLines={3}>{article.headline}</Text>
      {article.summary ? (
        <Text style={styles.newsSummary} numberOfLines={2}>{article.summary}</Text>
      ) : null}
    </View>
  );

  // ─── Confirmation modal content ────────────────────────────────────────────

  const confirmOrderShares = inputMode === 'dollars' ? estimatedShares : parsedInput;
  const confirmOrderCost = inputMode === 'dollars' ? parsedInput : estimatedCost;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      {/* Full-screen colour wash — top */}
      <LinearGradient
        colors={[`${tabColor}80`, `${tabColor}50`, `${tabColor}30`, screenBg] as any}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', `${tabColor}30`, `${tabColor}40`] as any}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`${tabColor}28`, 'transparent', `${tabColor}28`] as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
      />
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
              placeholder="Search stocks, ETFs…"
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
                <Text style={styles.noResultsText}>No results found</Text>
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
            <Text style={styles.emptyTitle}>Find a Stock</Text>
            <Text style={styles.emptySubtitle}>
              Search for any stock, ETF, or index to view details and place orders
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
                          {stock.isOpen ? 'Open' : 'Closed'}
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
                      {watchlist.includes(stock.symbol) ? 'Watching' : 'Watch'}
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
                <StatItem label="Volume" value={formatVolume(stock.volume)} />
                <StatItem label="52W High" value={stock.high52w ? formatCurrency(stock.high52w) : '—'} />
                <StatItem label="52W Low" value={stock.low52w ? formatCurrency(stock.low52w) : '—'} />
                {stock.dividend != null && (
                  <StatItem label="Dividend" value={formatPercent(stock.dividend)} />
                )}
              </View>

              {/* ── Order Panel ── */}
              <View style={styles.orderPanel}>
                <Text style={styles.sectionTitle}>Place Order</Text>

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
                    ]}>Buy</Text>
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
                    ]}>Sell</Text>
                  </TouchableOpacity>
                </View>

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
                    ]}>$ Dollars</Text>
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
                    ]}># Shares</Text>
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
                      <Text style={styles.balanceLabel}>Available cash</Text>
                      <Text style={styles.balanceValue}>{formatCurrency(availableCash)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.balanceLabel}>Shares owned</Text>
                      <Text style={styles.balanceValue}>{formatShares(sharesOwned)} {stock.symbol}</Text>
                    </>
                  )}
                </View>

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
                      {orderSide === 'buy' ? 'Buy' : 'Sell'} {stock.symbol}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* ── Company Description ── */}
              {stock.description ? (
                <View style={styles.descriptionCard}>
                  <Text style={styles.sectionTitle}>About {stock.name}</Text>
                  <Text style={styles.descriptionText}>{stock.description}</Text>
                </View>
              ) : null}

              {/* ── News ── */}
              <View style={styles.newsSection}>
                <Text style={styles.sectionTitle}>Recent News</Text>
                {isLoadingNews ? (
                  <ActivityIndicator
                    color={Colors.brand.primary}
                    style={{ marginTop: Spacing.base }}
                  />
                ) : news.length === 0 ? (
                  <Text style={styles.noDataText}>No recent news</Text>
                ) : (
                  news.map(renderNewsItem)
                )}
              </View>

              {/* Bottom padding for order panel */}
              <View style={{ height: Spacing['3xl'] }} />
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

            <Text style={styles.modalTitle}>Confirm Order</Text>

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
                    {orderSide === 'buy' ? '▲ MARKET BUY' : '▼ MARKET SELL'}
                  </Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Symbol</Text>
                  <Text style={styles.modalValue}>{stock.symbol}</Text>
                </View>
                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Order Type</Text>
                  <Text style={styles.modalValue}>Market Order</Text>
                </View>
                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Quantity</Text>
                  <Text style={styles.modalValue}>
                    {formatShares(confirmOrderShares)} shares
                  </Text>
                </View>
                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Est. Price</Text>
                  <Text style={styles.modalValue}>{formatCurrency(stock.price)}</Text>
                </View>
                <View style={styles.modalDivider} />

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Est. Total</Text>
                  <Text style={[styles.modalValue, styles.modalValueLarge]}>
                    {formatCurrency(confirmOrderCost)}
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowConfirmModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
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
                          Confirm {orderSide === 'buy' ? 'Buy' : 'Sell'}
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
    paddingVertical: Spacing.sm,
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  amountPrefix: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    color: Colors.text.secondary,
    marginRight: Spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: FontSize['2xl'],
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
