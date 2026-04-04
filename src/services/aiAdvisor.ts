/**
 * AI Advisor Service
 * Uses Claude claude-opus-4-6 with adaptive thinking to analyze market news
 * and provide personalised buy/sell recommendations based on the user's portfolio.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getCompanyNews, getMarketMovers, getQuotes } from './stockApi';
import type { Portfolio } from '../types';

// ─── Client ───────────────────────────────────────────────────────────────────

// The user must supply their Anthropic key in the app settings (stored in
// memory) or as an env variable.  We read it at call-time so it can be set
// after the module is first imported.
function getClient(): Anthropic {
  const key =
    (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) ?? '';
  return new Anthropic({ apiKey: key || 'placeholder', dangerouslyAllowBrowser: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  datetime: number; // unix timestamp
  url: string;
  related?: string; // ticker symbol
}

export interface MarketContext {
  news: NewsItem[];
  topGainers: Array<{ symbol: string; changePercent: number }>;
  topLosers: Array<{ symbol: string; changePercent: number }>;
  portfolioSymbols: string[];
  portfolioValue: number;
  cashBalance: number;
  gainLossPercent: number;
}

export interface StreamCallback {
  onChunk: (text: string) => void;
  onThinking?: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

// ─── News helpers ─────────────────────────────────────────────────────────────

/** Fetch recent news for the user's holdings + general market news. */
async function fetchMarketContext(portfolio: Portfolio | null): Promise<MarketContext> {
  const portfolioSymbols =
    portfolio?.holdings?.map((h: { symbol: string }) => h.symbol) ?? [];

  // Fetch in parallel: per-holding news + movers
  const newsPromises = portfolioSymbols.slice(0, 5).map((sym) =>
    getCompanyNews(sym, getDateDaysAgo(7), getTodayDate()).catch(() => [])
  );

  const [moversRaw, ...newsArrays] = await Promise.all([
    getMarketMovers().catch(() => ({ gainers: [], losers: [] })),
    ...newsPromises,
  ]);

  const movers = moversRaw as { gainers: Array<{ symbol: string; changePercent: number }>; losers: Array<{ symbol: string; changePercent: number }> };

  // Flatten + dedupe news items
  const allNews: NewsItem[] = (newsArrays.flat() as NewsItem[])
    .filter((n) => n && n.headline)
    .slice(0, 20);

  return {
    news: allNews,
    topGainers: (movers.gainers ?? []).slice(0, 5),
    topLosers: (movers.losers ?? []).slice(0, 5),
    portfolioSymbols,
    portfolioValue: portfolio?.totalValue ?? 0,
    cashBalance: portfolio?.cashBalance ?? 0,
    gainLossPercent: portfolio?.totalGainLossPercent ?? 0,
  };
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a friendly financial educator for StockQuest, a VIRTUAL stock trading SIMULATION game. This is NOT real investing — all money is virtual and no real funds are ever involved.

Your role is to:
1. Help students learn about how markets work by discussing current news and trends
2. Review the user's virtual portfolio performance in the simulation
3. Suggest educational strategies the student could explore in the simulation (e.g. "you might consider looking into…")
4. Reference historical market events (dot-com bubble, 2008 crash, COVID dip, etc.) as learning examples
5. Reinforce that this is a game for learning — no real money, no real risk

Communication style:
- Friendly, encouraging, age-appropriate — like a fun teacher or mentor
- Explain the reasoning behind every suggestion using simple analogies
- Frame everything as learning opportunities, not financial advice
- Never guarantee outcomes — emphasise that markets are unpredictable
- Use hedging language: "you might explore", "one strategy could be", "historically…"

Format your response with clear sections:
📰 Market Snapshot — 2–3 interesting things happening in markets
📊 Your Portfolio — how the student's simulation portfolio is doing
🤔 Fun Fact — a cool historical market parallel
💡 Ideas to Explore — educational strategies to try in the simulation
⚠️ Remember — this is a learning game with virtual money
`;
}

function buildUserPrompt(ctx: MarketContext, userQuestion: string): string {
  const newsSection =
    ctx.news.length > 0
      ? ctx.news
          .slice(0, 8)
          .map((n) => `• [${n.related ?? 'MARKET'}] ${n.headline} — ${n.summary?.slice(0, 120) ?? ''}`)
          .join('\n')
      : 'No specific news fetched (API key not configured — use general market knowledge).';

  const holdingsSection =
    ctx.portfolioSymbols.length > 0
      ? `Holdings: ${ctx.portfolioSymbols.join(', ')}\nPortfolio value: $${ctx.portfolioValue.toLocaleString()} | Cash: $${ctx.cashBalance.toLocaleString()} | Total gain/loss: ${ctx.gainLossPercent >= 0 ? '+' : ''}${ctx.gainLossPercent.toFixed(2)}%`
      : 'No holdings yet (new account or data unavailable).';

  const moversSection = [
    ctx.topGainers.length ? `Top gainers: ${ctx.topGainers.map((g) => `${g.symbol} +${g.changePercent?.toFixed(1)}%`).join(', ')}` : '',
    ctx.topLosers.length ? `Top losers: ${ctx.topLosers.map((l) => `${l.symbol} ${l.changePercent?.toFixed(1)}%`).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `## Current Market Data (${new Date().toDateString()})

### Recent News:
${newsSection}

### Market Movers Today:
${moversSection || 'Market mover data unavailable.'}

### My Portfolio:
${holdingsSection}

### My Question:
${userQuestion}

Please provide your analysis and recommendations.`;
}

// ─── Main streaming function ──────────────────────────────────────────────────

/**
 * Stream an AI market analysis response.
 * Calls Claude claude-opus-4-6 with adaptive thinking; invokes callbacks as chunks arrive.
 */
export async function streamMarketAdvice(
  portfolio: Portfolio | null,
  userQuestion: string,
  callbacks: StreamCallback,
  apiKey?: string
): Promise<void> {
  try {
    // Build client with provided key or env key
    const client = new Anthropic({
      apiKey: apiKey || (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) || 'placeholder',
      dangerouslyAllowBrowser: true,
    });

    // Fetch market context
    const ctx = await fetchMarketContext(portfolio);
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(ctx, userQuestion);

    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          callbacks.onChunk(event.delta.text);
        } else if (event.delta.type === 'thinking_delta' && callbacks.onThinking) {
          callbacks.onThinking(event.delta.thinking);
        }
      }
    }

    callbacks.onDone();
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error contacting AI service.';

    // Provide helpful mock response if no API key or content blocked
    if (
      message.includes('401') ||
      message.includes('placeholder') ||
      message.includes('invalid') ||
      message.includes('content filtering') ||
      message.includes('Output blocked') ||
      message.includes('400')
    ) {
      callbacks.onChunk(getMockAdvice(portfolio));
      callbacks.onDone();
    } else {
      callbacks.onError(message);
    }
  }
}

// ─── Mock advice (when no API key) ───────────────────────────────────────────

function getMockAdvice(portfolio: Portfolio | null): string {
  const hasHoldings = (portfolio?.holdings?.length ?? 0) > 0;
  const gainLoss = portfolio?.totalGainLossPercent ?? 0;

  return `📰 **Market Snapshot**
Markets are seeing mixed signals today. Tech stocks remain volatile following recent earnings reports, while energy and healthcare sectors show relative strength.

📊 **Your Portfolio**
${hasHoldings
  ? `You're currently ${gainLoss >= 0 ? 'up' : 'down'} ${Math.abs(gainLoss).toFixed(2)}% overall. ${gainLoss > 5 ? '🎉 Great work!' : gainLoss < -5 ? 'Don\'t worry — market dips are normal learning opportunities!' : 'Steady performance — keep it up!'}`
  : 'You haven\'t made any trades yet. A great time to start exploring!'}

🤔 **Historical Context**
Markets have historically rewarded patient, diversified investors. During the 2020 COVID crash, markets dropped 34% in 33 days — but recovered fully within 5 months. This teaches us: **short-term volatility is normal; long-term trends matter more.**

💡 **Recommendations**
• **Diversify** — If you hold only 1–2 stocks, consider spreading across different sectors (tech, healthcare, consumer goods)
• **Dollar-Cost Average** — Instead of investing all at once, consider buying a little each week
• **Research before buying** — Look at a company's earnings growth, debt levels, and competitive position
• **Consider index-style investing** — Stocks like SPY (S&P 500 ETF) give exposure to 500 companies at once

⚠️ **Risk Reminder**
All investing involves risk. Past performance never guarantees future results. This is virtual money — use it to learn without fear!

---
*🔑 To get real-time AI analysis personalised to current news, add your Anthropic API key in the Settings tab.*`;
}

export { fetchMarketContext };
