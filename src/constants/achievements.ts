import type { Achievement } from '../types';

export const ACHIEVEMENTS: Achievement[] = [
  // ─── Milestone achievements ───────────────────────────────────────────────
  {
    id: 'first_login',
    title: 'Beginner Trader',
    description: 'Welcome to CapitalQuest! You made your first login.',
    requirement: 'Log in to CapitalQuest for the first time.',
    icon: '🌱',
    category: 'milestone',
    xpReward: 50,
  },
  {
    id: 'first_trade',
    title: 'First Trade',
    description: 'You placed your very first trade!',
    requirement: 'Place your first buy or sell order on any stock.',
    icon: '📈',
    category: 'trading',
    xpReward: 100,
  },
  {
    id: 'gain_5',
    title: 'Getting Started',
    description: 'Earned your first $500 in profits.',
    requirement: 'Grow your total portfolio value by $500 above your starting balance.',
    icon: '💹',
    category: 'portfolio',
    xpReward: 150,
    target: 500,
  },
  {
    id: 'gain_10',
    title: 'On The Rise',
    description: 'Earned $1,000 in profits.',
    requirement: 'Grow your total portfolio value by $1,000 above your starting balance.',
    icon: '🚀',
    category: 'portfolio',
    xpReward: 250,
    target: 1000,
  },
  {
    id: 'gain_25',
    title: 'Seasoned Stock Broker',
    description: "You've earned $2,500 in profits!",
    requirement: 'Grow your total portfolio value by $2,500 above your starting balance.',
    icon: '🏆',
    category: 'portfolio',
    xpReward: 500,
    target: 2500,
  },
  {
    id: 'gain_50',
    title: 'Market Maestro',
    description: "Your portfolio is up $5,000. Incredible!",
    requirement: 'Grow your total portfolio value by $5,000 above your starting balance.',
    icon: '💰',
    category: 'portfolio',
    xpReward: 1000,
    target: 5000,
  },
  {
    id: 'gain_100',
    title: 'Doubled Up',
    description: "You've made $10,000 in profit. Wolf of Wall Street!",
    requirement: 'Reach $10,000 total gain above your starting balance.',
    icon: '🐺',
    category: 'portfolio',
    xpReward: 2500,
    target: 10000,
  },

  // ─── Trading achievements ─────────────────────────────────────────────────
  {
    id: 'trades_10',
    title: 'Active Trader',
    description: 'Completed 10 trades.',
    requirement: 'Complete a total of 10 buy or sell orders.',
    icon: '⚡',
    category: 'trading',
    xpReward: 200,
    target: 10,
  },
  {
    id: 'trades_50',
    title: 'Power Trader',
    description: 'Completed 50 trades.',
    requirement: 'Complete a total of 50 buy or sell orders.',
    icon: '🔥',
    category: 'trading',
    xpReward: 500,
    target: 50,
  },
  {
    id: 'trades_100',
    title: 'Day Trader',
    description: 'Completed 100 trades.',
    requirement: 'Complete a total of 100 buy or sell orders.',
    icon: '💎',
    category: 'trading',
    xpReward: 1000,
    target: 100,
  },
  {
    id: 'five_sectors',
    title: 'Diversified',
    description: 'Held stocks in 5 different sectors.',
    requirement: 'Hold positions in 5 different market sectors simultaneously.',
    icon: '🌐',
    category: 'portfolio',
    xpReward: 300,
    target: 5,
  },
  {
    id: 'international',
    title: 'Global Investor',
    description: 'Traded stocks on 3 different international exchanges.',
    requirement: 'Trade stocks listed on 3 different exchanges (e.g. NASDAQ, NYSE, LSE).',
    icon: '🌍',
    category: 'trading',
    xpReward: 400,
    target: 3,
  },
  {
    id: 'fractional',
    title: 'Penny Pusher',
    description: 'Made your first fractional share trade.',
    requirement: 'Buy a fractional (partial) share by entering a dollar amount instead of whole shares.',
    icon: '🪙',
    category: 'trading',
    xpReward: 75,
  },

  // ─── Social achievements ───────────────────────────────────────────────────
  {
    id: 'join_club',
    title: 'Team Player',
    description: 'Joined a trading club.',
    requirement: 'Find and join a trading club from the Social tab.',
    icon: '🤝',
    category: 'social',
    xpReward: 100,
  },
  {
    id: 'create_club',
    title: 'Founding Partner',
    description: 'Created your own trading club.',
    requirement: 'Create your own trading club from the Social tab.',
    icon: '🏢',
    category: 'social',
    xpReward: 200,
  },
  {
    id: 'top_10_leaderboard',
    title: 'Rising Star',
    description: 'Reached the top 10 on the global leaderboard.',
    requirement: 'Climb to a top-10 position on the global leaderboard.',
    icon: '⭐',
    category: 'milestone',
    xpReward: 750,
  },
  {
    id: 'top_1_leaderboard',
    title: 'Market King',
    description: '#1 on the global leaderboard!',
    requirement: 'Reach the #1 spot on the global leaderboard.',
    icon: '👑',
    category: 'milestone',
    xpReward: 2000,
  },

  // ─── Leaderboard achievements ─────────────────────────────────────────────
  {
    id: 'local_first',
    title: 'Local Leader',
    description: 'You topped your local leaderboard!',
    requirement: 'Finish in 1st place on your local leaderboard.',
    icon: '🥇',
    category: 'milestone',
    xpReward: 1000,
  },
  {
    id: 'local_second',
    title: "There's Always Next Time",
    description: "So close! You finished 2nd on your local leaderboard.",
    requirement: 'Finish in 2nd place on your local leaderboard.',
    icon: '🥈',
    category: 'milestone',
    xpReward: 500,
  },
  {
    id: 'local_third',
    title: '#3',
    description: 'You earned 3rd place on your local leaderboard.',
    requirement: 'Finish in 3rd place on your local leaderboard.',
    icon: '🥉',
    category: 'milestone',
    xpReward: 250,
  },
  {
    id: 'global_first',
    title: 'World Champion',
    description: 'You are the #1 trader in the world!',
    requirement: 'Finish in 1st place on the global leaderboard.',
    icon: '🌍',
    category: 'milestone',
    xpReward: 5000,
  },
  {
    id: 'global_second',
    title: 'So Close',
    description: 'You finished 2nd on the global leaderboard. Almost at the top!',
    requirement: 'Finish in 2nd place on the global leaderboard.',
    icon: '🌟',
    category: 'milestone',
    xpReward: 3000,
  },
  {
    id: 'global_third',
    title: 'Bronze Warrior',
    description: 'You finished 3rd on the global leaderboard. A podium finish!',
    requirement: 'Finish in 3rd place on the global leaderboard.',
    icon: '🎖️',
    category: 'milestone',
    xpReward: 2000,
  },
  {
    id: 'global_last',
    title: 'You Snooze You Lose',
    description: 'Finished last on the global leaderboard. Time to step it up!',
    requirement: 'Finish in last place on the global leaderboard.',
    icon: '😴',
    category: 'milestone',
    xpReward: 50,
  },

  // ─── Streak achievements ───────────────────────────────────────────────────
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: '7 consecutive days active.',
    requirement: 'Open the app and trade for 7 consecutive days in a row.',
    icon: '🗓️',
    category: 'streak',
    xpReward: 150,
    target: 7,
  },
  {
    id: 'streak_30',
    title: 'Monthly Investor',
    description: '30 consecutive days active.',
    requirement: 'Open the app and trade for 30 consecutive days in a row.',
    icon: '📅',
    category: 'streak',
    xpReward: 600,
    target: 30,
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
