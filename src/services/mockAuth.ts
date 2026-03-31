/**
 * Mock Auth & Database — used when Firebase is not yet configured.
 *
 * Cross-platform storage: uses localStorage on web, in-memory on native.
 * Portfolio listeners are reactive — they fire whenever data changes.
 */

// ─── Cross-platform storage ───────────────────────────────────────────────────
// In-memory fallback for React Native (localStorage is web-only)
const memStore = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch { /* native — fall through */ }
  return memStore.get(key) ?? null;
}

function storageSet(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined') { localStorage.setItem(key, value); return; }
  } catch { /* native — fall through */ }
  memStore.set(key, value);
}

function storageRemove(key: string) {
  try {
    if (typeof localStorage !== 'undefined') { localStorage.removeItem(key); return; }
  } catch { /* native — fall through */ }
  memStore.delete(key);
}

// ─── Mini "database" helpers ──────────────────────────────────────────────────

const STORE_KEY = 'capitalquest_mock_db';

function loadDB(): Record<string, unknown> {
  try { return JSON.parse(storageGet(STORE_KEY) || '{}'); }
  catch { return {}; }
}

function saveDB(db: Record<string, unknown>) {
  storageSet(STORE_KEY, JSON.stringify(db));
}

function getCollection(name: string): Record<string, unknown> {
  return (loadDB()[name] as Record<string, unknown>) || {};
}

function setDocument(collection: string, id: string, data: unknown) {
  const db = loadDB();
  if (!db[collection]) db[collection] = {};
  (db[collection] as Record<string, unknown>)[id] = data;
  saveDB(db);
}

function getDocument(collection: string, id: string): unknown {
  return getCollection(collection)[id] ?? null;
}

// ─── Reactive listener registry ───────────────────────────────────────────────
// Lets components react to portfolio changes without Firebase's onSnapshot.

type Listener = (data: unknown) => void;
const portfolioListeners = new Map<string, Set<Listener>>();
const userListeners = new Map<string, Set<Listener>>();

function notifyPortfolioListeners(userId: string, data: unknown) {
  portfolioListeners.get(userId)?.forEach(fn => fn(data));
}
function notifyUserListeners(userId: string, data: unknown) {
  userListeners.get(userId)?.forEach(fn => fn(data));
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

let authListeners: Listener[] = [];
let currentUser: unknown = null;

function notifyAuth() { authListeners.forEach(fn => fn(currentUser)); }

export function mockOnAuthChange(callback: Listener) {
  authListeners.push(callback);
  const session = storageGet('capitalquest_session');
  if (session) {
    try { currentUser = JSON.parse(session); } catch { currentUser = null; }
    setTimeout(() => callback(currentUser), 50);
  } else {
    setTimeout(() => callback(null), 50);
  }
  return () => { authListeners = authListeners.filter(fn => fn !== callback); };
}

export async function mockRegister(
  username: string,
  _password: string,
  displayName: string,
  country: string
) {
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const email = `${uniqueId}@capitalquest.app`;
  const users = getCollection('users') as Record<string, unknown>;

  // Usernames can be reused — no uniqueness check needed

  const uid = `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const accountNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

  const userData = {
    id: uid, username, displayName, email, accountNumber,
    level: 1, xp: 0, achievements: [], badges: [],
    clubIds: [], friendIds: [], country,
    createdAt: Date.now(), lastActive: Date.now(),
    onboardingComplete: false, startingBalance: 0,
    avatarConfig: null,
  };

  setDocument('users', uid, userData);
  const session = { uid, email, displayName };
  storageSet('capitalquest_session', JSON.stringify(session));
  currentUser = session;
  notifyAuth();
  return { user: session, userData };
}

export async function mockLogin(email: string, _password: string) {
  const users = getCollection('users') as Record<string, unknown>;
  const user = Object.values(users).find(
    (u: unknown) => (u as Record<string, string>).email === email
  ) as Record<string, string> | undefined;

  if (!user) throw new Error('No account found with this email address.');

  const session = { uid: user.id, email: user.email, displayName: user.displayName };
  storageSet('capitalquest_session', JSON.stringify(session));
  currentUser = session;
  notifyAuth();
  return session;
}

export async function mockSignOut() {
  storageRemove('capitalquest_session');
  currentUser = null;
  notifyAuth();
}

export async function mockDeleteAccount(userId: string) {
  // Remove user + their portfolio/transactions/leaderboard data
  const db = loadDB();
  if (db['users']) delete (db['users'] as Record<string, unknown>)[userId];
  if (db['portfolios']) delete (db['portfolios'] as Record<string, unknown>)[userId];
  if (db['leaderboard']) delete (db['leaderboard'] as Record<string, unknown>)[userId];
  saveDB(db);
  storageRemove('capitalquest_session');
  currentUser = null;
  notifyAuth();
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export async function mockGetUser(userId: string) {
  return getDocument('users', userId) ?? null;
}

export async function mockUpdateUser(userId: string, data: Record<string, unknown>) {
  const existing = (getDocument('users', userId) as Record<string, unknown>) || {};
  const updated = { ...existing, ...data };
  setDocument('users', userId, updated);
  notifyUserListeners(userId, updated);
}

export function mockListenToUser(userId: string, callback: Listener) {
  if (!userListeners.has(userId)) userListeners.set(userId, new Set());
  userListeners.get(userId)!.add(callback);
  const data = getDocument('users', userId);
  setTimeout(() => callback(data), 20);
  return () => { userListeners.get(userId)?.delete(callback); };
}

// ─── Portfolio helpers ────────────────────────────────────────────────────────

export async function mockInitPortfolio(userId: string, startingBalance: number) {
  const portfolio = {
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
  setDocument('portfolios', userId, portfolio);
  notifyPortfolioListeners(userId, portfolio);

  const user = (getDocument('users', userId) as Record<string, unknown>) || {};
  const updatedUser = { ...user, startingBalance, onboardingComplete: true };
  setDocument('users', userId, updatedUser);
  notifyUserListeners(userId, updatedUser);

  return portfolio;
}

export async function mockGetPortfolio(userId: string) {
  return getDocument('portfolios', userId) ?? null;
}

export function mockListenToPortfolio(userId: string, callback: Listener) {
  // Register as a reactive listener (fires on every update)
  if (!portfolioListeners.has(userId)) portfolioListeners.set(userId, new Set());
  portfolioListeners.get(userId)!.add(callback);

  // Fire initial data immediately
  const data = getDocument('portfolios', userId);
  setTimeout(() => callback(data), 20);

  return () => { portfolioListeners.get(userId)?.delete(callback); };
}

export async function mockUpdatePortfolio(userId: string, data: Record<string, unknown>) {
  const existing = (getDocument('portfolios', userId) as Record<string, unknown>) || {};
  const updated = { ...existing, ...data };
  setDocument('portfolios', userId, updated);
  // 🔑 Notify all active portfolio listeners → triggers Zustand setPortfolio → UI refreshes
  notifyPortfolioListeners(userId, updated);
}

// ─── Transaction helpers ──────────────────────────────────────────────────────

export async function mockAddTransaction(
  userId: string,
  transaction: Record<string, unknown>
) {
  const id = `tx_${Date.now()}`;
  setDocument('transactions', id, { id, userId, ...transaction });
  return id;
}

export async function mockGetTransactions(userId: string) {
  const all = getCollection('transactions') as Record<string, unknown>;
  return Object.values(all)
    .filter((t: unknown) => (t as Record<string, string>).userId === userId)
    .sort((a: unknown, b: unknown) =>
      ((b as Record<string, number>).timestamp || 0) -
      ((a as Record<string, number>).timestamp || 0)
    )
    .slice(0, 50);
}

// ─── Leaderboard helpers ──────────────────────────────────────────────────────

export async function mockGetLeaderboard() {
  const all = getCollection('leaderboard') as Record<string, unknown>;
  return Object.values(all)
    .sort((a: unknown, b: unknown) =>
      ((b as Record<string, number>).gainDollars || 0) -
      ((a as Record<string, number>).gainDollars || 0)
    )
    .map((e: unknown, i: number) => ({ rank: i + 1, ...(e as object) }));
}

export async function mockUpdateLeaderboard(userId: string, data: Record<string, unknown>) {
  setDocument('leaderboard', userId, data);
}

// ─── Chat helpers ─────────────────────────────────────────────────────────────

export async function mockSendMessage(roomId: string, message: Record<string, unknown>) {
  const id = `msg_${Date.now()}`;
  setDocument(`messages_${roomId}`, id, { id, ...message });
  const room = (getDocument('chatRooms', roomId) as Record<string, unknown>) || {};
  setDocument('chatRooms', roomId, { ...room, lastMessage: message, updatedAt: Date.now() });
  return id;
}

export function mockListenToMessages(
  roomId: string,
  callback: (messages: unknown[]) => void
) {
  const msgs = Object.values(getCollection(`messages_${roomId}`) as Record<string, unknown>);
  setTimeout(() => callback(msgs), 20);
  return () => {};
}

export function mockListenToChatRooms(userId: string, callback: (rooms: unknown[]) => void) {
  const all = getCollection('chatRooms') as Record<string, unknown>;
  const rooms = Object.values(all).filter((r: unknown) =>
    ((r as Record<string, string[]>).participantIds || []).includes(userId)
  );
  setTimeout(() => callback(rooms), 20);
  return () => {};
}

export function mockListenToTradeProposals(
  _userId: string,
  callback: (proposals: unknown[]) => void
) {
  setTimeout(() => callback([]), 20);
  return () => {};
}
