/**
 * Trading Engine
 *
 * Handles buy/sell orders, portfolio recalculation,
 * fractional shares, P&L, and leaderboard sync.
 *
 * Works in two modes:
 *  - Firebase mode: persists to Firestore (when real credentials are configured)
 *  - Local mode: persists to Zustand store only (no Firebase needed)
 */

import {
  getPortfolio,
  updatePortfolio,
  addTransaction,
  updateLeaderboardEntry,
  updateUser,
  savePortfolioSnapshot,
  IS_MOCK_FIREBASE,
} from './firebase';
import { getQuote } from './stockApi';
import { ACHIEVEMENTS, XP_PER_5_PERCENT, getLevelFromXP } from '../constants/achievements';
import { SHOP_ITEMS, blingAtMilestone, getPetBonusMultiplier } from '../constants/shopItems';
import { POPULAR_STOCKS } from '../constants/stocks';
import { useAppStore } from '../store/useAppStore';
import type { Holding, Order, Portfolio, Transaction, Achievement } from '../types';
import { nanoid } from '../utils/nanoid';
import { computePortfolioLiveMetrics } from './portfolioValuation';

// ─── Place Order ──────────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  userId: string;
  symbol: string;
  type: 'buy' | 'sell';
  /** Pass ONE of shares or dollarAmount */
  shares?: number;
  dollarAmount?: number;
  orderType?: 'market' | 'limit';
  limitPrice?: number;
  userName: string;
  country: string;
}

export interface OrderResult {
  success: boolean;
  error?: string;
  order?: Order;
  filledShares?: number;
  filledPrice?: number;
  total?: number;
  status?: 'filled' | 'pending';
}

export async function placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
  const {
    userId, symbol, type, shares, dollarAmount,
    orderType = 'market', limitPrice, userName, country,
  } = params;

  // 1. Fetch current price
  const quote = await getQuote(symbol);
  const price = quote.price;
  if (!price || price === 0) {
    return { success: false, error: 'Unable to fetch current price. Try again.' };
  }

  // 2. Check limit order conditions
  if (orderType === 'limit' && limitPrice != null && limitPrice > 0) {
    const shouldFillNow =
      (type === 'buy' && price <= limitPrice) ||
      (type === 'sell' && price >= limitPrice);

    if (!shouldFillNow) {
      // Price hasn't reached the limit — create a pending order
      let pendingShares: number;
      if (dollarAmount !== undefined) {
        pendingShares = dollarAmount / limitPrice; // estimate at limit price
      } else if (shares !== undefined) {
        pendingShares = shares;
      } else {
        return { success: false, error: 'Specify shares or dollar amount.' };
      }

      const pendingOrder: Order = {
        id: `limit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        symbol,
        type,
        orderType: 'limit',
        shares: pendingShares,
        dollarAmount,
        limitPrice,
        status: 'pending',
        createdAt: Date.now(),
      };

      // Store in Zustand pending orders
      useAppStore.getState().addPendingOrder(pendingOrder);

      return {
        success: true,
        order: pendingOrder,
        status: 'pending',
      };
    }
    // If limit price IS met, fall through to execute at current market price
  }

  // 3. Calculate shares
  let filledShares: number;
  if (dollarAmount !== undefined) {
    filledShares = dollarAmount / price; // fractional
  } else if (shares !== undefined) {
    filledShares = shares;
  } else {
    return { success: false, error: 'Specify shares or dollar amount.' };
  }

  if (filledShares <= 0) {
    return { success: false, error: 'Invalid order quantity.' };
  }

  let total = filledShares * price;

  // 3. Load portfolio — from Firebase or local Zustand store
  let portfolio: Portfolio | null = null;

  if (IS_MOCK_FIREBASE) {
    portfolio = useAppStore.getState().portfolio;
    // Auto-create portfolio if none exists (offline mode)
    if (!portfolio) {
      portfolio = createDefaultPortfolio(userId, 10000);
      useAppStore.getState().setPortfolio(portfolio);
    }
  } else {
    try {
      portfolio = await getPortfolio(userId) as Portfolio | null;
    } catch {
      // Firebase failed — fall back to local state
      portfolio = useAppStore.getState().portfolio;
    }
    if (!portfolio) {
      portfolio = useAppStore.getState().portfolio;
      if (!portfolio) {
        return { success: false, error: 'Portfolio not found. Please restart the app.' };
      }
    }
  }

  // 4. Validate
  if (type === 'buy') {
    // Allow 1-cent tolerance for floating-point drift from fractional share math.
    // If the player types their exact displayed cash and the stored value has
    // drifted by fractions of a cent, clamp total & filledShares to the actual
    // available cash so the order fills cleanly with no negative balance.
    if (total > portfolio.cashBalance + 0.01) {
      return { success: false, error: 'Insufficient cash balance.' };
    }
    if (total > portfolio.cashBalance) {
      // Within tolerance — clamp to exact cash and recompute shares.
      total = portfolio.cashBalance;
      filledShares = total / price;
    }
  } else {
    // Sell: check holding
    const holding = portfolio.holdings.find(h => h.symbol === symbol);
    if (!holding || holding.shares < filledShares) {
      return { success: false, error: 'Insufficient shares to sell.' };
    }
  }

  // 5. Update portfolio calculations
  // Apply equipped pet tier bonus + active ability bonus to sell proceeds
  if (type === 'sell') checkVolcanoProc(useAppStore.getState().equippedPetId);
  const petMultiplier = type === 'sell'
    ? getPetBonusMultiplier(useAppStore.getState().equippedPetId) * getSellAbilityMultiplier()
    : 1;
  const earnedTotal = total * petMultiplier;

  const updatedHoldings = updateHoldings(
    portfolio.holdings || [],
    symbol,
    filledShares,
    price,
    type
  );

  const newCash = type === 'buy'
    ? portfolio.cashBalance - total
    : portfolio.cashBalance + earnedTotal;

  const investedValue = updatedHoldings.reduce((sum, h) => sum + h.totalCost, 0);
  const currentHoldingsValue = updatedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalValue = newCash + currentHoldingsValue;
  const gainLoss = totalValue - portfolio.startingBalance;
  const gainLossPercent = portfolio.startingBalance > 0
    ? (gainLoss / portfolio.startingBalance) * 100
    : 0;

  // Create the new order record
  const newOrder: Order = {
    id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    symbol,
    type,
    shares: filledShares,
    filledShares,
    filledPrice: price,
    total: type === 'buy' ? total : earnedTotal,
    status: 'filled',
    orderType: orderType || 'market',
    createdAt: Date.now(),
    filledAt: Date.now(),
  };

  const updatedOrders = [...(portfolio.orders || []), newOrder];

  // Track lowest gain percent for recovery achievement
  const prevLowest = (portfolio as any).lowestGainPercent ?? 0;
  const lowestGainPercent = Math.min(prevLowest, gainLossPercent);

  const updatedPortfolio: Portfolio = {
    ...portfolio,
    cashBalance: newCash,
    holdings: updatedHoldings,
    orders: updatedOrders,
    investedValue,
    totalValue,
    totalGainLoss: gainLoss,
    totalGainLossPercent: gainLossPercent,
    lowestGainPercent,
  } as Portfolio;

  // 6. Always update local Zustand state immediately (instant UI refresh)
  useAppStore.getState().setPortfolio(updatedPortfolio);

  // 7. Persist to storage (Firebase or mock)
  // Always sync leaderboard so real users appear in rankings
  try {
    const { updateLeaderboardEntry: authUpdateLb } = await import('./auth');
    await authUpdateLb(userId, {
      userId,
      username: userName,
      displayName: userName,
      startingBalance: portfolio.startingBalance,
      currentValue: totalValue,
      gainDollars: gainLoss,
      country,
      updatedAt: Date.now(),
    });
  } catch { /* non-critical */ }

  if (!IS_MOCK_FIREBASE) {
    try {
      await updatePortfolio(userId, {
        cashBalance: newCash,
        holdings: updatedHoldings,
        orders: updatedPortfolio.orders || [],
        investedValue,
        totalValue,
        totalGainLoss: gainLoss,
        totalGainLossPercent: gainLossPercent,
        lowestGainPercent,
        lastUpdated: Date.now(),
      });
    } catch {
      // Local update already applied — Firebase sync will retry on next refresh
    }

    // Save transaction to Firebase
    try {
      const transaction: Omit<Transaction, 'id'> = {
        userId, symbol, type,
        shares: filledShares, price,
        total: earnedTotal, // includes pet bonus for sells
        timestamp: Date.now(),
      };
      await addTransaction(userId, transaction);
    } catch { /* non-critical */ }

    // Save daily portfolio snapshot for weekly email charts
    savePortfolioSnapshot(userId, totalValue, newCash, gainLoss, gainLossPercent)
      .catch(() => { /* non-critical */ });

    // XP is now only awarded through achievements (checked in _layout.tsx)
  }

  const order: Order = {
    id: nanoid(),
    userId,
    symbol,
    type,
    orderType,
    shares: filledShares,
    dollarAmount,
    limitPrice,
    status: 'filled',
    filledAt: Date.now(),
    filledPrice: price,
    filledShares,
    createdAt: Date.now(),
  };

  // Check & award achievements (non-blocking)
  checkAndAwardAchievements(userId, updatedPortfolio, {
    symbol, type, shares: filledShares, dollarAmount,
  }).catch(() => {/* non-critical */});

  // Award bling for any newly-crossed $500 gain milestones (non-blocking)
  awardBlingForMilestones(gainLoss).catch(() => {/* non-critical */});

  return { success: true, order, filledShares, filledPrice: price, total: earnedTotal, status: 'filled' };
}

// ─── Default local portfolio ──────────────────────────────────────────────────

function createDefaultPortfolio(userId: string, startingBalance: number): Portfolio {
  return {
    userId,
    cashBalance: startingBalance,
    startingBalance,
    totalValue: startingBalance,
    investedValue: 0,
    totalGainLoss: 0,
    totalGainLossPercent: 0,
    holdings: [],
    orders: [],
    createdAt: Date.now(),
  };
}

// ─── Recalculate Portfolio Prices ─────────────────────────────────────────────

export async function refreshPortfolioPrices(userId: string): Promise<void> {
  // Try Firebase first, fall back to local state
  let portfolio: Portfolio | null = null;
  if (!IS_MOCK_FIREBASE) {
    try {
      portfolio = await getPortfolio(userId) as Portfolio | null;
    } catch { /* fall through */ }
  }
  if (!portfolio) {
    portfolio = useAppStore.getState().portfolio;
  }
  if (!portfolio || !portfolio.holdings?.length) return;

  const symbols = portfolio.holdings.map(h => h.symbol);
  const { getQuotes } = await import('./stockApi');
  const quotes = await getQuotes(symbols);
  const updatedPortfolio = computePortfolioLiveMetrics(portfolio, quotes);
  const totalValue = updatedPortfolio.totalValue;
  const gainLoss = updatedPortfolio.totalGainLoss;
  const gainLossPercent = updatedPortfolio.totalGainLossPercent;

  // Always update Zustand for immediate UI refresh
  useAppStore.getState().setPortfolio(updatedPortfolio);

  if (!IS_MOCK_FIREBASE) {
    try {
      await updatePortfolio(userId, {
        holdings: updatedPortfolio.holdings,
        investedValue: updatedPortfolio.investedValue,
        totalValue,
        totalGainLoss: gainLoss,
        totalGainLossPercent: gainLossPercent,
        lastUpdated: Date.now(),
      });
    } catch { /* non-critical */ }

    // Sync leaderboard so rankings reflect latest prices in real time
    try {
      const user = useAppStore.getState().user;
      if (user) {
        await updateLeaderboardEntry(userId, {
          userId,
          username: user.username ?? 'Player',
          displayName: user.displayName ?? user.username ?? 'Player',
          startingBalance: portfolio.startingBalance,
          currentValue: totalValue,
          gainDollars: gainLoss,
          country: user.country ?? '',
          level: user.level ?? 1,
          updatedAt: Date.now(),
        });
      }
    } catch { /* non-critical */ }

    // Save hourly snapshot for 30-day performance chart
    try {
      const { saveHourlySnapshot } = await import('./firebase');
      await saveHourlySnapshot(userId, totalValue);
    } catch { /* non-critical */ }

  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateHoldings(
  holdings: Holding[],
  symbol: string,
  shares: number,
  price: number,
  type: 'buy' | 'sell'
): Holding[] {
  const existing = holdings.find(h => h.symbol === symbol);

  if (type === 'buy') {
    if (existing) {
      const newShares = existing.shares + shares;
      const newCost = existing.totalCost + shares * price;
      const avgCost = newCost / newShares;
      const currentValue = newShares * price;
      const gainLoss = currentValue - newCost;
      return holdings.map(h =>
        h.symbol === symbol
          ? {
              ...h,
              shares: newShares,
              totalCost: newCost,
              avgCostBasis: avgCost,
              currentPrice: price,
              currentValue,
              gainLoss,
              gainLossPercent: (gainLoss / newCost) * 100,
            }
          : h
      );
    } else {
      const totalCost = shares * price;
      const currentValue = totalCost;
      const newHolding: Holding = {
        symbol,
        shares,
        avgCostBasis: price,
        currentPrice: price,
        currentValue,
        totalCost,
        gainLoss: 0,
        gainLossPercent: 0,
      };
      return [...holdings, newHolding];
    }
  } else {
    // sell
    if (!existing) return holdings;
    const newShares = existing.shares - shares;
    if (newShares <= 0.00001) {
      return holdings.filter(h => h.symbol !== symbol);
    }
    const newCost = existing.avgCostBasis * newShares;
    const currentValue = newShares * price;
    const gainLoss = currentValue - newCost;
    return holdings.map(h =>
      h.symbol === symbol
        ? {
            ...h,
            shares: newShares,
            totalCost: newCost,
            currentPrice: price,
            currentValue,
            gainLoss,
            gainLossPercent: newCost > 0 ? (gainLoss / newCost) * 100 : 0,
          }
        : h
    );
  }
}

// Returns 2 when an xp_boost ability is active, otherwise 1
function getXPMultiplier(): number {
  const { petAbilityActiveUntil, equippedPetId } = useAppStore.getState();
  if (!petAbilityActiveUntil || Date.now() >= petAbilityActiveUntil) return 1;
  if (!equippedPetId || equippedPetId.startsWith('trophy:')) return 1;
  const item = SHOP_ITEMS.find(i => i.id === equippedPetId && i.type === 'pet');
  const abilityType = item?.ability?.abilityType ?? 'xp_boost';
  return abilityType === 'xp_boost' ? 2 : 1;
}

// Returns the sell earnings multiplier from an active timed/luck ability
function getSellAbilityMultiplier(): number {
  const { petAbilityActiveUntil, equippedPetId } = useAppStore.getState();
  if (!petAbilityActiveUntil || Date.now() >= petAbilityActiveUntil) return 1;
  if (!equippedPetId || equippedPetId.startsWith('trophy:')) return 1;
  const item = SHOP_ITEMS.find(i => i.id === equippedPetId && i.type === 'pet');
  const abilityType = item?.ability?.abilityType;
  if (abilityType === 'sell_boost') return 6;   // +500% = ×6
  if (abilityType === 'daily_luck') return 2;   // ×2 when proc'd
  return 1;
}

// Auto-rolls a 5% daily luck proc for the Volcano pet on each sell
function checkVolcanoProc(equippedPetId: string | null): void {
  if (!equippedPetId || equippedPetId.startsWith('trophy:')) return;
  const item = SHOP_ITEMS.find(i => i.id === equippedPetId && i.type === 'pet');
  if (!item?.ability || item.ability.abilityType !== 'daily_luck') return;
  const state = useAppStore.getState();
  const lastRoll = state.petAbilityLastUsed[equippedPetId] ?? 0;
  const now = Date.now();
  if (now - lastRoll < 24 * 60 * 60 * 1000) return; // Already rolled today
  state.setPetAbilityLastUsed(equippedPetId, now);
  if (Math.random() < 0.05) {
    // Lucky! Double sell earnings for 24 hours
    state.setPetAbilityActiveUntil(now + 24 * 60 * 60 * 1000);
  }
}

// Track which $100 checkpoints have been crossed to award XP
let lastCheckpoint = 0;

async function checkAndAwardMilestoneXP(userId: string, gainDollars: number) {
  const checkpoint = Math.floor(Math.max(0, gainDollars) / 100) * 100;
  if (checkpoint > lastCheckpoint) {
    const baseXP = ((checkpoint - lastCheckpoint) / 100) * (XP_PER_5_PERCENT / 5);
    const xpGained = Math.round(baseXP * getXPMultiplier());
    lastCheckpoint = checkpoint;
    const { getUserById } = await import('./firebase');
    const user = await getUserById(userId) as { xp?: number } | null;
    if (!user) return;
    const newXP = (user.xp || 0) + xpGained;
    const level = getLevelFromXP(newXP);
    await updateUser(userId, { xp: newXP, level: level.level });
  }
}

// ─── Achievement checking ──────────────────────────────────────────────────────

async function checkAndAwardAchievements(
  userId: string,
  portfolio: Portfolio,
  tradeInfo: { symbol: string; type: 'buy' | 'sell'; shares: number; dollarAmount?: number }
) {
  const store = useAppStore.getState();
  const user = store.user;
  if (!user) return;

  const alreadyUnlocked = new Set((user.achievements || []).filter(a => a.unlockedAt).map(a => a.id));
  const newlyUnlocked: Achievement[] = [];

  const gainDollars = portfolio.totalGainLoss ?? 0;
  const transactions = portfolio.orders ?? [];
  const tradeCount = transactions.length;

  // Gather stock metadata for holdings
  const stockData = POPULAR_STOCKS.reduce((map, s) => { map[s.symbol] = s; return map; }, {} as Record<string, typeof POPULAR_STOCKS[0]>);
  const holdingStocks = portfolio.holdings.map(h => stockData[h.symbol]).filter(Boolean);

  // Count unique sectors and exchanges in current holdings
  const holdingSectors = new Set(holdingStocks.map(s => s.sector));
  const holdingExchanges = new Set(holdingStocks.map(s => s.exchange));

  // Check for international stocks (country !== 'US')
  const hasInternational = holdingStocks.some(s => s.country !== 'US');

  // Check for ETF holdings
  const hasETF = holdingStocks.some(s => s.sector === 'ETF');

  // Check for fractional shares in this trade
  const isFractional = tradeInfo.dollarAmount !== undefined && tradeInfo.dollarAmount > 0;

  // Check portfolio balance (no single stock > 30%)
  const totalValue = portfolio.totalValue || 1;
  const maxHoldingPct = Math.max(...portfolio.holdings.map(h => (h.currentValue / totalValue) * 100), 0);
  const isBalanced = portfolio.holdings.length >= 2 && maxHoldingPct <= 30;

  // Check for selling at a loss > 10%
  const soldAtLoss = tradeInfo.type === 'sell' && portfolio.holdings.some(h =>
    h.symbol === tradeInfo.symbol && h.gainLossPercent <= -10
  );

  // Gain percentage
  const startingBalance = portfolio.startingBalance || 1;
  const gainPercent = (gainDollars / startingBalance) * 100;

  // Buy orders for hold-time checks
  const now = Date.now();
  const filledBuys = transactions.filter(o => o.type === 'buy' && o.status === 'filled' && o.filledAt);

  // Check if any holding has been held 30+ days
  const has30DayHold = portfolio.holdings.some(h => {
    const firstBuy = filledBuys.find(o => o.symbol === h.symbol);
    return firstBuy?.filledAt && (now - firstBuy.filledAt) >= 30 * 24 * 60 * 60 * 1000;
  });

  // Check if a blue chip stock held 14+ days
  const BLUE_CHIPS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'JPM', 'V', 'BRK.B', 'KO', 'JNJ', 'PG', 'WMT'];
  const hasBlueChip14Days = portfolio.holdings.some(h => {
    if (!BLUE_CHIPS.includes(h.symbol)) return false;
    const firstBuy = filledBuys.find(o => o.symbol === h.symbol);
    return firstBuy?.filledAt && (now - firstBuy.filledAt) >= 14 * 24 * 60 * 60 * 1000;
  });

  for (const ach of ACHIEVEMENTS) {
    if (alreadyUnlocked.has(ach.id)) continue;

    let shouldUnlock = false;
    switch (ach.id) {
      case 'first_trade':
        shouldUnlock = true; // Any trade triggers this
        break;
      case 'etf_explorer':
        shouldUnlock = hasETF;
        break;
      case 'sector_scout':
        shouldUnlock = holdingSectors.size >= 3;
        break;
      case 'the_diversifier':
        shouldUnlock = portfolio.holdings.length >= 10;
        break;
      case 'global_nomad':
        shouldUnlock = hasInternational;
        break;
      case 'cross_exchange_pro':
        shouldUnlock = holdingExchanges.size >= 2;
        break;
      case 'steady_hands':
        shouldUnlock = has30DayHold;
        break;
      case 'fractional_fan':
        shouldUnlock = isFractional;
        break;
      case 'balanced_ledger':
        shouldUnlock = isBalanced;
        break;
      case 'growth_chaser':
        // Small-cap proxy: any non-blue-chip, non-ETF stock
        shouldUnlock = holdingStocks.some(s => !BLUE_CHIPS.includes(s.symbol) && s.sector !== 'ETF');
        break;
      case 'blue_chip_anchor':
        shouldUnlock = hasBlueChip14Days;
        break;
      case 'profit_milestone':
        shouldUnlock = gainPercent >= 10;
        break;
      case 'bite_the_bullet':
        shouldUnlock = soldAtLoss;
        break;
    }

    if (shouldUnlock) {
      const achievementData: Achievement = {
        ...ach,
        unlockedAt: Date.now(),
      };
      newlyUnlocked.push(achievementData);
      alreadyUnlocked.add(ach.id);
    }
  }

  if (newlyUnlocked.length === 0) return;

  // Merge with existing achievements in user state
  const existingAchs = user.achievements || [];
  const mergedAchs = [...existingAchs];
  let totalXpGained = 0;

  for (const ach of newlyUnlocked) {
    const idx = mergedAchs.findIndex(a => a.id === ach.id);
    if (idx >= 0) {
      mergedAchs[idx] = ach;
    } else {
      mergedAchs.push(ach);
    }
    totalXpGained += Math.round(ach.xpReward * getXPMultiplier());
  }

  const newXP = (user.xp || 0) + totalXpGained;
  const newLevel = getLevelFromXP(newXP);
  const updatedUser = { ...user, achievements: mergedAchs, xp: newXP, level: newLevel.level };

  // Update store immediately
  store.setUser(updatedUser);

  // Persist to auth service
  try {
    const { updateUser: authUpdateUser } = await import('./auth');
    await authUpdateUser(userId, { achievements: mergedAchs, xp: newXP, level: newLevel.level });
  } catch { /* non-critical */ }

  // Show achievement popup for the most important one (highest XP reward)
  const topAchievement = newlyUnlocked.reduce((best, a) => a.xpReward > best.xpReward ? a : best);
  store.setPendingAchievement(topAchievement);
}

// ─── Bling milestone awards ────────────────────────────────────────────────────

async function awardBlingForMilestones(currentGainDollars: number): Promise<void> {
  const store = useAppStore.getState();
  const claimed = store.claimedMilestones;

  // Check every $500 milestone from $500 up to current gain
  const maxMilestone = Math.floor(Math.max(0, currentGainDollars) / 500) * 500;

  for (let dollars = 500; dollars <= maxMilestone; dollars += 500) {
    if (claimed.includes(dollars)) continue;
    const reward = blingAtMilestone(dollars);
    if (reward > 0) {
      store.addBling(reward);
      store.addClaimedMilestone(dollars);
    }
  }
}

// ─── Pending Limit Order Monitor ──────────────────────────────────────────────

/**
 * Check all pending limit orders against current prices.
 * Called every 15 seconds alongside the price polling.
 * Auto-fills orders when price conditions are met.
 * Cancels orders if the player can no longer afford them.
 */
export async function checkPendingOrders(): Promise<void> {
  const store = useAppStore.getState();
  const { pendingOrders, user, portfolio } = store;
  if (!pendingOrders.length || !user || !portfolio) return;

  for (const order of pendingOrders) {
    if (order.status !== 'pending' || order.orderType !== 'limit' || !order.limitPrice) continue;

    try {
      const quote = await getQuote(order.symbol);
      const currentPrice = quote.price;
      if (!currentPrice) continue;

      // Check if limit condition is met
      const shouldFill =
        (order.type === 'buy' && currentPrice <= order.limitPrice) ||
        (order.type === 'sell' && currentPrice >= order.limitPrice);

      if (!shouldFill) continue;

      // Condition met — try to fill as a market order
      const result = await placeOrder({
        userId: order.userId,
        symbol: order.symbol,
        type: order.type,
        shares: order.shares,
        dollarAmount: order.dollarAmount,
        orderType: 'market', // Execute at market price now
        userName: user.displayName || user.username || 'Player',
        country: user.country || '',
      });

      // Remove from pending regardless of success
      store.removePendingOrder(order.id);

      if (result.success) {
        // Show success toast
        const Toast = require('react-native-toast-message').default;
        Toast.show({
          type: 'success',
          text1: `Limit Order Filled!`,
          text2: `${order.type === 'buy' ? 'Bought' : 'Sold'} ${(result.filledShares ?? 0).toFixed(4)} ${order.symbol} @ $${(result.filledPrice ?? 0).toFixed(2)}`,
        });
      } else {
        // Order couldn't fill (insufficient funds/shares) — cancel it
        const Toast = require('react-native-toast-message').default;
        Toast.show({
          type: 'error',
          text1: `Limit Order Cancelled`,
          text2: result.error || `Could not fill ${order.symbol} order.`,
        });
      }
    } catch {
      // Non-critical — will retry on next poll
    }
  }
}
