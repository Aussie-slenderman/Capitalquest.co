import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
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
  arrayUnion,
  arrayRemove,
  deleteDoc,
  documentId,
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
// ⚠️  FILL THESE IN to enable cross-device login and cloud data sync.
//
// 1. Go to https://console.firebase.google.com
// 2. Create a project (or open your existing one)
// 3. Project Settings → General → Your apps → Add app → Web
// 4. Copy the firebaseConfig values below
// 5. In Firebase console: enable Authentication → Email/Password
//    and create a Firestore database (start in test mode)
//
// Once filled in, players can log in on any device with the same
// email + password and access their exact same account and portfolio.
const firebaseConfig = {
  apiKey: 'AIzaSyCP1AcnDTU2umjR3cGycRxQ5mwOFq4Xjgg',
  authDomain: 'capitalquest-4d20b.firebaseapp.com',
  databaseURL: 'https://capitalquest-4d20b-default-rtdb.firebaseio.com',
  projectId: 'capitalquest-4d20b',
  storageBucket: 'capitalquest-4d20b.firebasestorage.app',
  messagingSenderId: '407589569541',
  appId: '1:407589569541:web:3b8a543f03ad9f110ec86c',
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
  username: string,
  password: string,
  displayName: string,
  country: string,
  userEmail?: string
) {
  // Use a unique ID for Firebase Auth email so multiple users can share the same username
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const email = `${uniqueId}@capitalquest.app`;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });

  // Generate unique 8-digit account number (no duplicates)
  let accountNumber = '';
  let isUnique = false;
  while (!isUnique) {
    accountNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    const existing = await getDocs(query(collection(db, 'users'), where('accountNumber', '==', accountNumber)));
    if (existing.empty) isUnique = true;
  }

  const userData = {
    id: cred.user.uid,
    username,
    displayName,
    email,
    userEmail: userEmail || '',
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
    avatarConfig: null,
  };

  await setDoc(doc(db, 'users', cred.user.uid), userData);
  return { user: cred.user, userData };
}

export async function loginUser(usernameOrEmail: string, password: string) {
  // If it looks like an email, use it directly (for moderator login etc.)
  if (usernameOrEmail.includes('@')) {
    return signInWithEmailAndPassword(auth, usernameOrEmail, password);
  }
  // Otherwise, look up the user's Firebase Auth email from Firestore by username
  const usersSnap = await getDocs(query(collection(db, 'users'), where('username', '==', usernameOrEmail)));
  if (usersSnap.empty) {
    throw { code: 'auth/user-not-found', message: 'No account found with that username.' };
  }
  // If multiple accounts share the username, try each until one works
  const docs = usersSnap.docs;
  let lastError: unknown = null;
  for (const userDoc of docs) {
    const userData = userDoc.data();
    if (userData.email) {
      try {
        return await signInWithEmailAndPassword(auth, userData.email, password);
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw lastError || { code: 'auth/wrong-password', message: 'Invalid password.' };
}

export async function lookupUserByEmail(email: string) {
  const snap = await getDocs(query(collection(db, 'users'), where('userEmail', '==', email.toLowerCase().trim())));
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id };
}

export async function resetUserPassword(userId: string, firebaseEmail: string, newPassword: string) {
  // Sign in as the user with their Firebase auth email, then update password
  // Since we can't sign in without their old password, we use admin-style update
  // For client-side, we need the user to be currently signed in
  // Alternative approach: look up the firebase auth email and use updatePassword
  const currentUser = auth.currentUser;
  if (currentUser) {
    // If already signed in, update directly
    const { updatePassword } = await import('firebase/auth');
    await updatePassword(currentUser, newPassword);
    return;
  }
  // If not signed in, sign in with the firebase email first
  // We need to store the result and update
  throw { message: 'Please sign in first to reset your password.' };
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function deleteFirebaseAccount(userId: string) {
  const currentUser = auth.currentUser;
  // Delete all Firestore data
  try {
    // Notifications subcollection
    const notifs = await getDocs(collection(db, 'users', userId, 'notifications'));
    for (const n of notifs.docs) await n.ref.delete();
  } catch {}
  try { await setDoc(doc(db, 'users', userId), { __deleted: true }, { merge: false }); } catch {}
  try { const userRef = doc(db, 'users', userId); await userRef.delete(); } catch {}
  try { await doc(db, 'portfolios', userId).delete(); } catch {}
  try { await doc(db, 'leaderboard', userId).delete(); } catch {}
  try {
    const txns = await getDocs(query(collection(db, 'transactions'), where('userId', '==', userId)));
    for (const t of txns.docs) await t.ref.delete();
  } catch {}
  // Delete the Firebase Auth account (only works if this is the signed-in user)
  if (currentUser && currentUser.uid === userId) {
    try { await deleteUser(currentUser); } catch {}
  }
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── User Helpers ─────────────────────────────────────────────────────────────

export async function getUserById(userId: string) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

export async function loadWatchlist(userId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', userId));
  const data = snap.exists() ? snap.data() : null;
  return Array.isArray(data?.watchlist) ? data.watchlist : [];
}

export async function updateUser(userId: string, data: Partial<Record<string, unknown>>) {
  return setDoc(doc(db, 'users', userId), data, { merge: true });
}

export function listenToUser(userId: string, callback: (data: unknown) => void) {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    if (snap.exists()) callback({ ...snap.data(), id: snap.id });
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
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
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
    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        // Ensure holdings array exists even if missing from Firestore
        if (!data.holdings) data.holdings = [];
        callback(data);
      }
    }
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

// Save an hourly snapshot for the 30-day performance chart.
// Key format: 'YYYY-MM-DD-HH' so we get at most one point per hour.
export async function saveHourlySnapshot(
  userId: string,
  totalValue: number,
): Promise<void> {
  if (IS_MOCK_FIREBASE) return;
  const now = new Date();
  const key = `${now.toISOString().slice(0, 10)}-${String(now.getHours()).padStart(2, '0')}`;
  try {
    await setDoc(
      doc(db, 'portfolioHistory', userId, 'hourly', key),
      { totalValue, timestamp: Date.now() },
      { merge: true },
    );
  } catch { /* non-critical */ }
}

// Load hourly snapshots for the last 30 days (for the performance chart).
export async function getPortfolioHistory(
  userId: string,
): Promise<{ timestamp: number; totalValue: number }[]> {
  if (IS_MOCK_FIREBASE) return [];
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const snap = await getDocs(
      query(
        collection(db, 'portfolioHistory', userId, 'hourly'),
        orderBy('timestamp', 'asc'),
      ),
    );
    return snap.docs
      .map(d => d.data() as { timestamp: number; totalValue: number })
      .filter(d => d.timestamp >= thirtyDaysAgo);
  } catch {
    // Fallback: try daily snapshots if hourly collection doesn't exist yet
    try {
      const snap = await getDocs(
        collection(db, 'portfolioHistory', userId, 'snapshots'),
      );
      return snap.docs
        .map(d => {
          const data = d.data();
          return { timestamp: data.updatedAt ?? Date.now(), totalValue: data.totalValue ?? 0 };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch { return []; }
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

export async function getLeaderboard(type: 'global' | 'local', country?: string, limitCount = 500) {
  // Use Firestore server-side ordering and limiting for scalability
  // Falls back to client-side sort if the index doesn't exist yet
  let portfolioSnap;
  try {
    portfolioSnap = await getDocs(
      query(
        collection(db, 'portfolios'),
        orderBy('totalGainLoss', 'desc'),
        limit(limitCount)
      )
    );
  } catch {
    // Fallback: fetch all and sort client-side (works without index)
    portfolioSnap = await getDocs(collection(db, 'portfolios'));
  }
  if (portfolioSnap.empty) return [];

  // Portfolio docs are keyed by userId, but the userId field may not exist
  // inside the document data — use the doc ID as the canonical userId.
  const portfolios = portfolioSnap.docs
    .map(d => ({ ...d.data(), userId: (d.data().userId as string) || d.id }))
    .sort((a, b) => ((b.totalGainLoss as number) ?? 0) - ((a.totalGainLoss as number) ?? 0))
    .slice(0, limitCount);

  // Fetch user display data in batches of 30 (Firestore 'in' limit)
  const userMap: Record<string, Record<string, unknown>> = {};
  const userIds = portfolios.map(p => p.userId as string).filter(Boolean);
  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    try {
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where(documentId(), 'in', batch))
      );
      usersSnap.docs.forEach(d => { userMap[d.id] = d.data(); });
    } catch { /* partial failure — continue with what we have */ }
  }

  // Build ranked entries
  let entries = portfolios.map((p, i) => {
    const u = userMap[p.userId as string] ?? {};
    return {
      rank: i + 1,
      id: p.userId as string,
      userId: p.userId as string,
      username: (u.username as string) ?? 'Player',
      displayName: (u.displayName as string) ?? (u.username as string) ?? 'Player',
      level: (u.level as number) ?? 1,
      country: (u.country as string) ?? '',
      startingBalance: (p.startingBalance as number) ?? 0,
      currentValue: (p.totalValue as number) ?? 0,
      gainDollars: (p.totalGainLoss as number) ?? 0,
    };
  });

  // For local leaderboard, filter by country and re-rank
  if (type === 'local' && country) {
    entries = entries
      .filter(e => e.country === country)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  return entries;
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
  batch.set(clubRef, { memberIds: arrayUnion(userId) }, { merge: true });
  batch.set(doc(db, 'users', userId), { clubIds: arrayUnion(clubId) }, { merge: true });
  if (club.chatRoomId) {
    batch.set(doc(db, 'chatRooms', club.chatRoomId), {
      participantIds: arrayUnion(userId),
    }, { merge: true });
  }
  await batch.commit();
}

export async function deleteClub(clubId: string, ownerId: string) {
  const clubRef = doc(db, 'clubs', clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error('Club not found');
  const club = clubSnap.data();
  if (club.ownerId !== ownerId) throw new Error('Only the owner can delete this club');

  const batch = writeBatch(db);
  // Delete the club document
  batch.delete(clubRef);
  // Remove clubId from all members' clubIds
  for (const memberId of (club.memberIds || [])) {
    batch.set(doc(db, 'users', memberId), { clubIds: arrayRemove(clubId) }, { merge: true });
  }
  // Delete the chat room if it exists
  if (club.chatRoomId) {
    batch.delete(doc(db, 'chatRooms', club.chatRoomId));
  }
  await batch.commit();
}

export async function getClub(clubId: string) {
  const snap = await getDoc(doc(db, 'clubs', clubId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getClubsByIds(clubIds: string[]) {
  if (!clubIds || clubIds.length === 0) return [];
  const results = [];
  // Firestore 'in' queries support max 30 items
  for (let i = 0; i < clubIds.length; i += 30) {
    const batch = clubIds.slice(i, i + 30);
    const q = query(collection(db, 'clubs'), where(documentId(), 'in', batch));
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
  }
  return results;
}

export async function sendNotificationToUser(userId: string, notification: { type: string; title: string; body: string; data?: Record<string, unknown> }) {
  await addDoc(collection(db, 'users', userId, 'notifications'), {
    ...notification,
    read: false,
    createdAt: Date.now(),
  });
}

export async function addFriend(userId: string, friendId: string) {
  // Update both users' friendIds using arrayUnion (atomic, no duplicates)
  const userRef = doc(db, 'users', userId);
  const friendRef = doc(db, 'users', friendId);
  await updateDoc(userRef, { friendIds: arrayUnion(friendId) });
  await updateDoc(friendRef, { friendIds: arrayUnion(userId) });
}

export async function removeFriend(userId: string, friendId: string) {
  const userRef = doc(db, 'users', userId);
  const friendRef = doc(db, 'users', friendId);
  // Update current user first (always allowed)
  await updateDoc(userRef, { friendIds: arrayRemove(friendId) });
  // Update the other user's doc (allowed by the friendIds update rule)
  try {
    await updateDoc(friendRef, { friendIds: arrayRemove(userId) });
  } catch (e) {
    console.warn('Could not update friend doc on remove:', e);
  }
  // No batch needed — each update is independent
}

export async function updateInviteStatus(inviteId: string, status: 'accepted' | 'declined') {
  try {
    const inviteRef = doc(db, 'clubInvites', inviteId);
    await setDoc(inviteRef, { status }, { merge: true });
  } catch {}
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
  // Check if DM already exists (single-field query to avoid composite index requirement)
  const q = query(
    collection(db, 'chatRooms'),
    where('participantIds', 'array-contains', userId1)
  );
  const snap = await getDocs(q);
  const existing = snap.docs.find(d => {
    const data = d.data();
    return data.type === 'dm' && data.participantIds.includes(userId2);
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

export async function sendFriendRequestToUser(
  toUserId: string,
  from: { fromUserId: string; fromUsername: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check for existing pending invite to prevent duplicates
    const existing = query(
      collection(db, 'clubInvites'),
      where('toUserId', '==', toUserId),
      where('fromUserId', '==', from.fromUserId),
      where('type', '==', 'friend_request'),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(existing);
    if (!snap.empty) {
      return { success: true }; // Already sent
    }
    await addDoc(collection(db, 'clubInvites'), {
      toUserId,
      type: 'friend_request',
      fromUserId: from.fromUserId,
      fromUsername: from.fromUsername,
      status: 'pending',
      sentAt: Date.now(),
    });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message ?? 'Failed to send friend request' };
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

export async function fetchPendingInvites(userId: string) {
  const q = query(
    collection(db, 'clubInvites'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function dismissClubInvite(inviteId: string) {
  return updateDoc(doc(db, 'clubInvites', inviteId), { status: 'dismissed' });
}

export async function revokeClubInvite(inviteId: string, fromUserId: string) {
  const inviteRef = doc(db, 'clubInvites', inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error('Invite not found');
  const data = inviteSnap.data();
  if (data.fromUserId !== fromUserId) throw new Error('Only the sender can revoke this invite');
  return updateDoc(inviteRef, { status: 'revoked' });
}

export async function getSentInvites(userId: string) {
  const q = query(
    collection(db, 'clubInvites'),
    where('fromUserId', '==', userId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function kickMemberFromClub(clubId: string, ownerId: string, memberId: string) {
  const clubRef = doc(db, 'clubs', clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error('Club not found');
  const club = clubSnap.data();
  if (club.ownerId !== ownerId) throw new Error('Only the club owner can kick members');

  const newMembers = (club.memberIds || []).filter((id: string) => id !== memberId);
  const batch = writeBatch(db);
  batch.update(clubRef, { memberIds: newMembers });

  // Remove club from kicked user's clubIds
  const userRef = doc(db, 'users', memberId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const newClubIds = (userData.clubIds || []).filter((id: string) => id !== clubId);
    batch.update(userRef, { clubIds: newClubIds });
  }

  // Remove from chat room
  if (club.chatRoomId) {
    const chatRef = doc(db, 'chatRooms', club.chatRoomId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists()) {
      const chatData = chatSnap.data();
      const newParticipants = (chatData.participantIds || []).filter((id: string) => id !== memberId);
      batch.update(chatRef, { participantIds: newParticipants });
    }
  }

  await batch.commit();
}

// Allow a member to leave a club voluntarily
export async function leaveClub(clubId: string, userId: string) {
  const clubRef = doc(db, 'clubs', clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error('Club not found');
  const club = clubSnap.data();

  const batchOp = writeBatch(db);
  batchOp.set(clubRef, { memberIds: arrayRemove(userId) }, { merge: true });
  batchOp.set(doc(db, 'users', userId), { clubIds: arrayRemove(clubId) }, { merge: true });

  if (club.chatRoomId) {
    batchOp.set(doc(db, 'chatRooms', club.chatRoomId), { participantIds: arrayRemove(userId) }, { merge: true });
  }

  await batchOp.commit();
}
