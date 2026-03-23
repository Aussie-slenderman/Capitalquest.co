// ─── Stock & Market Types ───────────────────────────────────────────────────

export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high52w: number;
  low52w: number;
  pe?: number;
  eps?: number;
  dividend?: number;
  sector?: string;
  industry?: string;
  description?: string;
  logoUrl?: string;
  isOpen: boolean;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ChartPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y';

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  country: string;
}

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: number;
  relatedSymbols: string[];
}

// ─── Portfolio & Trading Types ───────────────────────────────────────────────

export interface Holding {
  symbol: string;
  shares: number;       // can be fractional
  avgCostBasis: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  gainLoss: number;
  gainLossPercent: number;
  stock?: Stock;
}

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop';
  shares?: number;
  dollarAmount?: number; // fractional dollar-based
  limitPrice?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledAt?: number;
  filledPrice?: number;
  filledShares?: number;
  createdAt: number;
}

export interface Portfolio {
  userId: string;
  cashBalance: number;
  startingBalance: number;
  totalValue: number;
  investedValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdings: Holding[];
  orders: Order[];
  createdAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  symbol: string;
  type: 'buy' | 'sell' | 'dividend';
  shares: number;
  price: number;
  total: number;
  timestamp: number;
  note?: string;
}

// ─── User & Auth Types ───────────────────────────────────────────────────────

export interface AvatarConfig {
  animal: string; // emoji e.g. '🐶'
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  accountNumber: string; // 8-digit unique
  bio?: string;
  level: number;
  xp: number;
  achievements: Achievement[];
  badges: Badge[];
  portfolio?: Portfolio;
  clubIds: string[];
  friendIds: string[];
  createdAt: number;
  lastActive: number;
  country: string;
  onboardingComplete: boolean;
  startingBalance: number;
  welcomeShown?: boolean;
  avatarConfig?: AvatarConfig;
}

// ─── Gamification Types ──────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  requirement?: string;
  icon: string;
  category: AchievementCategory;
  xpReward: number;
  unlockedAt?: number;
  progress?: number;
  target?: number;
}

export type AchievementCategory =
  | 'trading'
  | 'portfolio'
  | 'social'
  | 'milestone'
  | 'streak';

export interface Badge {
  id: string;
  title: string;
  icon: string;
  color: string;
}

export interface Level {
  level: number;
  title: string;
  xpRequired: number;
  xpToNext: number;
  icon: string;
  color: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  startingBalance: number;
  currentValue: number;
  gainDollars: number;
  level: number;
  country: string;
  isCurrentUser?: boolean;
}

export type LeaderboardType = 'global' | 'local' | 'club' | 'friends';

// ─── Social Types ─────────────────────────────────────────────────────────────

export interface Club {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  ownerId: string;
  memberIds: string[];
  isPublic: boolean;
  createdAt: number;
  portfolioValue?: number; // combined value
  chatRoomId: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: number;
  type: 'text' | 'trade_proposal' | 'stock_share' | 'achievement';
  metadata?: Record<string, unknown>;
}

export interface ChatRoom {
  id: string;
  type: 'dm' | 'club' | 'group';
  name?: string;
  participantIds: string[];
  lastMessage?: Message;
  updatedAt: number;
}

export interface TradeProposal {
  id: string;
  fromUserId: string;
  toUserId: string;
  symbol: string;
  type: 'buy' | 'sell';
  shares: number;
  pricePerShare: number;
  total: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: number;
  createdAt: number;
  note?: string;
}

export interface Meeting {
  id: string;
  clubId: string;
  title: string;
  scheduledAt: number;
  hostId: string;
  participantIds: string[];
  status: 'scheduled' | 'live' | 'ended';
  agenda?: string;
}

// ─── App State Types ──────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type:
    | 'trade_filled'
    | 'price_alert'
    | 'achievement'
    | 'friend_request'
    | 'trade_proposal'
    | 'club_invite'
    | 'meeting';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: number;
}

export interface ClubInvite {
  id: string;
  type: 'club_invite' | 'friend_request';
  clubId?: string;
  clubName?: string;
  fromUserId: string;
  fromUsername: string;
  sentAt: number;
}

export type Theme = 'dark' | 'light';
