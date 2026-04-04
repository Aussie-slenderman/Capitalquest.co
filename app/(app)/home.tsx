import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { ALL_NEWS } from './notifications';
import Sidebar from '../../src/components/Sidebar';
import AppHeader from '../../src/components/AppHeader';
import { useAppStore } from '../../src/store/useAppStore';
import { formatCurrency, formatPercent, formatRelativeTime } from '../../src/utils/formatters';
import { searchStocks, getQuotes, getMarketMovers, type SearchResult } from '../../src/services/stockApi';
import { POPULAR_STOCKS } from '../../src/constants/stocks';
import type { StockQuote } from '../../src/types';
import {
  Colors,
  LightColors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  Shadow,
} from '../../src/constants/theme';

// ─── Market data — March 13 2026 verified closing prices ─────────────────────
// Source: stockanalysis.com, cnbc.com (March 13 2026 close, 4:00 PM EDT)

const MARKET_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500',   price: 6570.47, change: -4.85, changePercent: -0.07 },
  { symbol: '^IXIC', name: 'NASDAQ',    price: 21815.90, change: -25.05, changePercent: -0.11 },
  { symbol: '^DJI',  name: 'Dow Jones', price: 46453.99, change: -111.75, changePercent: -0.24 },
  { symbol: '^FTSE', name: 'FTSE 100',  price: 10436.29, change: 71.50, changePercent: 0.69 },
  { symbol: '^GDAXI',name: 'DAX',       price: 23168.08, change: -130.81, changePercent: -0.56 },
  { symbol: '^N225', name: 'Nikkei',    price: 52463.27, change: -1276.41, changePercent: -2.38 },
];

// Name lookup for market mover display
const STOCK_NAME_MAP: Record<string, string> = {};
POPULAR_STOCKS.forEach(s => { STOCK_NAME_MAP[s.symbol] = s.name; });

const MOCK_NEWS = [
  {
    id: '1',
    headline: 'Markets selloff deepens as tariff fears and recession concerns rattle investors',
    source: 'Reuters',
    publishedAt: Date.now() - 1_800_000,
    relatedSymbols: ['SPY', 'QQQ'],
  },
  {
    id: '2',
    headline: 'Tesla slides as EV demand concerns mount and margin pressure weighs on outlook',
    source: 'Bloomberg',
    publishedAt: Date.now() - 5_400_000,
    relatedSymbols: ['TSLA'],
  },
  {
    id: '3',
    headline: 'NVIDIA faces pressure as AI spending scrutiny grows among hyperscalers',
    source: 'WSJ',
    publishedAt: Date.now() - 9_000_000,
    relatedSymbols: ['NVDA', 'AMD'],
  },
  {
    id: '4',
    headline: 'Apple quietly launches new iPhone SE with advanced AI features at lower price point',
    source: 'CNBC',
    publishedAt: Date.now() - 14_400_000,
    relatedSymbols: ['AAPL'],
  },
  {
    id: '5',
    headline: 'Fed holds rates steady, signals patient approach as jobs data stays resilient',
    source: 'Financial Times',
    publishedAt: Date.now() - 21_600_000,
    relatedSymbols: ['SPY', 'GLD'],
  },
];

type MoverTab = 'gainers' | 'losers' | 'active';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeScreen() {
  const {
    user, portfolio, quotes, notifications, setSidebarOpen, setQuote, isSidebarOpen,
    newsLastRead, appColorMode, watchlist, addToWatchlist, removeFromWatchlist,
  } = useAppStore();
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moverTab, setMoverTab] = useState<MoverTab>('gainers');
  const [isManagingWatchlist, setIsManagingWatchlist] = useState(false);

  // Live market movers
  const [movers, setMovers] = useState<{
    gainers: StockQuote[];
    losers: StockQuote[];
    active: StockQuote[];
  } | null>(null);
  const [moversLoading, setMoversLoading] = useState(true);

  const unreadNotifications = useMemo(() => {
    const heldSymbols = portfolio?.holdings.map(h => h.symbol) ?? [];
    const hasUnreadHoldingsNews = heldSymbols.length > 0 &&
      ALL_NEWS.some(n =>
        n.relatedSymbols.some(s => heldSymbols.includes(s)) && n.publishedAt > newsLastRead
      );
    return notifications.filter(n => !n.read).length + (hasUnreadHoldingsNews ? 1 : 0);
  }, [notifications, portfolio, newsLastRead]);

  // ─── Fetch live market movers on mount ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMarketMovers();
        if (!cancelled) { setMovers(data); setMoversLoading(false); }
      } catch { setMoversLoading(false); }
    })();
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const data = await getMarketMovers();
        if (!cancelled) setMovers(data);
      } catch {}
    }, 300_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ─── Fetch quotes for watchlist + mover symbols ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    const moverSymbols = movers
      ? [...movers.gainers, ...movers.losers, ...movers.active].map(q => q.symbol)
      : [];
    const indexSymbols = MARKET_INDICES.map(idx => idx.symbol);
    const allSymbols = [...new Set([...watchlist, ...moverSymbols, ...indexSymbols])];
    if (allSymbols.length === 0) return;

    const fetchQuotes = async () => {
      try {
        const liveQuotes = await getQuotes(allSymbols);
        if (cancelled) return;
        Object.entries(liveQuotes).forEach(([sym, q]) => setQuote(sym, q));
      } catch {}
    };

    fetchQuotes();
    const interval = setInterval(fetchQuotes, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [watchlist, movers]);

  const currentMovers = movers ? movers[moverTab] : [];

  const watchlistData = useMemo(() => {
    return watchlist.map(symbol => {
      const quote = quotes[symbol];
      return {
        symbol,
        price: quote?.price ?? 0,
        change: quote?.change ?? 0,
        changePercent: quote?.changePercent ?? 0,
      };
    });
  }, [watchlist, quotes]);

  const handleStockPress = (symbol: string) => {
    setShowSearchDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push({ pathname: '/(app)/trade', params: { symbol } });
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setIsSearching(true);
    setShowSearchDropdown(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchStocks(text.trim());
      setSearchResults(results.slice(0, 8));
      setIsSearching(false);
    }, 350);
  }, []);

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: C.bg.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg.primary} />

      <AppHeader title="Markets" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Market Indices Row */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>Markets</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.indicesRow}
        >
          {MARKET_INDICES.map(index => {
            const liveQuote = quotes[index.symbol];
            const price = liveQuote?.price ?? index.price;
            const changePercent = liveQuote?.changePercent ?? index.changePercent;
            const up = changePercent >= 0;
            return (
              <TouchableOpacity
                key={index.symbol}
                style={[styles.indexCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}
                onPress={() => handleStockPress(index.symbol)}
              >
                <Text style={[styles.indexName, { color: C.text.tertiary }]}>{index.name}</Text>
                <Text style={[styles.indexPrice, { color: C.text.primary }]}>
                  {price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.indexChange, { color: up ? Colors.market.gain : Colors.market.loss }]}>
                  {up ? '▲' : '▼'} {formatPercent(Math.abs(changePercent), false)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={[styles.searchContainer, { backgroundColor: C.bg.input, borderColor: C.border.default }]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: C.text.primary }]}
              placeholder="Search stocks, ETFs — e.g. AAPL, Tesla..."
              placeholderTextColor={C.text.tertiary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCapitalize="characters"
              onSubmitEditing={() => {
                if (searchQuery.trim()) handleStockPress(searchQuery.trim().toUpperCase());
              }}
            />
            {isSearching
              ? <ActivityIndicator size="small" color={Colors.brand.primary} style={{ marginLeft: 8 }} />
              : searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                }}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )
            }
          </View>

          {/* Live search dropdown */}
          {showSearchDropdown && (
            <View style={[styles.searchDropdown, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
              {searchResults.length === 0 && !isSearching ? (
                <Text style={[styles.noResultsText, { color: C.text.tertiary }]}>No results — try a ticker like AAPL</Text>
              ) : (
                searchResults.map((item) => {
                  const isInWatchlist = watchlist.includes(item.symbol);
                  return (
                    <TouchableOpacity
                      key={item.symbol}
                      style={[styles.searchResultRow, { borderBottomColor: C.border.subtle }]}
                      onPress={() => handleStockPress(item.symbol)}
                    >
                      <View style={styles.searchResultLeft}>
                        <Text style={[styles.searchResultSymbol, { color: C.text.primary }]}>{item.displaySymbol || item.symbol}</Text>
                        <Text style={[styles.searchResultName, { color: C.text.tertiary }]} numberOfLines={1}>{item.name}</Text>
                      </View>
                      <View style={styles.searchResultRight}>
                        <Text style={styles.searchResultType}>{item.type}</Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            if (isInWatchlist) removeFromWatchlist(item.symbol);
                            else addToWatchlist(item.symbol);
                          }}
                          style={[styles.addWatchlistBtn, isInWatchlist && styles.addWatchlistBtnActive]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.addWatchlistBtnText}>{isInWatchlist ? '✓' : '+'}</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* Market Movers */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>Market Movers</Text>
        </View>
        <View style={[styles.card, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
          {/* Tab row */}
          <View style={[styles.moverTabs, { borderBottomColor: C.border.default }]}>
            {(['gainers', 'losers', 'active'] as MoverTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.moverTab, moverTab === tab && styles.moverTabActive]}
                onPress={() => setMoverTab(tab)}
              >
                <Text style={[styles.moverTabText, { color: C.text.tertiary }, moverTab === tab && styles.moverTabTextActive]}>
                  {tab === 'gainers' ? 'Top Gainers' : tab === 'losers' ? 'Top Losers' : 'Most Changed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Mover list */}
          {moversLoading ? (
            <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Colors.brand.primary} />
              <Text style={{ color: C.text.tertiary, fontSize: FontSize.sm, marginTop: 8 }}>Loading market data...</Text>
            </View>
          ) : currentMovers.length === 0 ? (
            <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
              <Text style={{ color: C.text.tertiary, fontSize: FontSize.sm }}>No data available</Text>
            </View>
          ) : (
            currentMovers.map((stock, i) => {
              const up = stock.changePercent >= 0;
              return (
                <TouchableOpacity
                  key={stock.symbol}
                  style={[styles.moverRow, i < currentMovers.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border.subtle }]}
                  onPress={() => handleStockPress(stock.symbol)}
                >
                  <View style={styles.moverLeft}>
                    <View style={[styles.moverRankBadge, { backgroundColor: C.bg.tertiary }]}>
                      <Text style={[styles.moverRank, { color: C.text.tertiary }]}>{i + 1}</Text>
                    </View>
                    <View>
                      <Text style={[styles.moverSymbol, { color: C.text.primary }]}>{stock.symbol}</Text>
                      <Text style={[styles.moverName, { color: C.text.tertiary }]} numberOfLines={1}>
                        {STOCK_NAME_MAP[stock.symbol] ?? stock.symbol}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.moverRight}>
                    <Text style={[styles.moverPrice, { color: C.text.primary }]}>{formatCurrency(stock.price)}</Text>
                    <View style={[styles.moverBadge, { backgroundColor: up ? Colors.market.gainBg : Colors.market.lossBg }]}>
                      <Text style={[styles.moverChange, { color: up ? Colors.market.gain : Colors.market.loss }]}>
                        {up ? '▲' : '▼'} {formatPercent(Math.abs(stock.changePercent), false)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Watchlist */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>Watchlist</Text>
          {watchlist.length > 0 && (
            <TouchableOpacity onPress={() => setIsManagingWatchlist(!isManagingWatchlist)}>
              <Text style={styles.sectionAction}>{isManagingWatchlist ? 'Done' : 'Manage'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {watchlistData.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={[styles.emptyText, { color: C.text.secondary }]}>No stocks in your watchlist.</Text>
            <Text style={[styles.emptySubtext, { color: C.text.tertiary }]}>Search for stocks to add them here.</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            {watchlistData.map((item, i) => {
              const up = item.changePercent >= 0;
              return (
                <TouchableOpacity
                  key={item.symbol}
                  style={[styles.watchlistRow, i < watchlistData.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border.subtle }]}
                  onPress={() => handleStockPress(item.symbol)}
                >
                  {isManagingWatchlist && (
                    <TouchableOpacity
                      onPress={() => removeFromWatchlist(item.symbol)}
                      style={styles.deleteBtn}
                    >
                      <Text style={styles.deleteBtnText}>🗑</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.watchlistSymbolContainer}>
                    <View style={[styles.watchlistAvatar, { backgroundColor: C.bg.input, borderColor: C.border.default }]}>
                      <Text style={styles.watchlistAvatarText}>{item.symbol.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={[styles.watchlistSymbol, { color: C.text.primary }]}>{item.symbol}</Text>
                      <Text style={[styles.watchlistSubtext, { color: C.text.tertiary }]}>
                        {STOCK_NAME_MAP[item.symbol] ?? 'Tap to trade'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.watchlistPriceContainer}>
                    <Text style={[styles.watchlistPrice, { color: C.text.primary }]}>
                      {item.price > 0 ? formatCurrency(item.price) : '—'}
                    </Text>
                    {item.price > 0 ? (
                      <Text style={[styles.watchlistChange, { color: up ? Colors.market.gain : Colors.market.loss }]}>
                        {up ? '+' : ''}{formatPercent(item.changePercent)}
                      </Text>
                    ) : (
                      <Text style={[styles.watchlistSubtext, { color: C.text.tertiary }]}>Loading…</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* News */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>Market News</Text>
          <TouchableOpacity>
            <Text style={styles.sectionAction}>See All</Text>
          </TouchableOpacity>
        </View>

        {MOCK_NEWS.map((article, i) => (
          <TouchableOpacity key={article.id} style={[styles.newsCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]} activeOpacity={0.8}>
            <View style={styles.newsContent}>
              <View style={styles.newsMeta}>
                <Text style={styles.newsSource}>{article.source}</Text>
                <Text style={[styles.newsDot, { color: C.text.tertiary }]}>·</Text>
                <Text style={[styles.newsTime, { color: C.text.tertiary }]}>{formatRelativeTime(article.publishedAt)}</Text>
              </View>
              <Text style={[styles.newsHeadline, { color: C.text.primary }]} numberOfLines={2}>
                {article.headline}
              </Text>
              {article.relatedSymbols.length > 0 && (
                <View style={styles.newsTags}>
                  {article.relatedSymbols.slice(0, 3).map(sym => (
                    <View key={sym} style={[styles.newsTag, { backgroundColor: C.bg.input, borderColor: C.border.default }]}>
                      <Text style={[styles.newsTagText, { color: C.text.secondary }]}>{sym}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.newsArrow}>
              <Text style={[styles.newsArrowText, { color: C.text.tertiary }]}>›</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
    <Sidebar visible={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#2A54CC',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    backgroundColor: Colors.bg.primary,
  },
  headerLeft: {
    flex: 1,
  },
  logoText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.brand.primary,
    letterSpacing: 0.5,
  },
  portfolioSummary: {
    marginTop: Spacing.xs,
  },
  portfolioValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  gainLossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  gainLossText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  gainLossPercent: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bellButton: {
    position: 'relative',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 22,
  },
  notifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.market.loss,
    borderRadius: 5,
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },
  notifBadgeText: {
    color: Colors.text.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  sidebarToggle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hamburgerLine: {
    width: 22,
    height: 2,
    backgroundColor: Colors.text.secondary,
    borderRadius: Radius.full,
  },
  hamburgerLineMid: {
    width: 16,
    alignSelf: 'flex-start',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.sm,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  sectionAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.brand.primary,
  },

  // Indices
  indicesRow: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  indexCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minWidth: 120,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  indexName: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: FontWeight.medium,
    marginBottom: 4,
  },
  indexPrice: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  indexChange: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },

  // Search
  searchWrapper: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    zIndex: 100,
  },
  searchContainer: {
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
    fontSize: 14,
    color: Colors.text.tertiary,
    paddingLeft: Spacing.sm,
  },
  searchDropdown: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchResultRow: {
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
  },
  searchResultRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchResultSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  searchResultName: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
    maxWidth: 180,
  },
  searchResultType: {
    fontSize: FontSize.xs,
    color: Colors.brand.primary,
    fontWeight: FontWeight.medium,
  },
  noResultsText: {
    padding: Spacing.base,
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  addWatchlistBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWatchlistBtnActive: {
    backgroundColor: Colors.brand.accent,
  },
  addWatchlistBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },

  // Card
  card: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
  },

  // Movers
  moverTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  moverTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  moverTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.brand.primary,
  },
  moverTabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.tertiary,
  },
  moverTabTextActive: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.semibold,
  },
  moverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  moverRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  moverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  moverRankBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moverRank: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.text.tertiary,
  },
  moverSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  moverName: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    maxWidth: 130,
  },
  moverVolume: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  moverRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  moverPrice: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  moverBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  moverChange: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // Watchlist
  watchlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  watchlistRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  watchlistSymbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  watchlistAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  watchlistAvatarText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.brand.primary,
  },
  watchlistSymbol: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  watchlistSubtext: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  watchlistPriceContainer: {
    alignItems: 'flex-end',
  },
  watchlistPrice: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  watchlistChange: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  deleteBtn: {
    paddingRight: 10,
    paddingVertical: 4,
  },
  deleteBtnText: {
    fontSize: 18,
  },

  // Empty state
  emptyCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
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

  // News
  newsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  newsContent: {
    flex: 1,
  },
  newsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: 4,
  },
  newsSource: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.brand.primary,
  },
  newsDot: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  newsTime: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  newsHeadline: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  newsTags: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  newsTag: {
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  newsTagText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  newsArrow: {
    paddingLeft: Spacing.sm,
  },
  newsArrowText: {
    fontSize: 22,
    color: Colors.text.tertiary,
    lineHeight: 24,
  },

  bottomPadding: {
    height: Spacing.xl,
  },
});
