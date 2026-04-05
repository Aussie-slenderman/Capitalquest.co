import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Spacing, Radius, Shadow } from '../../src/constants/theme';
import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import { useT } from '../../src/constants/translations';

// ─── Tutorial Data ─────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'what_is',
    icon: '📈',
    title: 'What Is Stock Trading?',
    color: Colors.brand.primary,
    lessons: [
      {
        title: 'Stocks Explained',
        icon: '🏢',
        content:
          'A stock (also called a share or equity) is a small piece of ownership in a company. When you buy a share of Apple, you literally own a tiny fraction of that business.\n\nCompanies sell shares to raise money to grow — hire staff, build factories, develop products. In return, shareholders can profit if the company succeeds.',
      },
      {
        title: 'How Stock Trading Works',
        icon: '🔄',
        content:
          'Trading is the act of buying and selling stocks through an exchange (like the NYSE or NASDAQ). Prices move every second based on supply and demand — if more people want to buy than sell, the price rises, and vice versa.\n\nYou make money two ways:\n• Capital gains — selling a stock for more than you paid\n• Dividends — regular cash payments some companies distribute to shareholders',
      },
      {
        title: 'Stock Exchanges',
        icon: '🏦',
        content: `Major stock exchanges act as marketplaces:\n\n• NYSE (New York Stock Exchange) — oldest US exchange, home to large companies like JPMorgan and Walmart\n• NASDAQ — technology-heavy exchange; home to Apple, Google, NVIDIA\n• LSE (London Stock Exchange) — UK's primary exchange\n• Nikkei — Japan's benchmark index\n\nUS markets are open Monday–Friday, 9:30 AM – 4:00 PM Eastern Time.`,
      },
    ],
  },
  {
    id: 'reading_market',
    icon: '🔍',
    title: 'Reading the Market',
    color: Colors.brand.accent,
    lessons: [
      {
        title: 'Stock Price & Change',
        icon: '💵',
        content:
          'Every stock shows:\n\n• Current Price — what one share costs right now\n• Change ($) — how many dollars the price moved today\n• Change (%) — the percentage move from yesterday\'s close\n\nGreen = up ▲   Red = down ▼\n\nExample: AAPL $250.12  +3.45 (+1.40%) means Apple is up $3.45 today.',
      },
      {
        title: 'Market Indices',
        icon: '📊',
        content:
          'An index tracks a group of stocks to show how the overall market is doing:\n\n• S&P 500 — 500 largest US companies. The most-watched benchmark.\n• NASDAQ Composite — ~3,000 mostly tech companies\n• Dow Jones (DJIA) — 30 iconic US blue-chip companies\n• FTSE 100 — 100 largest UK companies\n\nWhen people say "the market is up today," they usually mean the S&P 500 rose.',
      },
      {
        title: 'Bull vs Bear Markets',
        icon: '🐂',
        content:
          'Bull Market 🐂 — Prices are rising broadly. Investor confidence is high. Typically defined as a 20%+ rise from a recent low.\n\nBear Market 🐻 — Prices are falling broadly. Typically a 20%+ drop from a recent high. These can last months or years.\n\nCorrection — A 10–20% drop within a bull market. Short-lived and normal.\n\nRally — A strong price recovery after a drop.',
      },
      {
        title: 'Volume & Liquidity',
        icon: '🌊',
        content:
          'Volume is how many shares are traded in a day. High volume means lots of interest — easier to buy and sell at your desired price (high liquidity).\n\nLow volume means fewer traders — spreads can be wider and prices can be more erratic.\n\nSpike in volume on a big price move often confirms the move is significant.',
      },
    ],
  },
  {
    id: 'key_terms',
    icon: '📖',
    title: 'Key Terms & Metrics',
    color: Colors.brand.gold,
    lessons: [
      {
        title: 'Market Cap',
        icon: '💎',
        content:
          'Market Capitalisation = Share Price × Total Shares Outstanding\n\nIt\'s the total market value of a company.\n\n• Mega-cap: $200B+ (Apple, NVIDIA, Microsoft)\n• Large-cap: $10B–$200B (stable, established companies)\n• Mid-cap: $2B–$10B (growing companies)\n• Small-cap: $300M–$2B (higher risk, higher potential reward)\n• Micro-cap: Under $300M (very speculative)',
      },
      {
        title: 'P/E Ratio',
        icon: '⚖️',
        content:
          'Price-to-Earnings Ratio = Share Price ÷ Earnings Per Share (EPS)\n\nIt answers: "How much are investors paying for each $1 of company profit?"\n\n• Low P/E (~10–15): May be cheap or a slow-growth company\n• High P/E (~30–50+): Market expects strong future growth\n• Negative P/E: Company is currently unprofitable\n\nAlways compare P/E to other companies in the same sector.',
      },
      {
        title: 'EPS — Earnings Per Share',
        icon: '💰',
        content:
          'EPS = Net Profit ÷ Total Shares Outstanding\n\nThe profit a company makes per share. Higher is better.\n\nEarnings season happens 4x per year. Companies report actual EPS versus analyst estimates:\n• Beat ✅ — EPS above estimate → usually stock rises\n• Miss ❌ — EPS below estimate → usually stock falls\n• In-line — as expected → muted reaction',
      },
      {
        title: '52-Week High / Low',
        icon: '📏',
        content:
          'The highest and lowest prices a stock traded at over the past 52 weeks.\n\nTraders use these as key support/resistance levels:\n• Near 52w High: Stock has strong momentum — but may be overextended\n• Near 52w Low: Stock has sold off heavily — may be a buying opportunity OR a warning sign\n\nBreaking above a 52w High on high volume is a bullish signal.',
      },
      {
        title: 'Dividends & Yield',
        icon: '🎁',
        content:
          'A dividend is cash paid to shareholders, usually quarterly, from company profits.\n\nDividend Yield = Annual Dividend ÷ Share Price × 100\n\nExample: A $100 stock paying $4/year = 4% yield.\n\nHigh-yield sectors: utilities, banks, energy, consumer staples. Growth tech companies (NVDA, TSLA) rarely pay dividends — they reinvest profits instead.',
      },
    ],
  },
  {
    id: 'judging_stocks',
    icon: '🎯',
    title: 'How to Judge Stocks',
    color: '#8B5CF6',
    lessons: [
      {
        title: 'Fundamental Analysis',
        icon: '🔬',
        content:
          'Fundamental analysis studies the underlying business to determine if a stock is fairly valued.\n\nKey questions:\n• Is revenue growing year over year?\n• Are profit margins expanding or shrinking?\n• Does the company have more cash than debt?\n• Is management trustworthy and competent?\n• Does the company have a competitive moat (unique advantage)?\n\nTools: income statements, balance sheets, cash flow statements.',
      },
      {
        title: 'Technical Analysis',
        icon: '📉',
        content:
          'Technical analysis studies price charts and patterns to predict future movements.\n\nCommon tools:\n• Moving Averages (50-day, 200-day) — smooth out noise, show trends\n• RSI (Relative Strength Index) — above 70 = overbought, below 30 = oversold\n• Support & Resistance — price levels where stock repeatedly bounces or stalls\n• Volume — confirms whether a price move is meaningful\n\nMany traders use both fundamental and technical analysis together.',
      },
      {
        title: 'Growth vs Value Stocks',
        icon: '🌱',
        content:
          'Growth stocks — companies growing revenue/earnings rapidly. Often high P/E, no dividends. High reward, high risk.\nExamples: NVIDIA, Tesla, Shopify\n\nValue stocks — companies trading below their intrinsic value. Lower P/E, often pay dividends. More stable.\nExamples: JPMorgan, Exxon, Walmart\n\nBlend investing combines both strategies for balance.',
      },
      {
        title: 'Reading Earnings Reports',
        icon: '📋',
        content:
          'Quarterly earnings reports are one of the most important events for a stock.\n\nWatch for:\n• EPS (beat/miss vs estimates)\n• Revenue growth vs last year\n• Guidance — management\'s forecast for next quarter. Lowering guidance is often punished harshly.\n• Gross Margin — % of revenue kept after cost of goods\n\nA strong earnings beat with raised guidance = very bullish. A miss with lowered guidance = very bearish.',
      },
      {
        title: 'Red Flags to Watch',
        icon: '🚩',
        content:
          'Warning signs in a stock:\n\n• Declining revenue 2+ quarters in a row\n• Increasing debt without revenue growth\n• Insider selling large amounts of their own stock\n• Very high short interest (many traders betting it falls)\n• Sudden CEO/CFO resignation\n• Accounting irregularities or auditor changes\n• Consistently missing earnings estimates\n\nNever ignore red flags hoping things will turn around.',
      },
    ],
  },
  {
    id: 'risk',
    icon: '🛡️',
    title: 'Risk & Strategy',
    color: Colors.market.gain,
    lessons: [
      {
        title: 'Diversification',
        icon: '🧩',
        content:
          'Never put all your money in one stock. Spread across:\n• Different companies\n• Different sectors (tech, healthcare, energy, finance)\n• Different geographies (US, UK, international)\n• Different asset classes (stocks, ETFs)\n\nA diversified portfolio loses less in downturns because not all sectors fall together.',
      },
      {
        title: 'Position Sizing',
        icon: '⚖️',
        content:
          'Position size = how much of your portfolio goes into a single trade.\n\nA common rule:\n• Never put more than 5–10% in one stock\n• Limit any single speculative position to 2–5%\n• Keep higher % in your strongest, most researched ideas\n\nThis ensures one bad trade can\'t destroy your portfolio.',
      },
      {
        title: 'Dollar-Cost Averaging',
        icon: '📅',
        content:
          'DCA = investing a fixed amount regularly (e.g. $100 every week) regardless of price.\n\nBenefits:\n• You buy more shares when prices are low\n• You buy fewer shares when prices are high\n• Removes emotion from timing decisions\n• Beats most attempts at timing the market\n\nIdeal for long-term investors building wealth steadily over time.',
      },
      {
        title: 'Common Beginner Mistakes',
        icon: '⚠️',
        content:
          'Mistakes new traders make:\n\n• FOMO buying — chasing a stock after it already surged\n• Panic selling — dumping stocks during normal corrections\n• Overtrading — racking up commissions with too many trades\n• Ignoring fundamentals — buying hype without research\n• No stop-loss — letting small losses turn into massive ones\n• Investing money you can\'t afford to lose\n\nPatience and discipline beat intelligence in the long run.',
      },
    ],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TutorialScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>('what_is');
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const { isSidebarOpen, setSidebarOpen } = useAppStore();
  const t = useT();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState('');

  // Map lesson titles to translation keys
  const lessonTitleKey: Record<string, string> = {
    'Stocks Explained': 'lesson_stocks_explained',
    'How Stock Trading Works': 'lesson_how_trading_works',
    'Stock Exchanges': 'lesson_stock_exchanges',
    'Stock Price & Change': 'lesson_stock_price_change',
    'Market Indices': 'lesson_market_indices',
    'Bull vs Bear Markets': 'lesson_bull_vs_bear',
    'Volume & Liquidity': 'lesson_volume_liquidity',
    'Market Cap': 'lesson_market_cap',
    'P/E Ratio': 'lesson_pe_ratio',
    'EPS — Earnings Per Share': 'lesson_eps',
    '52-Week High / Low': 'lesson_52w',
    'Dividends & Yield': 'lesson_dividends',
    'Fundamental Analysis': 'lesson_fundamental',
    'Technical Analysis': 'lesson_technical',
    'Growth vs Value Stocks': 'lesson_growth_value',
    'Reading Earnings Reports': 'lesson_earnings',
    'Red Flags to Watch': 'lesson_red_flags',
    'Diversification': 'lesson_diversification',
    'Position Sizing': 'lesson_position_sizing',
    'Dollar-Cost Averaging': 'lesson_dca',
    'Common Beginner Mistakes': 'lesson_mistakes',
  };
  const lessonContentKey: Record<string, string> = {
    'Stocks Explained': 'content_stocks_explained',
    'How Stock Trading Works': 'content_how_trading',
    'Stock Exchanges': 'content_exchanges',
    'Stock Price & Change': 'content_price_change',
    'Market Indices': 'content_indices',
    'Bull vs Bear Markets': 'content_bull_bear',
    'Volume & Liquidity': 'content_volume',
    'Market Cap': 'content_market_cap',
    'P/E Ratio': 'content_pe_ratio',
    'EPS — Earnings Per Share': 'content_eps',
    '52-Week High / Low': 'content_52w',
    'Dividends & Yield': 'content_dividends',
    'Fundamental Analysis': 'content_fundamental',
    'Technical Analysis': 'content_technical',
    'Growth vs Value Stocks': 'content_growth_value',
    'Reading Earnings Reports': 'content_earnings',
    'Red Flags to Watch': 'content_red_flags',
    'Diversification': 'content_diversification',
    'Position Sizing': 'content_position_sizing',
    'Dollar-Cost Averaging': 'content_dca',
    'Common Beginner Mistakes': 'content_mistakes',
  };
  const tLesson = (title: string) => lessonTitleKey[title] ? t(lessonTitleKey[title]) : title;
  const tContent = (title: string, fallback: string) => lessonContentKey[title] ? t(lessonContentKey[title]) : fallback;

  const toggleSection = (id: string) => {
    setExpandedSection(prev => (prev === id ? null : id));
    setExpandedLesson(null);
  };

  const toggleLesson = (key: string) => {
    setExpandedLesson(prev => (prev === key ? null : key));
  };

  const filteredGlossary = useMemo(() => {
    const q = glossarySearch.trim().toLowerCase();
    if (!q) return GLOSSARY;
    return GLOSSARY.filter(
      g => g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q)
    );
  }, [glossarySearch]);

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe}>
      <AppHeader title={t('learn')} />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#0A1628', Colors.bg.primary]}
          style={styles.header}
        >
          <Text style={styles.headerEmoji}>🎓</Text>
          <Text style={styles.headerTitle}>{t('stock_trading_101')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('tutorial_subtitle')}
          </Text>

          {/* Progress pills */}
          <View style={styles.pillRow}>
            <Pill label={`${SECTIONS.length} ${t('topics')}`} color={Colors.brand.primary} />
            <Pill label={`${SECTIONS.reduce((n, s) => n + s.lessons.length, 0)} ${t('lessons')}`} color={Colors.brand.accent} />
            <Pill label={`${GLOSSARY.length} ${t('terms')}`} color={Colors.brand.gold} />
          </View>
        </LinearGradient>

        {/* Sections */}
        <View style={styles.content}>
          {SECTIONS.map((section) => {
            const isOpen = expandedSection === section.id;
            return (
              <View key={section.id} style={styles.sectionCard}>
                {/* Section Header */}
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(section.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.sectionIconBg, { backgroundColor: section.color + '22' }]}>
                    <Text style={styles.sectionIcon}>{section.icon}</Text>
                  </View>
                  <View style={styles.sectionTitleCol}>
                    <Text style={styles.sectionTitle}>{t(section.id === 'what_is' ? 'what_is_trading' : section.id === 'reading_market' ? 'reading_market' : section.id === 'key_terms' ? 'key_terms_metrics' : section.id === 'judging_stocks' ? 'how_to_judge' : 'risk_strategy')}</Text>
                    <Text style={styles.sectionMeta}>{section.lessons.length} {t('lessons')}</Text>
                  </View>
                  <View style={[styles.chevron, isOpen && styles.chevronOpen]}>
                    <Text style={[styles.chevronText, { color: section.color }]}>
                      {isOpen ? '▲' : '▼'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Color bar */}
                <View style={[styles.sectionBar, { backgroundColor: section.color }]} />

                {/* Lessons */}
                {isOpen && (
                  <View style={styles.lessonsContainer}>
                    {section.lessons.map((lesson, idx) => {
                      const lessonKey = `${section.id}_${idx}`;
                      const lessonOpen = expandedLesson === lessonKey;
                      return (
                        <View key={lessonKey} style={styles.lessonWrapper}>
                          <TouchableOpacity
                            style={[styles.lessonRow, lessonOpen && styles.lessonRowActive]}
                            onPress={() => toggleLesson(lessonKey)}
                            activeOpacity={0.75}
                          >
                            <View style={styles.lessonIconWrap}>
                              <Text style={styles.lessonIcon}>{lesson.icon}</Text>
                            </View>
                            <Text style={[styles.lessonTitle, lessonOpen && { color: section.color }]}>
                              {tLesson(lesson.title)}
                            </Text>
                            <Text style={[styles.lessonChevron, { color: section.color }]}>
                              {lessonOpen ? '−' : '+'}
                            </Text>
                          </TouchableOpacity>

                          {lessonOpen && (
                            <View style={styles.lessonContent}>
                              <View style={[styles.lessonContentBar, { backgroundColor: section.color }]} />
                              <Text style={styles.lessonText}>{tContent(lesson.title, lesson.content)}</Text>
                            </View>
                          )}

                          {idx < section.lessons.length - 1 && (
                            <View style={styles.lessonDivider} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {/* Glossary */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setGlossaryOpen(o => !o)}
              activeOpacity={0.75}
            >
              <View style={[styles.sectionIconBg, { backgroundColor: '#A855F722' }]}>
                <Text style={styles.sectionIcon}>📚</Text>
              </View>
              <View style={styles.sectionTitleCol}>
                <Text style={styles.sectionTitle}>Glossary</Text>
                <Text style={styles.sectionMeta}>{GLOSSARY.length} terms, A–Z</Text>
              </View>
              <View style={styles.chevron}>
                <Text style={[styles.chevronText, { color: '#A855F7' }]}>
                  {glossaryOpen ? '▲' : '▼'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={[styles.sectionBar, { backgroundColor: '#A855F7' }]} />

            {glossaryOpen && (
              <View style={styles.glossaryContainer}>
                <TextInput
                  style={styles.glossarySearch}
                  placeholder="Search terms…"
                  placeholderTextColor={Colors.text.tertiary}
                  value={glossarySearch}
                  onChangeText={setGlossarySearch}
                  clearButtonMode="while-editing"
                />
                {filteredGlossary.length === 0 ? (
                  <Text style={styles.glossaryEmpty}>No terms match "{glossarySearch}"</Text>
                ) : (
                  filteredGlossary.map((item, idx) => (
                    <View key={item.term}>
                      <View style={styles.glossaryRow}>
                        <Text style={styles.glossaryTerm}>{item.term}</Text>
                        <Text style={styles.glossaryDef}>{item.definition}</Text>
                      </View>
                      {idx < filteredGlossary.length - 1 && (
                        <View style={styles.lessonDivider} />
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Quick Reference Card */}
          <View style={styles.quickRef}>
            <LinearGradient
              colors={[Colors.bg.tertiary, '#1E2940']}
              style={styles.quickRefGradient}
            >
              <Text style={styles.quickRefTitle}>⚡ Quick Reference</Text>
              <View style={styles.quickRefGrid}>
                {QUICK_REF.map((item) => (
                  <View key={item.term} style={styles.quickRefItem}>
                    <Text style={styles.quickRefTerm}>{item.term}</Text>
                    <Text style={styles.quickRefDef}>{item.def}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              💡 CapitalQuest uses virtual money so you can practice risk-free. Apply what you learn here in your trades!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const GLOSSARY: { term: string; definition: string }[] = [
  { term: 'Ask Price',         definition: 'The lowest price a seller will accept for a stock at a given moment.' },
  { term: 'ATH',               definition: 'All-Time High — the highest price a stock or index has ever reached.' },
  { term: 'Bear Market',       definition: 'A market that has fallen 20%+ from its recent high, with widespread pessimism.' },
  { term: 'Beta',              definition: 'A measure of a stock\'s volatility relative to the overall market. Beta > 1 means more volatile.' },
  { term: 'Bid Price',         definition: 'The highest price a buyer is willing to pay for a stock at a given moment.' },
  { term: 'Blue Chip',         definition: 'Large, well-established companies with a long history of stable performance (e.g. Apple, JPMorgan).' },
  { term: 'Bond',              definition: 'A fixed-income debt security. Investors lend money to a company or government and receive interest.' },
  { term: 'Broker',            definition: 'A person or platform that executes buy and sell orders on behalf of investors.' },
  { term: 'Bull Market',       definition: 'A market that has risen 20%+ from a recent low, with sustained investor confidence.' },
  { term: 'Capital Gains',     definition: 'The profit made from selling an asset for more than you originally paid.' },
  { term: 'Circuit Breaker',   definition: 'A temporary halt in trading triggered when prices fall too fast, to prevent panic selling.' },
  { term: 'Correction',        definition: 'A 10–20% decline in a stock or market index from its recent peak. Normal and healthy.' },
  { term: 'Day Trading',       definition: 'Buying and selling securities within the same trading day to profit from short-term moves.' },
  { term: 'DCA',               definition: 'Dollar-Cost Averaging — investing a fixed amount at regular intervals regardless of price.' },
  { term: 'Diversification',   definition: 'Spreading investments across different assets, sectors, and regions to reduce risk.' },
  { term: 'Dividend',          definition: 'A portion of company profits paid out to shareholders, usually quarterly.' },
  { term: 'EPS',               definition: 'Earnings Per Share — a company\'s net profit divided by its total outstanding shares.' },
  { term: 'Equity',            definition: 'Ownership in a company in the form of shares. Also called stocks or shares.' },
  { term: 'ETF',               definition: 'Exchange-Traded Fund — a basket of securities (stocks, bonds, etc.) that trades like a single stock on an exchange.' },
  { term: 'Float',             definition: 'The number of shares of a company available for public trading (excludes insider-held shares).' },
  { term: 'Fundamental Analysis', definition: 'Evaluating a company\'s financials, management, and business model to determine its intrinsic value.' },
  { term: 'Going Long',        definition: 'Buying a security with the expectation that its price will rise over time.' },
  { term: 'Guidance',          definition: 'Management\'s forward-looking forecast for future earnings or revenue. Heavily watched by investors.' },
  { term: 'Hedge',             definition: 'An investment strategy used to offset potential losses in another position.' },
  { term: 'Index',             definition: 'A benchmark tracking a group of stocks to represent a market segment (e.g. S&P 500, NASDAQ).' },
  { term: 'Index Fund',        definition: 'A fund that passively tracks a market index by holding the same stocks in the same proportions.' },
  { term: 'IPO',               definition: 'Initial Public Offering — the first time a private company sells shares to the public on a stock exchange.' },
  { term: 'Limit Order',       definition: 'An order to buy or sell a stock only at a specified price or better.' },
  { term: 'Liquidity',         definition: 'How easily an asset can be bought or sold at a fair price without significantly affecting its price.' },
  { term: 'Margin',            definition: 'Borrowing money from a broker to buy securities. Amplifies both gains and losses.' },
  { term: 'Market Cap',        definition: 'Market Capitalisation — total market value of a company (share price × total shares outstanding).' },
  { term: 'Market Order',      definition: 'An order to buy or sell a stock immediately at the best available current price.' },
  { term: 'Moving Average',    definition: 'The average closing price of a stock over a set period (e.g. 50-day, 200-day) to smooth out noise.' },
  { term: 'Options',           definition: 'Contracts giving the right (but not obligation) to buy or sell a stock at a set price before a deadline.' },
  { term: 'P/E Ratio',         definition: 'Price-to-Earnings Ratio — share price divided by earnings per share. Measures how much investors pay per $1 of profit.' },
  { term: 'Portfolio',         definition: 'The collection of all investments (stocks, ETFs, cash, etc.) owned by an investor.' },
  { term: 'Position',          definition: 'The amount of a particular security currently held by an investor (long or short).' },
  { term: 'Resistance',        definition: 'A price level where selling pressure has historically prevented a stock from rising further.' },
  { term: 'ROI',               definition: 'Return on Investment — the profit or loss from an investment expressed as a percentage of its cost.' },
  { term: 'S&P 500',           definition: 'An index tracking the 500 largest publicly traded US companies. The most widely followed market benchmark.' },
  { term: 'Sector',            definition: 'A group of companies that operate in the same area of the economy (e.g. Technology, Healthcare, Energy).' },
  { term: 'Short Selling',     definition: 'Borrowing shares and selling them, betting the price will fall so you can buy them back cheaper.' },
  { term: 'Spread',            definition: 'The difference between the bid price and the ask price of a stock.' },
  { term: 'Stock',             definition: 'A share of ownership in a company. Buying stock makes you a partial owner (shareholder).' },
  { term: 'Stop-Loss Order',   definition: 'An order that automatically sells a stock if it falls to a specified price, limiting your losses.' },
  { term: 'Support',           definition: 'A price level where buying interest has historically prevented a stock from falling further.' },
  { term: 'Swing Trading',     definition: 'Holding positions for days to weeks to capture short- to medium-term price swings.' },
  { term: 'Technical Analysis',definition: 'Using price charts, patterns, and indicators to predict future price movements.' },
  { term: 'Ticker Symbol',     definition: 'A unique abbreviation used to identify a publicly traded company (e.g. AAPL = Apple, TSLA = Tesla).' },
  { term: 'Volatility',        definition: 'The degree to which a security\'s price fluctuates over time. High volatility = bigger swings.' },
  { term: 'Volume',            definition: 'The total number of shares of a stock traded during a given time period.' },
  { term: 'Watchlist',         definition: 'A list of securities an investor monitors for potential buying or selling opportunities.' },
  { term: 'Yield',             definition: 'The income generated by an investment (e.g. dividends) expressed as a percentage of its current price.' },
];

const QUICK_REF = [
  { term: 'Bull 🐂', def: 'Market going up' },
  { term: 'Bear 🐻', def: 'Market going down' },
  { term: 'P/E', def: 'Price ÷ Earnings' },
  { term: 'EPS', def: 'Profit per share' },
  { term: 'Mkt Cap', def: 'Price × Shares' },
  { term: 'Volume', def: 'Shares traded/day' },
  { term: 'DCA', def: 'Regular fixed investing' },
  { term: 'Yield', def: 'Dividend ÷ Price' },
  { term: 'ATH', def: 'All-time high price' },
  { term: 'Short', def: 'Betting price falls' },
  { term: 'ETF', def: 'Basket of stocks' },
  { term: 'IPO', def: 'Company goes public' },
];

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#6B2CB8',  // vivid deep purple – matches Learn tab
  },
  scroll: {
    flex: 1,
  },

  // Header
  header: {
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: Spacing.base,
    alignItems: 'center',
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 320,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  pillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // Content
  content: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 40,
    gap: 12,
  },

  // Section card
  sectionCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadow.sm,
  },
  sectionBar: {
    height: 2,
    marginHorizontal: 16,
    borderRadius: 1,
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sectionIconBg: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: {
    fontSize: 22,
  },
  sectionTitleCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  sectionMeta: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  chevron: {},
  chevronOpen: {},
  chevronText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
  },

  // Lessons
  lessonsContainer: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  lessonWrapper: {},
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  lessonRowActive: {
    backgroundColor: Colors.bg.tertiary,
  },
  lessonIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonIcon: {
    fontSize: 16,
  },
  lessonTitle: {
    flex: 1,
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.text.primary,
  },
  lessonChevron: {
    fontSize: 20,
    fontWeight: FontWeight.bold,
    lineHeight: 24,
  },
  lessonContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
    gap: 12,
  },
  lessonContentBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 40,
  },
  lessonText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  lessonDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: 16,
  },

  // Glossary
  glossaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  glossarySearch: {
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  glossaryEmpty: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  glossaryRow: {
    paddingVertical: 10,
    gap: 3,
  },
  glossaryTerm: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#A855F7',
  },
  glossaryDef: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 19,
  },

  // Quick Reference
  quickRef: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 4,
  },
  quickRefGradient: {
    padding: 16,
  },
  quickRefTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: 14,
  },
  quickRefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickRefItem: {
    width: '47%',
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.md,
    padding: 10,
    gap: 3,
  },
  quickRefTerm: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.brand.primary,
  },
  quickRefDef: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },

  // Footer
  footer: {
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
