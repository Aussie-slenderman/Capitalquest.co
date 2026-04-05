import type { Achievement } from '../types';

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_login',
    title: 'Beginner Trader',
    description: 'Welcome to CapitalQuest! You made your first login.',
    requirement: 'Log into Capital Quest for the first time.',
    icon: '🌱',
    category: 'milestone',
    xpReward: 100,
  },
  {
    id: 'first_trade',
    title: 'First Trade',
    description: 'You placed your very first trade!',
    requirement: 'Place your very first trade.',
    icon: '📈',
    category: 'trading',
    xpReward: 100,
  },
  {
    id: 'etf_explorer',
    title: 'ETF Explorer',
    description: 'Purchased shares in an Exchange Traded Fund.',
    requirement: 'Purchase shares in an Exchange Traded Fund to learn about broad market exposure.',
    icon: '📊',
    category: 'trading',
    xpReward: 300,
  },
  {
    id: 'sector_scout',
    title: 'Sector Scout',
    description: 'Own stocks in three different sectors.',
    requirement: 'Own stocks in three different sectors (e.g., Tech, Energy, Healthcare).',
    icon: '🔍',
    category: 'portfolio',
    xpReward: 300,
    target: 3,
  },
  {
    id: 'the_diversifier',
    title: 'The Diversifier',
    description: 'Built a portfolio with at least 10 different assets.',
    requirement: 'Build a portfolio containing at least 10 different assets to reduce risk.',
    icon: '🌐',
    category: 'portfolio',
    xpReward: 500,
    target: 10,
  },
  {
    id: 'global_nomad',
    title: 'Global Nomad',
    description: 'Bought an international stock outside the US.',
    requirement: 'Buy an international stock from an exchange outside the United States.',
    icon: '🌍',
    category: 'trading',
    xpReward: 450,
  },
  {
    id: 'cross_exchange_pro',
    title: 'Cross-Exchange Pro',
    description: 'Own stocks on at least two different exchanges.',
    requirement: 'Own stocks listed on at least two different exchanges (e.g., NYSE and NASDAQ).',
    icon: '🔄',
    category: 'trading',
    xpReward: 400,
    target: 2,
  },
  {
    id: 'steady_hands',
    title: 'Steady Hands',
    description: 'Held a single stock for more than 30 days.',
    requirement: 'Hold a single stock position for more than 30 days without selling.',
    icon: '🤲',
    category: 'portfolio',
    xpReward: 600,
    target: 30,
  },
  {
    id: 'income_stream',
    title: 'Income Stream',
    description: 'Purchased a stock that pays more than 5% dividend.',
    requirement: 'Purchase a stock that pays more than 5% dividend to understand passive yield.',
    icon: '💰',
    category: 'trading',
    xpReward: 350,
  },
  {
    id: 'watchlist_wizard',
    title: 'Watchlist Wizard',
    description: 'Added 10 companies to your Watchlist.',
    requirement: 'Add 10 companies to your Watchlist to track their performance before buying.',
    icon: '👀',
    category: 'milestone',
    xpReward: 150,
    target: 10,
  },
  {
    id: 'deep_researcher',
    title: 'Deep Researcher',
    description: 'Read three news articles linked to stocks in your portfolio.',
    requirement: 'Open and read three different news articles linked to a stock in your portfolio.',
    icon: '📰',
    category: 'milestone',
    xpReward: 200,
    target: 3,
  },
  {
    id: 'market_resilience',
    title: 'Market Resilience',
    description: 'Kept your portfolio active after a major market drop.',
    requirement: 'Keep your portfolio active after a day where the market drops more than 2%.',
    icon: '💪',
    category: 'portfolio',
    xpReward: 500,
  },
  {
    id: 'balanced_ledger',
    title: 'Balanced Ledger',
    description: 'No single stock accounts for more than 30% of your portfolio.',
    requirement: 'Adjust your position sizes so that no one stock accounts for more than 30% of your total portfolio.',
    icon: '⚖️',
    category: 'portfolio',
    xpReward: 400,
  },
  {
    id: 'fractional_fan',
    title: 'Fractional Fan',
    description: 'Bought a fractional share of a high-priced stock.',
    requirement: 'Buy a fractional share of a high-priced stock (like Berkshire Hathaway).',
    icon: '🪙',
    category: 'trading',
    xpReward: 150,
  },
  {
    id: 'growth_chaser',
    title: 'Growth Chaser',
    description: 'Invested in a small-cap company.',
    requirement: 'Invest in a company with a market cap under $2 billion.',
    icon: '🚀',
    category: 'trading',
    xpReward: 300,
  },
  {
    id: 'blue_chip_anchor',
    title: 'Blue Chip Anchor',
    description: 'Held a Blue Chip stock for 14 days.',
    requirement: 'Own a "Blue Chip" stock (a massive, stable industry leader) for 14 days.',
    icon: '🏛️',
    category: 'portfolio',
    xpReward: 250,
    target: 14,
  },
  {
    id: 'profit_milestone',
    title: 'Profit Milestone',
    description: 'Reached a total portfolio gain of 10%.',
    requirement: 'Reach a total portfolio gain of 10% from your initial starting balance.',
    icon: '📈',
    category: 'portfolio',
    xpReward: 500,
  },
  {
    id: 'recovery',
    title: 'Recovery',
    description: 'Your portfolio grew 10% after a 10% fall.',
    requirement: 'Your portfolio grows by 10% after a fall of 10%.',
    icon: '🔄',
    category: 'portfolio',
    xpReward: 500,
  },
  {
    id: 'bite_the_bullet',
    title: 'Bite the Bullet',
    description: 'Sold a stock at a loss of more than 10%.',
    requirement: 'Sell a stock that has decreased in value by more than 10% from when you bought it.',
    icon: '😤',
    category: 'trading',
    xpReward: 200,
  },
];

// Level system: exactly 1 level up per $500 portfolio gain.
// Level N requires (N−1) × XP_PER_5_PERCENT XP.
// XP_PER_5_PERCENT = 100, so Level 2 at 100 XP (+$500), Level 3 at 200 XP (+$1,000), etc.
export const XP_PER_5_PERCENT = 100;

export const LEVELS = [
  { level: 1,  title: 'Beginner Trader',    xpRequired: 0,     icon: '🌱', color: '#94A3B8' },
  { level: 2,  title: 'Novice Investor',    xpRequired: 3000,  icon: '📊', color: '#60A5FA' },
  { level: 3,  title: 'Apprentice Trader',  xpRequired: 6000,  icon: '📈', color: '#34D399' },
  { level: 4,  title: 'Trader',             xpRequired: 9000,  icon: '💼', color: '#F59E0B' },
  { level: 5,  title: 'Senior Trader',      xpRequired: 12000, icon: '⚡', color: '#F97316' },
  { level: 6,  title: 'Portfolio Manager',  xpRequired: 15000, icon: '🔥', color: '#EF4444' },
  { level: 7,  title: 'Market Analyst',     xpRequired: 18000, icon: '🎯', color: '#8B5CF6' },
  { level: 8,  title: 'Hedge Fund Manager', xpRequired: 21000, icon: '💎', color: '#EC4899' },
  { level: 9,  title: 'Market Legend',      xpRequired: 24000, icon: '🏆', color: '#F5C518' },
  { level: 10, title: 'Wolf of Wall Street',xpRequired: 27000, icon: '🐺', color: '#00D4AA' },
];

export function getLevelFromXP(xp: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl;
    else break;
  }
  return current;
}

export function getXPProgress(xp: number) {
  const current = getLevelFromXP(xp);
  const nextLevel = LEVELS.find(l => l.level === current.level + 1);
  if (!nextLevel) return { current, nextLevel: null, progress: 1, xpInLevel: 0, xpNeeded: 0 };
  const xpInLevel = xp - current.xpRequired;
  const xpNeeded = nextLevel.xpRequired - current.xpRequired;
  return {
    current,
    nextLevel,
    progress: xpInLevel / xpNeeded,
    xpInLevel,
    xpNeeded,
  };
}
