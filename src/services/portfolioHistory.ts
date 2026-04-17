/**
 * Portfolio History Reconstruction
 *
 * Derives daily historical portfolio values by walking backward through
 * the user's transaction log and pricing each day's holdings using
 * historical close prices.
 *
 * Used when Firestore snapshots are missing or too sparse to show a
 * meaningful chart.
 */

import type { Portfolio, Transaction, ChartPeriod } from '../types';
import { getChartData } from './stockApi';

export type PortfolioChartPeriod = '1W' | '1M' | '1Y' | 'YTD' | 'ALL';

export interface HistoryPoint { timestamp: number; totalValue: number; }

const DAY_MS = 24 * 60 * 60 * 1000;

function getPeriodCutoff(period: PortfolioChartPeriod, createdAt?: number): number {
  const now = Date.now();
  switch (period) {
    case '1W':  return now - 7 * DAY_MS;
    case '1M':  return now - 30 * DAY_MS;
    case '1Y':  return now - 365 * DAY_MS;
    case 'YTD': return new Date(new Date().getFullYear(), 0, 1).getTime();
    case 'ALL': return createdAt ?? (now - 5 * 365 * DAY_MS);
  }
}

function mapToStockPeriod(period: PortfolioChartPeriod): ChartPeriod {
  switch (period) {
    case '1W':  return '1M'; // grab a month for safety
    case '1M':  return '1M';
    case '1Y':  return '1Y';
    case 'YTD': return '1Y';
    case 'ALL': return '5Y';
  }
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Build a symbol → { dayKey: closePrice } map for all symbols the user
 * has ever held. Uses Yahoo historical chart data via getChartData.
 *
 * Only one API call per unique symbol.
 */
async function buildPriceMap(
  symbols: string[],
  stockPeriod: ChartPeriod,
): Promise<Record<string, Record<string, number>>> {
  const priceMap: Record<string, Record<string, number>> = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const data = await getChartData(sym, stockPeriod);
        const byDay: Record<string, number> = {};
        for (const point of data) {
          if (point.close > 0) {
            byDay[dayKey(point.timestamp)] = point.close;
          }
        }
        priceMap[sym] = byDay;
      } catch {
        priceMap[sym] = {};
      }
    }),
  );

  return priceMap;
}

/**
 * Given a price map and a day, return the close price using the day's
 * close, or the nearest earlier known close (handles weekends/holidays).
 */
function priceOnOrBefore(
  priceMap: Record<string, number>,
  targetDay: number,
): number | undefined {
  const targetKey = dayKey(targetDay);
  if (priceMap[targetKey] != null) return priceMap[targetKey];

  // Walk backwards up to 10 days to find the nearest earlier known close
  for (let i = 1; i <= 10; i++) {
    const t = targetDay - i * DAY_MS;
    const k = dayKey(t);
    if (priceMap[k] != null) return priceMap[k];
  }
  return undefined;
}

/**
 * Reconstruct per-day portfolio totalValue over the given period by
 * rolling back transactions day-by-day and pricing holdings with
 * historical closes.
 */
export async function reconstructPortfolioHistory(
  portfolio: Portfolio,
  transactions: Transaction[],
  period: PortfolioChartPeriod,
): Promise<HistoryPoint[]> {
  const cutoff = getPeriodCutoff(period, portfolio.createdAt);
  const now = Date.now();
  const todayKey = endOfDay(now);

  const symbolSet = new Set<string>();
  (portfolio.holdings ?? []).forEach(h => symbolSet.add(h.symbol));
  transactions.forEach(t => symbolSet.add(t.symbol));
  const symbols = Array.from(symbolSet);

  if (symbols.length === 0) {
    return buildFlatFromCash(portfolio, cutoff);
  }

  // Sort transactions newest → oldest for rollback
  const txNewestFirst = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  const earliestTxTime = transactions.length > 0
    ? Math.min(...transactions.map(t => t.timestamp))
    : now;

  // Fetch historical prices in parallel (one call per symbol).
  // If this fails we fall back to a simpler start-to-current interpolation.
  const stockPeriod = mapToStockPeriod(period);
  const priceMap = await buildPriceMap(symbols, stockPeriod);

  // Start from CURRENT state and walk backward
  let cash = portfolio.cashBalance;
  const shares: Record<string, number> = {};
  (portfolio.holdings ?? []).forEach(h => {
    shares[h.symbol] = h.shares;
  });

  const points: HistoryPoint[] = [];

  let cursor = todayKey;
  let txIdx = 0;

  while (cursor >= cutoff) {
    // Roll back transactions that happened AFTER this cursor day
    while (txIdx < txNewestFirst.length && txNewestFirst[txIdx].timestamp > cursor) {
      const tx = txNewestFirst[txIdx];
      if (tx.type === 'buy') {
        cash += tx.total;
        shares[tx.symbol] = (shares[tx.symbol] ?? 0) - tx.shares;
      } else if (tx.type === 'sell') {
        cash -= tx.total;
        shares[tx.symbol] = (shares[tx.symbol] ?? 0) + tx.shares;
      } else if (tx.type === 'dividend') {
        cash -= tx.total;
      }
      txIdx++;
    }

    // If the cursor is BEFORE any transaction occurred, the user just
    // had their starting cash and no holdings → anchor to startingBalance.
    if (cursor < earliestTxTime) {
      points.push({
        timestamp: cursor,
        totalValue: portfolio.startingBalance ?? cash,
      });
      cursor -= DAY_MS;
      continue;
    }

    // Compute holdings value using historical close prices
    let holdingsValue = 0;
    let pricedAll = true;
    for (const [sym, qty] of Object.entries(shares)) {
      if (Math.abs(qty) < 1e-9) continue;
      const px = priceOnOrBefore(priceMap[sym] ?? {}, cursor);
      if (px != null) {
        holdingsValue += qty * px;
      } else {
        pricedAll = false;
        // Best-effort: use cost basis only if nothing else is available
        const fallbackTx = transactions.find(t => t.symbol === sym && t.timestamp <= cursor);
        if (fallbackTx) holdingsValue += qty * fallbackTx.price;
      }
    }

    // Anchor today's point to the authoritative current total value.
    // Without this, stale Yahoo data for "today" collapses to cost basis.
    const totalValue = (cursor === todayKey)
      ? portfolio.totalValue
      : (pricedAll ? cash + holdingsValue : cash + holdingsValue);

    points.push({ timestamp: cursor, totalValue });
    cursor -= DAY_MS;
  }

  // Oldest → newest
  const reversed = points.reverse();

  // Safety net: if every reconstructed point is essentially the same
  // (e.g. historical prices all missing AND no transactions occurred in
  // the window), synthesise a simple 2-point series from startingBalance
  // → totalValue so the chart still communicates direction.
  const values = reversed.map(p => p.totalValue);
  const range = Math.max(...values) - Math.min(...values);
  if (range < 0.01 && Math.abs(portfolio.totalGainLoss ?? 0) > 0.01) {
    const first = reversed[0];
    const last = reversed[reversed.length - 1];
    if (first && last) {
      // Linearly interpolate between start and current so the user at
      // least sees the direction of travel.
      const start = portfolio.startingBalance ?? first.totalValue;
      const end = portfolio.totalValue;
      const span = last.timestamp - first.timestamp || 1;
      return reversed.map(p => ({
        timestamp: p.timestamp,
        totalValue: start + ((end - start) * (p.timestamp - first.timestamp)) / span,
      }));
    }
  }

  return reversed;
}

/**
 * When a user has no transactions (never traded), chart the starting
 * cash as a flat line over the period.
 */
function buildFlatFromCash(portfolio: Portfolio, cutoff: number): HistoryPoint[] {
  const value = portfolio.startingBalance ?? portfolio.cashBalance ?? 10000;
  const now = Date.now();
  const points: HistoryPoint[] = [];
  for (let t = endOfDay(cutoff); t <= now; t += DAY_MS) {
    points.push({ timestamp: t, totalValue: value });
  }
  if (points.length === 0) points.push({ timestamp: now, totalValue: value });
  return points;
}
