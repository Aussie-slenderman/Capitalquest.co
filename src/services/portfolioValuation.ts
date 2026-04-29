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
  const updatedHoldings = (portfolio.holdings ?? []).map((holding) => {
    const currentPrice = resolveLivePrice(holding, quotes);
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
  const totalValue = portfolio.cashBalance + currentHoldingsValue;
  const totalGainLoss = totalValue - portfolio.startingBalance;
  const totalGainLossPercent = portfolio.startingBalance > 0
    ? (totalGainLoss / portfolio.startingBalance) * 100
    : 0;

  return {
    ...portfolio,
    holdings: updatedHoldings,
    investedValue,
    totalValue,
    totalGainLoss,
    totalGainLossPercent,
  };
}
