import { create } from 'zustand';
import type {
  User, Portfolio, Stock, StockQuote,
  ChatRoom, AppNotification, LeaderboardEntry, Achievement, Club, ClubInvite,
} from '../types';

interface AppState {
  // Auth
  user: User | null;
  isAuthLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthLoading: (v: boolean) => void;
  resetUserData: () => void;

  // Achievement toast
  pendingAchievement: Achievement | null;
  setPendingAchievement: (a: Achievement | null) => void;

  // Portfolio
  portfolio: Portfolio | null;
  setPortfolio: (p: Portfolio | null) => void;
  updatePortfolioField: (updates: Partial<Portfolio>) => void;

  // Market data
  quotes: Record<string, StockQuote>;
  setQuote: (symbol: string, quote: StockQuote) => void;
  setQuotes: (quotes: Record<string, StockQuote>) => void;

  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;

  // UI state
  selectedStock: Stock | null;
  setSelectedStock: (stock: Stock | null) => void;

  activeTab: string;
  setActiveTab: (tab: string) => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // Clubs (persisted in store so they survive tab remounts)
  myClubs: Club[];
  setMyClubs: (clubs: Club[] | ((prev: Club[]) => Club[])) => void;
  addMyClub: (club: Club) => void;

  // Chat
  chatRooms: ChatRoom[];
  setChatRooms: (rooms: ChatRoom[]) => void;
  unreadCount: number;
  setUnreadCount: (n: number) => void;

  // Notifications
  notifications: AppNotification[];
  addNotification: (n: AppNotification) => void;
  markAllRead: () => void;

  // Club invites (pending invites the current user has received)
  clubInvites: ClubInvite[];
  addClubInvite: (invite: ClubInvite) => void;
  removeClubInvite: (id: string) => void;

  // Leaderboard cache
  globalLeaderboard: LeaderboardEntry[];
  setGlobalLeaderboard: (entries: LeaderboardEntry[]) => void;
  localLeaderboard: LeaderboardEntry[];
  setLocalLeaderboard: (entries: LeaderboardEntry[]) => void;

  // App Theme Settings
  appColorMode: 'dark' | 'light';
  setAppColorMode: (mode: 'dark' | 'light') => void;
  appAccentColor: string;
  setAppAccentColor: (color: string) => void;
  appTileStyle: 'default' | 'vivid' | 'glass';
  setAppTileStyle: (style: 'default' | 'vivid' | 'glass') => void;
  appTabColors: Record<string, string>; // tabName → custom color
  setAppTabColor: (tab: string, color: string) => void;

  // One-time welcome popup (shown once after account creation)
  showWelcomePopup: boolean;
  setShowWelcomePopup: (v: boolean) => void;

  // News read tracking
  newsLastRead: number;
  setNewsLastRead: (ts: number) => void;

}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  isAuthLoading: true,
  setUser: (user) => set({ user }),
  setAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  resetUserData: () => set({
    portfolio: null,
    quotes: {},
    myClubs: [],
    chatRooms: [],
    unreadCount: 0,
    notifications: [],
    clubInvites: [],
    globalLeaderboard: [],
    localLeaderboard: [],
    selectedStock: null,
    pendingAchievement: null,
  }),

  // Achievement toast
  pendingAchievement: null,
  setPendingAchievement: (pendingAchievement) => set({ pendingAchievement }),

  // Portfolio
  portfolio: null,
  setPortfolio: (portfolio) => set({ portfolio }),
  updatePortfolioField: (updates) =>
    set((state) => ({
      portfolio: state.portfolio ? { ...state.portfolio, ...updates } : null,
    })),

  // Quotes
  quotes: {},
  setQuote: (symbol, quote) =>
    set((state) => ({ quotes: { ...state.quotes, [symbol]: quote } })),
  setQuotes: (quotes) =>
    set((state) => ({ quotes: { ...state.quotes, ...quotes } })),

  // Watchlist
  watchlist: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
  addToWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.includes(symbol)
        ? state.watchlist
        : [...state.watchlist, symbol],
    })),
  removeFromWatchlist: (symbol) =>
    set((state) => ({
      watchlist: state.watchlist.filter(s => s !== symbol),
    })),

  // UI
  selectedStock: null,
  setSelectedStock: (selectedStock) => set({ selectedStock }),

  activeTab: 'home',
  setActiveTab: (activeTab) => set({ activeTab }),

  isSidebarOpen: false,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  // Clubs
  myClubs: [],
  setMyClubs: (clubs) =>
    set((state) => ({
      myClubs: typeof clubs === 'function' ? clubs(state.myClubs) : clubs,
    })),
  addMyClub: (club) =>
    set((state) => ({
      myClubs: state.myClubs.some(c => c.id === club.id)
        ? state.myClubs
        : [club, ...state.myClubs],
    })),

  // Chat
  chatRooms: [],
  setChatRooms: (chatRooms) => set({ chatRooms }),
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),

  // Notifications
  notifications: [],
  addNotification: (n) =>
    set((state) => ({ notifications: [n, ...state.notifications] })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
    })),

  // Club invites
  clubInvites: [],
  addClubInvite: (invite) =>
    set((state) => ({
      clubInvites: state.clubInvites.some(i => i.id === invite.id)
        ? state.clubInvites
        : [invite, ...state.clubInvites],
    })),
  removeClubInvite: (id) =>
    set((state) => ({
      clubInvites: state.clubInvites.filter(i => i.id !== id),
    })),

  // Leaderboard
  globalLeaderboard: [],
  setGlobalLeaderboard: (globalLeaderboard) => set({ globalLeaderboard }),
  localLeaderboard: [],
  setLocalLeaderboard: (localLeaderboard) => set({ localLeaderboard }),

  // App Theme Settings
  appColorMode: 'dark',
  setAppColorMode: (appColorMode) => set({ appColorMode }),
  appAccentColor: '#00B3E6',
  setAppAccentColor: (appAccentColor) => set({ appAccentColor }),
  appTileStyle: 'default',
  setAppTileStyle: (appTileStyle) => set({ appTileStyle }),
  appTabColors: {
    home: '#00B3E6',
    leaderboard: '#F5C518',
    social: '#EC4899',
    advisor: '#00D4AA',
    trade: '#00C853',
    profile: '#7C3AED',
  },
  setAppTabColor: (tab, color) =>
    set((state) => ({
      appTabColors: { ...state.appTabColors, [tab]: color },
    })),

  // Welcome popup
  showWelcomePopup: false,
  setShowWelcomePopup: (showWelcomePopup) => set({ showWelcomePopup }),

  // News read tracking
  newsLastRead: 0,
  setNewsLastRead: (newsLastRead) => set({ newsLastRead }),

}));
