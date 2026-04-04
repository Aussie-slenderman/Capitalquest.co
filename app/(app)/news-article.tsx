import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../../src/store/useAppStore';
import { useT } from '../../src/constants/translations';
import { formatRelativeTime } from '../../src/utils/formatters';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

// Mock article bodies keyed by headline (first 40 chars)
const ARTICLE_BODIES: Record<string, string> = {
  'Markets selloff': `Global markets continued their sharp decline on Friday as mounting trade tensions and fresh tariff threats rattled investors worldwide. The S&P 500 fell over 1.5%, with the tech-heavy NASDAQ dropping nearly 2%.

Analysts point to growing fears of a potential recession as the primary driver behind the selloff. "We're seeing a classic risk-off move," said one senior strategist. "Investors are rotating out of equities and into safe-haven assets like gold and government bonds."

The selloff was broad-based, with all 11 S&P 500 sectors finishing in the red. Financials and industrials were hit particularly hard, falling more than 2% each.

Trading volume surged to well above average levels, suggesting institutional investors are actively repositioning their portfolios. The VIX volatility index, often called the "fear gauge," jumped over 15%.

Market participants are now closely watching upcoming economic data releases and central bank communications for signs of policy response.`,

  'Tesla slides': `Tesla shares dropped sharply as concerns about electric vehicle demand continued to weigh on the automaker's stock. The company has faced increasing competition from both traditional automakers and Chinese EV companies.

Margin pressure has been a recurring theme for Tesla, with the company cutting prices multiple times over the past year to maintain market share. Analysts estimate that these price cuts have reduced gross margins by several percentage points.

"Tesla is caught between maintaining volume growth and protecting profitability," noted one automotive analyst. "The EV market is becoming increasingly competitive, and Tesla can no longer rely on being the only game in town."

Despite the challenges, Tesla continues to lead in EV market share in the US and maintains significant advantages in battery technology and manufacturing efficiency. The company's energy storage business has also been growing rapidly.

Investors are watching closely for the next earnings report, which is expected to provide more clarity on demand trends and margin trajectory.`,

  'NVIDIA faces': `NVIDIA shares came under pressure as major cloud computing companies signaled they may slow the pace of AI infrastructure spending. The chipmaker, whose GPUs power most AI training and inference workloads, has been one of the biggest beneficiaries of the AI boom.

Several hyperscale cloud providers have recently indicated that their capital expenditure growth may moderate in coming quarters, leading investors to question whether NVIDIA's extraordinary revenue growth can be sustained.

"The question isn't whether AI spending will continue — it's whether the rate of growth can keep up with NVIDIA's elevated valuation," said one semiconductor analyst.

NVIDIA's data center revenue has grown more than 200% year-over-year, driven by insatiable demand for its H100 and newer Blackwell GPUs. However, some analysts worry that a period of digestion may be ahead as companies work to deploy the capacity they've already purchased.

Despite the near-term concerns, most analysts remain bullish on NVIDIA's long-term prospects, citing the company's dominant position in AI computing and its expanding software ecosystem.`,

  'Apple quietly': `Apple has unveiled the latest iPhone SE, featuring advanced AI capabilities powered by the company's proprietary neural engine. The new device marks Apple's most aggressive push into making AI features accessible at a lower price point.

The new iPhone SE includes Apple Intelligence features that were previously available only on the flagship iPhone Pro models. These include advanced photo editing, smart summarisation, and on-device language processing.

"Apple is democratising AI by bringing these features to a more affordable device," said one technology analyst. "This could significantly expand the addressable market for AI-powered smartphones."

The device retains a compact form factor while incorporating the latest A-series chip, which provides the processing power needed for on-device AI tasks. Apple emphasised that all AI processing happens locally on the device, maintaining the company's focus on user privacy.

Industry observers note that the move puts pressure on Android competitors to offer similar AI capabilities at comparable price points.`,

  'Fed holds rates': `The Federal Reserve held interest rates steady at its latest meeting, maintaining the current target range as officials assess the impact of recent economic data on the inflation outlook.

In the post-meeting statement, Fed officials signalled a patient approach to future rate decisions, noting that while inflation has made progress toward the 2% target, the labour market remains resilient with unemployment near historic lows.

"The Committee will continue to monitor the implications of incoming information for the economic outlook," the statement read. Fed Chair Powell emphasised that the central bank is not on a pre-set course and will make decisions meeting by meeting.

Markets had largely expected the pause, with futures pricing in a high probability of unchanged rates. However, traders continue to debate the timing and pace of potential rate cuts later in the year.

Economic data has painted a mixed picture, with strong employment numbers offset by some softening in manufacturing and consumer sentiment indicators.`,
};

function getArticleBody(headline: string): string {
  for (const [key, body] of Object.entries(ARTICLE_BODIES)) {
    if (headline.startsWith(key)) return body;
  }
  return `${headline}\n\nThis is a simulated news article for the StockQuest virtual trading game. The content is for educational purposes only and does not represent real financial advice.\n\nStay informed about market trends and use this knowledge to make better virtual trading decisions in the simulation.`;
}

export default function NewsArticleScreen() {
  const { appColorMode } = useAppStore();
  const t = useT();
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;
  const params = useLocalSearchParams<{
    headline?: string;
    source?: string;
    publishedAt?: string;
    symbols?: string;
    category?: string;
  }>();

  const headline = params.headline ?? 'Article';
  const source = params.source ?? '';
  const publishedAt = params.publishedAt ? Number(params.publishedAt) : Date.now();
  const symbols = params.symbols ? params.symbols.split(',') : [];
  const category = params.category ?? '';
  const body = getArticleBody(headline);

  return (
    <View style={[styles.container, { backgroundColor: C.bg.primary }]}>
      <LinearGradient
        colors={[`${Colors.brand.primary}30`, 'transparent']}
        style={styles.headerGradient}
      >
        {/* Back button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: Colors.brand.primary }]}>← {t('back')}</Text>
        </TouchableOpacity>

        {/* Category badge */}
        {category ? (
          <View style={[styles.categoryBadge, { backgroundColor: C.bg.tertiary }]}>
            <Text style={[styles.categoryText, { color: Colors.brand.primary }]}>{category}</Text>
          </View>
        ) : null}

        {/* Headline */}
        <Text style={[styles.headline, { color: C.text.primary }]}>{headline}</Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <Text style={[styles.source, { color: Colors.brand.primary }]}>{source}</Text>
          {source ? <Text style={[styles.dot, { color: C.text.tertiary }]}>·</Text> : null}
          <Text style={[styles.time, { color: C.text.tertiary }]}>{formatRelativeTime(publishedAt)}</Text>
        </View>

        {/* Symbol tags */}
        {symbols.length > 0 && (
          <View style={styles.symbolRow}>
            {symbols.map(sym => (
              <TouchableOpacity
                key={sym}
                style={[styles.symbolTag, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}
                onPress={() => router.push({ pathname: '/(app)/trade', params: { symbol: sym } })}
              >
                <Text style={[styles.symbolText, { color: C.text.primary }]}>{sym}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </LinearGradient>

      {/* Article body */}
      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
        {body.split('\n\n').map((paragraph, i) => (
          <Text key={i} style={[styles.paragraph, { color: C.text.secondary }]}>
            {paragraph}
          </Text>
        ))}

        <View style={[styles.disclaimer, { borderColor: C.border.default }]}>
          <Text style={[styles.disclaimerText, { color: C.text.tertiary }]}>
            This article is simulated for the StockQuest virtual trading game. No real financial advice is provided.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: { paddingHorizontal: Spacing.xl, paddingTop: 60, paddingBottom: Spacing.lg },
  backButton: { marginBottom: Spacing.lg },
  backText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  categoryBadge: {
    alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.sm, marginBottom: Spacing.sm,
  },
  categoryText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  headline: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold,
    lineHeight: 34, marginBottom: Spacing.md,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  source: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  dot: { fontSize: FontSize.sm },
  time: { fontSize: FontSize.sm },
  symbolRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  symbolTag: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.sm, borderWidth: 1,
  },
  symbolText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  bodyScroll: { flex: 1 },
  bodyContent: { paddingHorizontal: Spacing.xl, paddingBottom: 60 },
  paragraph: {
    fontSize: FontSize.base, lineHeight: 24,
    marginBottom: Spacing.base,
  },
  disclaimer: {
    marginTop: Spacing.xl, paddingTop: Spacing.base,
    borderTopWidth: 1,
  },
  disclaimerText: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center' },
});
