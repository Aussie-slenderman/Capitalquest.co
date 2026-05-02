import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore';
import { formatRelativeTime } from '../../src/utils/formatters';
import { fetchYahooNews, type YahooNewsItem } from '../../src/services/stockApi';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

// ─── Fallback news (used only if Yahoo Finance fetch fails) ──────────────────

const FALLBACK_NEWS: YahooNewsItem[] = [
  { id: 'f1', headline: 'Markets update — check back shortly for the latest stories', source: 'Rookie Markets', publishedAt: Date.now(), relatedSymbols: [] },
];

// Keep the export so dashboard.tsx doesn't break if it imports ALL_NEWS
export const ALL_NEWS = FALLBACK_NEWS;

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article, isHoldings }: { article: YahooNewsItem; isHoldings?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.card, isHoldings && styles.cardHighlighted]}
      activeOpacity={0.8}
      onPress={() => router.push({
        pathname: '/(app)/news-article',
        params: {
          headline: article.headline,
          source: article.source,
          publishedAt: String(article.publishedAt),
          symbols: article.relatedSymbols.join(','),
          link: article.link ?? '',
        },
      })}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardSource}>{article.source}</Text>
          <Text style={styles.cardDot}>·</Text>
          <Text style={styles.cardTime}>{formatRelativeTime(article.publishedAt)}</Text>
          {isHoldings && (
            <View style={styles.holdingsBadge}>
              <Text style={styles.holdingsBadgeText}>Your stock</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardHeadline} numberOfLines={3}>{article.headline}</Text>
        {article.relatedSymbols.length > 0 && (
          <View style={styles.tags}>
            {article.relatedSymbols.slice(0, 4).map(sym => (
              <View key={sym} style={styles.tag}>
                <Text style={styles.tagText}>{sym}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { portfolio, setNewsLastRead } = useAppStore();
  const [news, setNews] = useState<YahooNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNews = useCallback(async () => {
    try {
      const items = await fetchYahooNews();
      if (items.length > 0) setNews(items);
      else setNews(FALLBACK_NEWS);
    } catch {
      setNews(FALLBACK_NEWS);
    }
    setLoading(false);
  }, []);

  // Fetch news on mount, refresh every 5 minutes
  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 5 * 60_000);
    return () => clearInterval(interval);
  }, [loadNews]);

  // Mark news as read when screen is opened
  useEffect(() => {
    setNewsLastRead(Date.now());
  }, []);

  const heldSymbols = useMemo(
    () => portfolio?.holdings.map(h => h.symbol) ?? [],
    [portfolio],
  );

  const holdingsNews = useMemo(
    () => news.filter(n => n.relatedSymbols.some(s => heldSymbols.includes(s))),
    [heldSymbols, news],
  );

  const marketNews = useMemo(
    () => news.filter(n => !n.relatedSymbols.some(s => heldSymbols.includes(s))),
    [heldSymbols, news],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(app)/dashboard')}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>News & Alerts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {loading && (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.brand.primary} size="large" />
            <Text style={{ color: Colors.text.secondary, marginTop: 12 }}>Loading latest news...</Text>
          </View>
        )}

        {/* Holdings News */}
        {!loading && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>📈</Text>
          <Text style={styles.sectionTitle}>Your Holdings</Text>
        </View>
        )}

        {holdingsNews.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No news for your holdings yet</Text>
            <Text style={styles.emptySubtext}>Buy stocks to see relevant news here</Text>
          </View>
        ) : (
          holdingsNews.map(article => (
            <ArticleCard key={article.id} article={article} isHoldings />
          ))
        )}

        {/* Market News */}
        {!loading && (
        <>
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <Text style={styles.sectionIcon}>🌐</Text>
          <Text style={styles.sectionTitle}>Market News</Text>
        </View>

        {marketNews.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
        </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    color: Colors.brand.primary,
    lineHeight: 32,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardHighlighted: {
    borderColor: Colors.brand.primary + '60',
    backgroundColor: Colors.brand.primary + '0A',
  },
  cardContent: { flex: 1 },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: 4,
    flexWrap: 'wrap',
  },
  cardSource: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.brand.primary,
  },
  cardDot: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  cardTime: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  holdingsBadge: {
    backgroundColor: Colors.market.gain + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.market.gain + '55',
  },
  holdingsBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.market.gain,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardHeadline: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  tagText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  arrow: {
    fontSize: 22,
    color: Colors.text.tertiary,
    marginLeft: Spacing.sm,
  },

  emptyCard: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 32, marginBottom: Spacing.sm },
  emptyText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
});
