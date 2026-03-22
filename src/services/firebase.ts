import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  getDocs,
  serverTimestamp,
  increment,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  getDatabase,
  ref,
  onValue,
  off,
  set,
  push,
  serverTimestamp as rtServerTimestamp,
} from 'firebase/database';

// ─── Firebase Config ──────────────────────────────────────────────────────────
// Replace these with your Firebase project credentials
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Detect if Firebase has real credentials or is still using placeholders
export const IS_MOCK_FIREBASE = firebaseConfig.apiKey === 'YOUR_API_KEY';

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  username: string,
  displayName: string,
  country: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // Generate unique 8-digit account number
  const accountNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

  const userData = {
    id: cred.user.uid,
    username,
    displayName,
    email,
    accountNumber,
    level: 1,
    xp: 0,
    achievements: [],
    badges: [],
    clubIds: [],
    friendIds: [],
    country,
    createdAt: Date.now(),
    lastActive: Date.now(),
    onboardingComplete: false,
    startingBalance: 0,
  };

  await setDoc(doc(db, 'users', cred.user.uid), userData);
  return { user: cred.user, userData };
}

export async function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── User Helpers ─────────────────────────────────────────────────────────────

export async function getUserById(userId: string) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? snap.data() : null;
}

export async function updateUser(userId: string, data: Partial<Record<string, unknown>>) {
  return updateDoc(doc(db, 'users', userId), data);
}

export function listenToUser(userId: string, callback: (data: unknown) => void) {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export async function findUserByAccountNumber(accountNumber: string) {
  const q = query(
    collection(db, 'users'),
    where('accountNumber', '==', accountNumber),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

export async function searchUsers(searchTerm: string) {
  const q = query(
    collection(db, 'users'),
    where('username', '>=', searchTerm),
    where('username', '<=', searchTerm + '\uf8ff'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// ─── Portfolio Helpers ────────────────────────────────────────────────────────

export async function initPortfolio(userId: string, startingBalance: number) {
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
  await setDoc(doc(db, 'portfolios', userId), portfolio);
  await updateDoc(doc(db, 'users', userId), {
    startingBalance,
    onboardingComplete: true,
  });
  return portfolio;
}

export async function getPortfolio(userId: string) {
  const snap = await getDoc(doc(db, 'portfolios', userId));
  return snap.exists() ? snap.data() : null;
}

export function listenToPortfolio(userId: string, callback: (data: unknown) => void) {
  return onSnapshot(doc(db, 'portfolios', userId), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export async function updatePortfolio(userId: string, data: Partial<Record<string, unknown>>) {
  return updateDoc(doc(db, 'portfolios', userId), data);
}

// ─── Portfolio History Snapshot ───────────────────────────────────────────────
// Called after every trade. Stores today's portfolio value so the weekly
// email script can build a 7-day line chart.

export async function savePortfolioSnapshot(
  userId: string,
  totalValue: number,
  cashBalance: number,
  totalGainLoss: number,
  totalGainLossPercent: number,
): Promise<void> {
  if (IS_MOCK_FIREBASE) return;
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  try {
    await setDoc(
      doc(db, 'portfolioHistory', userId, 'snapshots', today),
      { totalValue, cashBalance, totalGainLoss, totalGainLossPercent, date: today, updatedAt: Date.now() },
      { merge: true },
    );
  } catch {
    // Non-critical — don't block the trade
  }
}

// ─── Transaction Helpers ──────────────────────────────────────────────────────

export async function addTransaction(
  userId: string,
  transaction: Omit<import('../types').Transaction, 'id'>
) {
  const ref_ = await addDoc(collection(db, 'transactions'), {
    ...transaction,
    userId,
  });
  return ref_.id;
}

export async function getTransactions(userId: string, limitCount = 50) {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(type: 'global' | 'local', country?: string, limitCount = 100) {
  let q;
  if (type === 'local' && country) {
    q = query(
      collection(db, 'leaderboard'),
      where('country', '==', country),
      orderBy('gainDollars', 'desc'),
      limit(limitCount)
    );
  } else {
    q = query(
      collection(db, 'leaderboard'),
      orderBy('gainDollars', 'desc'),
      limit(limitCount)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() }));
}

export async function updateLeaderboardEntry(userId: string, data: Record<string, unknown>) {
  return setDoc(doc(db, 'leaderboard', userId), data, { merge: true });
}

// ─── Clubs ────────────────────────────────────────────────────────────────────

export async function createClub(
  ownerId: string,
  name: string,
  description: string,
  isPublic: boolean
) {
  const clubRef = doc(collection(db, 'clubs'));
  const chatRoomRef = doc(collection(db, 'chatRooms'));

  const club = {
    id: clubRef.id,
    name,
    description,
    ownerId,
    memberIds: [ownerId],
    isPublic,
    createdAt: Date.now(),
    chatRoomId: chatRoomRef.id,
  };

  const chatRoom = {
    id: chatRoomRef.id,
    type: 'club',
    name,
    participantIds: [ownerId],
    updatedAt: Date.now(),
  };

  const batch = writeBatch(db);
  batch.set(clubRef, club);
  batch.set(chatRoomRef, chatRoom);
  batch.update(doc(db, 'users', ownerId), {
    clubIds: [clubRef.id],
  });
  await batch.commit();

  return club;
}

export async function joinClub(userId: string, clubId: string) {
  const clubRef = doc(db, 'clubs', clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error('Club not found');
  const club = clubSnap.data();

  const batch = writeBatch(db);
  batch.update(clubRef, { memberIds: [...(club.memberIds || []), userId] });
  batch.update(doc(db, 'users', userId), { clubIds: [clubId] });
  batch.update(doc(db, 'chatRooms', club.chatRoomId), {
    participantIds: [...(club.memberIds || []), userId],
  });
  await batch.commit();
}

export async function getPublicClubs(limitCount = 50) {
  const q = query(
    collection(db, 'clubs'),
    where('isPublic', '==', true),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function createDMRoom(userId1: string, userId2: string) {
  // Check if DM already exists
  const q = query(
    collection(db, 'chatRooms'),
    where('type', '==', 'dm'),
    where('participantIds', 'array-contains', userId1)
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find(d => {
    const data = d.data();
    return data.participantIds.includes(userId2);
  });
  if (existing) return { id: existing.id, ...existing.data() };

  const roomRef = doc(collection(db, 'chatRooms'));
  const room = {
    id: roomRef.id,
    type: 'dm',
    participantIds: [userId1, userId2],
    updatedAt: Date.now(),
  };
  await setDoc(roomRef, room);
  return room;
}

export function listenToMessages(
  roomId: string,
  callback: (messages: unknown[]) => void
) {
  const q = query(
    collection(db, 'chatRooms', roomId, 'messages'),
    orderBy('timestamp', 'asc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function sendMessage(
  roomId: string,
  message: Omit<import('../types').Message, 'id'>
) {
  const msgRef = await addDoc(
    collection(db, 'chatRooms', roomId, 'messages'),
    message
  );
  await updateDoc(doc(db, 'chatRooms', roomId), {
    lastMessage: message,
    updatedAt: Date.now(),
  });
  return msgRef.id;
}

export function listenToChatRooms(userId: string, callback: (rooms: unknown[]) => void) {
  const q = query(
    collection(db, 'chatRooms'),
    where('participantIds', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── Trade Proposals ──────────────────────────────────────────────────────────

export async function sendTradeProposal(
  proposal: Omit<import('../types').TradeProposal, 'id'>
) {
  const ref_ = await addDoc(collection(db, 'tradeProposals'), proposal);
  // Also send as a chat message
  const room = await createDMRoom(proposal.fromUserId, proposal.toUserId);
  await sendMessage(room.id, {
    senderId: proposal.fromUserId,
    senderName: '',
    text: `Trade Proposal: ${proposal.type.toUpperCase()} ${proposal.shares} shares of ${proposal.symbol}`,
    timestamp: Date.now(),
    type: 'trade_proposal',
    metadata: { proposalId: ref_.id, ...proposal },
  });
  return ref_.id;
}

export function listenToTradeProposals(
  userId: string,
  callback: (proposals: unknown[]) => void
) {
  const q = query(
    collection(db, 'tradeProposals'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function respondToTradeProposal(
  proposalId: string,
  status: 'accepted' | 'declined'
) {
  return updateDoc(doc(db, 'tradeProposals', proposalId), { status });
}

// ─── Club Invites ─────────────────────────────────────────────────────────────

export async function sendClubInviteToUser(
  toUserId: string,
  invite: {
    clubId: string;
    clubName: string;
    fromUserId: string;
    fromUsername: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await addDoc(collection(db, 'clubInvites'), {
      toUserId,
      clubId: invite.clubId,
      clubName: invite.clubName,
      fromUserId: invite.fromUserId,
      fromUsername: invite.fromUsername,
      status: 'pending',
      sentAt: Date.now(),
    });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message ?? 'Failed to send invite' };
  }
}

export function listenToClubInvites(
  userId: string,
  callback: (invites: unknown[]) => void
) {
  const q = query(
    collection(db, 'clubInvites'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function dismissClubInvite(inviteId: string) {
  return updateDoc(doc(db, 'clubInvites', inviteId), { status: 'dismissed' });
}
