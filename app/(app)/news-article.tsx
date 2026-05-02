import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../../src/store/useAppStore';
import { useT } from '../../src/constants/translations';
import { formatRelativeTime } from '../../src/utils/formatters';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

// CORS proxy used to bypass browser CORS when fetching article HTML.
const CQ_PROXY = 'https://cq-yahoo-proxy.capitalquest.workers.dev';

// Strip HTML to readable text. Order matters:
//   1) drop <script> / <style> / <noscript> blocks entirely
//   2) collapse common block tags into paragraph breaks
//   3) drop remaining tags
//   4) decode common entities
//   5) collapse whitespace
function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|br)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>(\n)?/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&rsquo;/g, '\u2019')
       .replace(/&lsquo;/g, '\u2018')
       .replace(/&rdquo;/g, '\u201d')
       .replace(/&ldquo;/g, '\u201c')
       .replace(/&mdash;/g, '\u2014')
       .replace(/&ndash;/g, '\u2013')
       .replace(/&hellip;/g, '\u2026')
       .replace(/&#(\d+);/g, (_m: string, d: string) => String.fromCharCode(parseInt(d, 10)));
  s = s.replace(/\r\n?/g, '\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s.trim();
}

// Pick the best body text from a fetched article HTML page.
function extractArticleBody(html: string): string {
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) {
    const text = htmlToText(articleMatch[0]);
    if (text.length > 200) return text;
  }
  const paragraphs: string[] = [];
  const pRe = /<p[\s>][\s\S]*?<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(html)) !== null) {
    const txt = htmlToText(m[0]);
    if (txt.length >= 40) paragraphs.push(txt);
  }
  if (paragraphs.length >= 3) return paragraphs.join('\n\n');
  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const og = ogMatch ? htmlToText(ogMatch[1]) : '';
  const desc = descMatch ? htmlToText(descMatch[1]) : '';
  const combined = [og, desc].filter(Boolean).join('\n\n');
  return combined || paragraphs.join('\n\n');
}

// Last-resort fallback for items with no link (legacy fallback news item).
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
    link?: string;
  }>();

  const headline = params.headline ?? 'Article';
  const source = params.source ?? '';
  const publishedAt = params.publishedAt ? Number(params.publishedAt) : Date.now();
  const symbols = params.symbols ? params.symbols.split(',') : [];
  const category = params.category ?? '';
  const link = params.link ?? '';

  // Live-fetch the real article body when we have a link. Falls back to
  // the bundled mock if the fetch fails or returns nothing useful — and
  // to a final generic message for legacy items with no link at all.
  const [body, setBody] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(!!link);
  const [fetchedFromLink, setFetchedFromLink] = useState(false);

  useEffect(() => {
    if (!link) {
      setBody(getArticleBody(headline));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const proxied = `${CQ_PROXY}?url=${encodeURIComponent(link)}`;
        const resp = await fetch(proxied, { method: 'GET' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const html = await resp.text();
        const extracted = extractArticleBody(html);
        if (cancelled) return;
        if (extracted && extracted.length > 80) {
          setBody(extracted);
          setFetchedFromLink(true);
        } else {
          setBody(getArticleBody(headline));
        }
      } catch {
        if (!cancelled) setBody(getArticleBody(headline));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [link, headline]);

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
        {loading ? (
          <View style={{ paddingVertical: Spacing['2xl'], alignItems: 'center' }}>
            <ActivityIndicator color={Colors.brand.primary} />
            <Text style={{ color: C.text.tertiary, marginTop: 12, fontSize: FontSize.sm }}>
              Loading article...
            </Text>
          </View>
        ) : (
          body.split('\n\n').map((paragraph, i) => (
            <Text key={i} style={[styles.paragraph, { color: C.text.secondary }]}>
              {paragraph}
            </Text>
          ))
        )}

        {!loading && (
          <View style={[styles.disclaimer, { borderColor: C.border.default }]}>
            <Text style={[styles.disclaimerText, { color: C.text.tertiary }]}>
              {fetchedFromLink
                ? `Article text from ${source || 'the original publisher'}. Rookie Markets uses virtual money only — no real financial advice is provided.`
                : 'This article is a placeholder for the Rookie Markets virtual trading game. No real financial advice is provided.'}
            </Text>
          </View>
        )}
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
