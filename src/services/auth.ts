/**
 * Unified auth/db service.
 * Automatically uses mock (localStorage) when Firebase isn't configured,
 * or real Firebase when valid credentials are present.
 *
 * To enable cross-device login: fill in your Firebase credentials in
 * src/services/firebase.ts — that is the ONLY file you need to update.
 */

// Single source of truth — reads directly from firebase.ts config
import { IS_MOCK_FIREBASE } from './firebase';
export const IS_MOCK = IS_MOCK_FIREBASE;

// ─── Re-export everything from the right backend ─────────────────────────────

export {
  IS_MOCK as isMockMode,
};

import * as Mock from './mockAuth';
import * as FB from './firebase';

// Auth
export async function registerUser(
  username: string, password: string,
  displayName: string, country: string
) {
  const email = username + '@capitalquest.app';
  if (IS_MOCK) return Mock.mockRegister(username, password, displayName, country);
  return FB.registerUser(username, password, displayName, country);
}

export async function loginUser(email: string, password: string) {
  if (IS_MOCK) return Mock.mockLogin(email, password);
  return FB.loginUser(email, password);
}

export async function signOut() {
  if (IS_MOCK) return Mock.mockSignOut();
  return FB.signOut();
}

export async function deleteAccount(userId: string) {
  if (IS_MOCK) return Mock.mockDeleteAccount(userId);
  return FB.deleteFirebaseAccount(userId);
}

export function onAuthChange(callback: (user: unknown) => void) {
  if (IS_MOCK) return Mock.mockOnAuthChange(callback);
  return FB.onAuthChange(callback as (user: import('firebase/auth').User | null) => void);
}

// User
export async function getUserById(userId: string) {
  if (IS_MOCK) return Mock.mockGetUser(userId);
  return FB.getUserById(userId);
}

export async function updateUser(userId: string, data: Record<string, unknown>) {
  if (IS_MOCK) return Mock.mockUpdateUser(userId, data);
  return FB.updateUser(userId, data);
}

export function listenToUser(userId: string, callback: (data: unknown) => void) {
  if (IS_MOCK) return Mock.mockListenToUser(userId, callback);
  return FB.listenToUser(userId, callback);
}

export async function findUserByAccountNumber(accountNumber: string) {
  if (IS_MOCK) return null;
  return FB.findUserByAccountNumber(accountNumber);
}

export async function searchUsers(term: string) {
  if (IS_MOCK) return [];
  return FB.searchUsers(term);
}

// Portfolio
export async function initPortfolio(userId: string, startingBalance: number) {
  if (IS_MOCK) return Mock.mockInitPortfolio(userId, startingBalance);
  return FB.initPortfolio(userId, startingBalance);
}

export async function getPortfolio(userId: string) {
  if (IS_MOCK) return Mock.mockGetPortfolio(userId);
  return FB.getPortfolio(userId);
}

export function listenToPortfolio(userId: string, callback: (data: unknown) => void) {
  if (IS_MOCK) return Mock.mockListenToPortfolio(userId, callback);
  return FB.listenToPortfolio(userId, callback);
}

export async function updatePortfolio(userId: string, data: Record<string, unknown>) {
  if (IS_MOCK) return Mock.mockUpdatePortfolio(userId, data);
  return FB.updatePortfolio(userId, data);
}

// Transactions
export async function addTransaction(userId: string, tx: Record<string, unknown>) {
  if (IS_MOCK) return Mock.mockAddTransaction(userId, tx);
  return FB.addTransaction(userId, tx as Parameters<typeof FB.addTransaction>[1]);
}

export async function getTransactions(userId: string) {
  if (IS_MOCK) return Mock.mockGetTransactions(userId);
  return FB.getTransactions(userId);
}

// Leaderboard
export async function getLeaderboard(type: 'global' | 'local', country?: string) {
  if (IS_MOCK) return Mock.mockGetLeaderboard();
  return FB.getLeaderboard(type, country);
}

export async function updateLeaderboardEntry(userId: string, data: Record<string, unknown>) {
  if (IS_MOCK) return Mock.mockUpdateLeaderboard(userId, data);
  return FB.updateLeaderboardEntry(userId, data);
}

// Chat
export async function createDMRoom(userId1: string, userId2: string) {
  if (IS_MOCK) return { id: `dm_${userId1}_${userId2}`, type: 'dm', participantIds: [userId1, userId2], updatedAt: Date.now() };
  return FB.createDMRoom(userId1, userId2);
}

export async function sendMessage(roomId: string, message: Record<string, unknown>) {
  if (IS_MOCK) return Mock.mockSendMessage(roomId, message);
  return FB.sendMessage(roomId, message as Parameters<typeof FB.sendMessage>[1]);
}

export function listenToMessages(roomId: string, callback: (msgs: unknown[]) => void) {
  if (IS_MOCK) return Mock.mockListenToMessages(roomId, callback);
  return FB.listenToMessages(roomId, callback as Parameters<typeof FB.listenToMessages>[1]);
}

export function listenToChatRooms(userId: string, callback: (rooms: unknown[]) => void) {
  if (IS_MOCK) return Mock.mockListenToChatRooms(userId, callback);
  return FB.listenToChatRooms(userId, callback as Parameters<typeof FB.listenToChatRooms>[1]);
}

export function listenToTradeProposals(userId: string, callback: (proposals: unknown[]) => void) {
  if (IS_MOCK) return Mock.mockListenToTradeProposals(userId, callback);
  return FB.listenToTradeProposals(userId, callback as Parameters<typeof FB.listenToTradeProposals>[1]);
}

export function listenToClubInvites(userId: string, callback: (invites: unknown[]) => void) {
  if (IS_MOCK) return () => {};
  return FB.listenToClubInvites(userId, callback);
}

export async function dismissClubInvite(inviteId: string) {
  if (IS_MOCK) return;
  return FB.dismissClubInvite(inviteId);
}

// Clubs
export async function createClub(
  ownerId: string, name: string, description: string, isPublic: boolean
) {
  if (IS_MOCK) {
    const club = {
      id: `club_${Date.now()}`,
      name, description, ownerId,
      memberIds: [ownerId],
      isPublic,
      createdAt: Date.now(),
      chatRoomId: `chat_club_${Date.now()}`,
    };
    return club;
  }
  return FB.createClub(ownerId, name, description, isPublic);
}

export async function joinClub(userId: string, clubId: string) {
  if (IS_MOCK) return;
  return FB.joinClub(userId, clubId);
}

export async function getPublicClubs() {
  if (IS_MOCK) return [];
  return FB.getPublicClubs();
}

export async function sendClubInvite(
  fromUserId: string,
  fromUsername: string,
  toAccountNumber: string,
  clubId: string,
  clubName: string,
): Promise<{ success: boolean; error?: string }> {
  if (IS_MOCK) {
    // In mock mode we can't look up real users — return success so the UI
    // can add a local invite to the store for preview purposes.
    return { success: true };
  }
  try {
    const target = await FB.findUserByAccountNumber(toAccountNumber);
    if (!target) return { success: false, error: 'Player not found' };
    return await FB.sendClubInviteToUser((target as { id: string }).id, {
      clubId,
      clubName,
      fromUserId,
      fromUsername,
    });
  } catch {
    return { success: false, error: 'Failed to send invite' };
  }
}

export async function sendFriendRequest(
  fromUserId: string,
  fromUsername: string,
  toAccountNumber: string,
): Promise<{ success: boolean; error?: string }> {
  if (IS_MOCK) {
    return { success: true };
  }
  try {
    const target = await FB.findUserByAccountNumber(toAccountNumber);
    if (!target) return { success: false, error: 'Player not found' };
    await FB.sendNotificationToUser((target as { id: string }).id, {
      type: 'friend_request',
      title: `Friend request from ${fromUsername}`,
      body: `${fromUsername} wants to be your friend`,
      data: { fromUserId, fromUsername },
    });
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to send request' };
  }
}

export async function addFriend(userId: string, friendId: string) {
  if (IS_MOCK) return;
  return FB.addFriend(userId, friendId);
}

export async function updateInviteStatus(inviteId: string, status: 'accepted' | 'declined') {
  if (IS_MOCK) return;
  return FB.updateInviteStatus(inviteId, status);
}

export async function revokeClubInvite(inviteId: string, fromUserId: string) {
  if (IS_MOCK) return;
  return FB.revokeClubInvite(inviteId, fromUserId);
}

export async function getSentInvites(userId: string) {
  if (IS_MOCK) return [];
  return FB.getSentInvites(userId);
}

export async function kickMemberFromClub(clubId: string, ownerId: string, memberId: string) {
  if (IS_MOCK) return;
  return FB.kickMemberFromClub(clubId, ownerId, memberId);
}

export async function sendTradeProposal(proposal: Record<string, unknown>) {
  if (IS_MOCK) return `proposal_${Date.now()}`;
  return FB.sendTradeProposal(proposal as Parameters<typeof FB.sendTradeProposal>[0]);
}

export async function respondToTradeProposal(
  proposalId: string, status: 'accepted' | 'declined'
) {
  if (IS_MOCK) return;
  return FB.respondToTradeProposal(proposalId, status);
}
