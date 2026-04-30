import type { Portfolio, Holding, StockQuote } from '../types';

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function getSymbolVariants(symbol: string): string[] {
  const raw = (symbol || '').trim().toUpperCase();
  if (!raw) return [];
  const dotted = raw.replace(/[_-]/g, '.');
  const dashed = dotted.replace(/\./g, '-');
  const underscored = dotted.replace(/\./g, '_');
  return unique([raw, dotted, dashed, underscored]);
}

function resolveQuoteForSymbol(
  symbol: string,
  quotes: Record<string, StockQuote>,
): StockQuote | undefined {
  for (const candidate of getSymbolVariants(symbol)) {
    const quote = quotes[candidate];
    if (quote) return quote;
  }
  return undefined;
}

function resolveLivePrice(
  holding: Holding,
  quotes: Record<string, StockQuote>,
): number {
  const quote = resolveQuoteForSymbol(holding.symbol, quotes);
  if (quote && Number.isFinite(quote.price) && quote.price > 0) return quote.price;
  if (Number.isFinite(holding.currentPrice) && holding.currentPrice > 0) return holding.currentPrice;
  if (Number.isFinite(holding.avgCostBasis) && holding.avgCostBasis > 0) return holding.avgCostBasis;
  return 0;
}

export function computePortfolioLiveMetrics(
  portfolio: Portfolio,
  quotes: Record<string, StockQuote>,
): Portfolio {
  // Track which holdings actually got a live quote applied so we can
  // distinguish "live valuation" from "fell back to cost basis for every
  // holding" (which would falsely report a $0 gain/loss).
  let liveQuoteHits = 0;
  const updatedHoldings = (portfolio.holdings ?? []).map((holding) => {
    const quote = resolveQuoteForSymbol(holding.symbol, quotes);
    const hasLiveQuote = !!(quote && Number.isFinite(quote.price) && quote.price > 0);
    if (hasLiveQuote) liveQuoteHits += 1;
    const currentPrice = hasLiveQuote
      ? quote!.price
      : (Number.isFinite(holding.currentPrice) && holding.currentPrice > 0
          ? holding.currentPrice
          : (Number.isFinite(holding.avgCostBasis) && holding.avgCostBasis > 0
              ? holding.avgCostBasis
              : 0));
    const currentValue = currentPrice * holding.shares;
    const gainLoss = currentValue - holding.totalCost;
    const gainLossPercent = holding.totalCost > 0 ? (gainLoss / holding.totalCost) * 100 : 0;
    return {
      ...holding,
      currentPrice,
      currentValue,
      gainLoss,
      gainLossPercent,
    };
  });

  const investedValue = updatedHoldings.reduce((sum, holding) => sum + holding.totalCost, 0);
  const currentHoldingsValue = updatedHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const computedTotalValue = portfolio.cashBalance + currentHoldingsValue;
  const computedGainLoss = computedTotalValue - portfolio.startingBalance;
  const computedGainLossPercent = portfolio.startingBalance > 0
    ? (computedGainLoss / portfolio.startingBalance) * 100
    : 0;

  // If we have holdings but couldn't apply any live quote (the quotes map
  // is empty or doesn't match any symbol), the recomputed totals collapse
  // to the cost basis and would show a misleading $0 gain. In that case
  // prefer the persisted totals from Firestore — those were last computed
  // with real prices (server-side or the previous client session).
  const holdingCount = (portfolio.holdings ?? []).length;
  const useStoredTotals =
    holdingCount > 0 &&
    liveQuoteHits === 0 &&
    typeof portfolio.totalValue === 'number' &&
    Number.isFinite(portfolio.totalValue) &&
    portfolio.totalValue > 0;

  const totalValue = useStoredTotals ? portfolio.totalValue : computedTotalValue;
  const totalGainLoss = useStoredTotals && typeof portfolio.totalGainLoss === 'number'
    ? portfolio.totalGainLoss
    : computedGainLoss;
  const totalGainLossPercent = useStoredTotals && typeof portfolio.totalGainLossPercent === 'number'
    ? portfolio.totalGainLossPercent
    : computedGainLossPercent;

  return {
    ...portfolio,
    holdings: updatedHoldings,
    investedValue,
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
  };
}
