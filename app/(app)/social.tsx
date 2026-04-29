import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createClub,
  joinClub,
  getPublicClubs,
  createDMRoom,
  sendMessage,
  listenToMessages,
  sendTradeProposal,
  respondToTradeProposal,
  findUserByAccountNumber,
  searchUsers,
  sendClubInvite,
  sendFriendRequest,
  removeFriend,
  deleteClub,
  getLeaderboard,
  getUserById,
  fetchPendingInvites,
  getClubsByIds,
} from '../../src/services/auth';
import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { formatCurrency, formatShares, formatRelativeTime } from '../../src/utils/formatters';
import type { ChatRoom, Message, TradeProposal, Club, ClubInvite, LeaderboardEntry, Holding } from '../../src/types';
import { useT } from '../../src/constants/translations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type SocialTab = 'messages' | 'clubs' | 'friends';

interface UserResult {
  id: string;
  displayName: string;
  username: string;
  accountNumber: string;
  level: number;
  xp: number;
}

// ─── Helper: Initials Avatar ─────────────────────────────────────────────────

function InitialsAvatar({
  name,
  size = 40,
  color = Colors.brand.primary,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color + '33',
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38, color }]}>
        {initials}
      </Text>
    </View>
  );
}

// ─── Chat Modal ───────────────────────────────────────────────────────────────

// ─── Club Digest Header ────────────────────────────────────────────────────────

function ClubDigestHeader({ club }: { club: Club }) {
  const t = useT();
  const { user, portfolio, appColorMode: dgAppColorMode } = useAppStore();
  const DC = dgAppColorMode === 'light' ? LightColors : Colors;
  const [sorted, setSorted] = useState<LeaderboardEntry[]>([]);
  const [digestLoading, setDigestLoading] = useState(true);

  // Fetch leaderboard data for club members on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getLeaderboard('global');
        const memberIds = new Set(club.memberIds ?? []);
        let entries = (data as LeaderboardEntry[]).filter(e => memberIds.has(e.userId));

        // Add current user if they're a member but not in the leaderboard yet
        if (user && memberIds.has(user.id) && !entries.some(e => e.userId === user.id)) {
          const startBal = portfolio?.startingBalance ?? user.startingBalance ?? 10000;
          const curVal = portfolio?.totalValue ?? startBal;
          entries.push({
            userId: user.id,
            displayName: user.displayName ?? user.username ?? 'Player',
            username: user.username ?? 'Player',
            gainDollars: curVal - startBal,
            rank: 0,
            level: user.level ?? 1,
            startingBalance: startBal,
            currentValue: curVal,
            country: user.country ?? '',
            isCurrentUser: true,
          });
        }

        entries.sort((a, b) => b.gainDollars - a.gainDollars);
        entries.forEach((e, i) => { e.rank = i + 1; e.isCurrentUser = e.userId === user?.id; });
        setSorted(entries);
      } catch {}
      setDigestLoading(false);
    })();
  }, [club.memberIds?.length, user?.id, portfolio?.totalValue]);

  const topPerformer = sorted[0];

  if (digestLoading) {
    return (
      <View style={digestStyles.wrapper}>
        <ActivityIndicator color={Colors.brand.primary} style={{ paddingVertical: 20 }} />
        <View style={digestStyles.divider} />
      </View>
    );
  }

  if (sorted.length === 0) {
    return (
      <View style={digestStyles.wrapper}>
        <Text style={[digestStyles.emptyNote, { color: DC.text.tertiary }]}>
          No leaderboard data for club members yet. Rankings will appear once members have traded.
        </Text>
        <View style={digestStyles.divider} />
      </View>
    );
  }

  return (
    <View style={digestStyles.wrapper}>

      {/* ── Top Performer card ── */}
      {topPerformer && (
        <View style={digestStyles.row}>
          <View style={[digestStyles.champCard, { borderColor: `${Colors.brand.gold}55`, flex: 1 }]}>
            <Text style={digestStyles.champPeriod}>🏆 TOP PERFORMER</Text>
            <Text style={digestStyles.champEmoji}>🥇</Text>
            <Text style={digestStyles.champName}>{topPerformer.displayName}</Text>
            <Text style={[
              digestStyles.champGain,
              { color: topPerformer.gainDollars >= 0 ? Colors.market.gain : Colors.market.loss },
            ]}>
              {topPerformer.gainDollars >= 0 ? '+' : ''}{formatCurrency(topPerformer.gainDollars)}
            </Text>
          </View>
        </View>
      )}

      {/* ── Member rankings ── */}
      <Text style={digestStyles.sectionLabel}>MEMBER RANKINGS</Text>
      {sorted.map((m, i) => {
        const isCurrentUser = m.userId === user?.id;
        const gainColor = m.gainDollars >= 0 ? Colors.market.gain : Colors.market.loss;
        return (
          <View key={m.userId} style={[digestStyles.memberRow, isCurrentUser && digestStyles.memberRowHighlight]}>
            <Text style={digestStyles.memberRank}>#{i + 1}</Text>
            <View style={digestStyles.memberLeft}>
              <View style={digestStyles.memberNameRow}>
                <Text style={digestStyles.memberName}>{m.displayName}</Text>
                {isCurrentUser && (
                  <View style={digestStyles.youBadge}>
                    <Text style={digestStyles.youBadgeText}>{t('you')}</Text>
                  </View>
                )}
              </View>
              <Text style={digestStyles.memberUsername}>@{m.username}</Text>
            </View>
            <Text style={[digestStyles.memberGain, { color: gainColor }]}>
              {m.gainDollars >= 0 ? '+' : ''}{formatCurrency(m.gainDollars)}
            </Text>
          </View>
        );
      })}

      <View style={digestStyles.divider} />
    </View>
  );
}

const digestStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg.primary,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  champCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  champPeriod: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
  },
  champEmoji: { fontSize: 24 },
  champName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  champGain: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    color: Colors.text.tertiary,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: Spacing.sm,
  },
  memberRowHighlight: {
    borderColor: `${Colors.brand.primary}55`,
    backgroundColor: `${Colors.brand.primary}08`,
  },
  memberRank: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.tertiary,
    width: 28,
  },
  memberLeft: { flex: 1 },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  memberUsername: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  memberGain: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  youBadge: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  youBadgeText: {
    fontSize: 8,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  emptyNote: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginTop: Spacing.sm,
    marginBottom: 0,
  },
});

// ─── Chat Modal ───────────────────────────────────────────────────────────────

function ChatModal({
  visible,
  room,
  onClose,
  club,
}: {
  visible: boolean;
  room: ChatRoom | null;
  onClose: () => void;
  club?: Club;
}) {
  const t = useT();
  const { user, appColorMode } = useAppStore();
  const CMC = appColorMode === 'light' ? LightColors : Colors;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [viewPortfolioVisible, setViewPortfolioVisible] = useState(false);
  const [viewedPortfolio, setViewedPortfolio] = useState<any>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  // Whether the current viewer is allowed to open the DM partner's
  // portfolio. Determined from the partner's privacy settings, prefetched
  // when the DM opens. Defaults to false so the button stays hidden until
  // we've confirmed access.
  const [canViewDmPortfolio, setCanViewDmPortfolio] = useState(false);

  useEffect(() => {
    if (!room) return;
    const unsubscribe = listenToMessages(room.id, (msgs) => {
      setMessages(msgs as Message[]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsubscribe();
  }, [room]);

  // Prefetch the DM partner's portfolio privacy meta once the room is
  // open so we can hide the "View Portfolio" button for private accounts.
  useEffect(() => {
    if (!room || !user || room.type !== 'dm') {
      setCanViewDmPortfolio(false);
      return;
    }
    const otherUserId = room.participantIds.find((id: string) => id !== user.id);
    if (!otherUserId) {
      setCanViewDmPortfolio(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { getPortfolioPrivacyMeta, canViewPortfolioFromMeta } = await import('../../src/services/firebase');
        const meta = await getPortfolioPrivacyMeta(otherUserId);
        if (cancelled) return;
        const viewerAcc = (user as any)?.accountNumber as string | undefined;
        setCanViewDmPortfolio(canViewPortfolioFromMeta(meta, user.id, viewerAcc, otherUserId));
      } catch {
        if (!cancelled) setCanViewDmPortfolio(false);
      }
    })();
    return () => { cancelled = true; };
  }, [room, user]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !room || !user) return;
    setSending(true);
    try {
      await sendMessage(room.id, {
        senderId: user.id,
        senderName: user.displayName,
        text: inputText.trim(),
        timestamp: Date.now(),
        type: 'text',
      });
      setInputText('');
    } catch (e) {
      // silently fail
    } finally {
      setSending(false);
    }
  }, [inputText, room, user]);

  const handleViewFriendPortfolio = useCallback(async () => {
    if (!room || !user || room.type !== 'dm' || portfolioLoading) return;
    if (!canViewDmPortfolio) return;
    const otherUserId = room.participantIds.find((id: string) => id !== user.id);
    if (!otherUserId) return;
    setPortfolioLoading(true);
    try {
      const { getFriendsPortfolio } = await import('../../src/services/firebase');
      const viewerAcc = (user as any)?.accountNumber as string | undefined;
      const data = await getFriendsPortfolio(otherUserId, user.id, viewerAcc);
      if (data) {
        setViewedPortfolio(data);
        setViewPortfolioVisible(true);
      } else {
        if (typeof window !== 'undefined') {
          window.alert("This player's portfolio is private");
        }
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("Could not load this player's portfolio");
      }
    }
    setPortfolioLoading(false);
  }, [room, user, portfolioLoading, canViewDmPortfolio]);

  const handleRespondToProposal = useCallback(
    async (proposalId: string, status: 'accepted' | 'declined') => {
      try {
        await respondToTradeProposal(proposalId, status);
      } catch (e) {
        // silently fail
      }
    },
    []
  );

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id;

    if (item.type === 'trade_proposal' && item.metadata) {
      const meta = item.metadata as {
        proposalId?: string;
        symbol?: string;
        type?: string;
        shares?: number;
        pricePerShare?: number;
        total?: number;
      };
      return (
        <View style={styles.proposalCard}>
          <Text style={styles.proposalTitle}>Trade Proposal</Text>
          <View style={styles.proposalRow}>
            <Text style={styles.proposalLabel}>Symbol</Text>
            <Text style={styles.proposalValue}>{meta.symbol}</Text>
          </View>
          <View style={styles.proposalRow}>
            <Text style={styles.proposalLabel}>Action</Text>
            <Text
              style={[
                styles.proposalValue,
                { color: meta.type === 'buy' ? Colors.market.gain : Colors.market.loss },
              ]}
            >
              {meta.type?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.proposalRow}>
            <Text style={styles.proposalLabel}>Shares</Text>
            <Text style={styles.proposalValue}>{formatShares(meta.shares ?? 0)}</Text>
          </View>
          <View style={styles.proposalRow}>
            <Text style={styles.proposalLabel}>Price</Text>
            <Text style={styles.proposalValue}>{formatCurrency(meta.pricePerShare ?? 0)}</Text>
          </View>
          <View style={[styles.proposalRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.proposalLabel}>Total</Text>
            <Text style={[styles.proposalValue, { fontWeight: FontWeight.bold }]}>
              {formatCurrency(meta.total ?? 0)}
            </Text>
          </View>
          {!isOwn && meta.proposalId && (
            <View style={styles.proposalActions}>
              <TouchableOpacity
                style={[styles.proposalBtn, { backgroundColor: Colors.market.gain + '22', borderColor: Colors.market.gain }]}
                onPress={() => handleRespondToProposal(meta.proposalId!, 'accepted')}
              >
                <Text style={[styles.proposalBtnText, { color: Colors.market.gain }]}>{t('accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proposalBtn, { backgroundColor: Colors.market.loss + '22', borderColor: Colors.market.loss }]}
                onPress={() => handleRespondToProposal(meta.proposalId!, 'declined')}
              >
                <Text style={[styles.proposalBtnText, { color: Colors.market.loss }]}>{t('decline')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isOwn ? styles.messageBubbleRight : styles.messageBubbleLeft,
        ]}
      >
        {!isOwn && (
          <Text style={styles.messageSenderName}>{item.senderName}</Text>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
          ]}
        >
          <Text style={[styles.messageText, { color: '#FFFFFF' }]}>
            {item.text}
          </Text>
        </View>
        <Text style={[styles.messageTime, { color: CMC.text.tertiary }]}>{formatRelativeTime(item.timestamp)}</Text>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.chatModalContainer}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={onClose} style={styles.chatBackBtn}>
            <Text style={styles.chatBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.chatTitle, { color: CMC.text.primary }]} numberOfLines={1}>
            {room?.name ?? 'Chat'}
          </Text>
          {room?.type === 'dm' && canViewDmPortfolio ? (
            <TouchableOpacity
              onPress={handleViewFriendPortfolio}
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              disabled={portfolioLoading}
            >
              {portfolioLoading ? (
                <ActivityIndicator size="small" color={Colors.brand.primary} />
              ) : (
                <Text style={{ fontSize: FontSize.xs, color: Colors.brand.primary, fontWeight: FontWeight.semibold }}>
                  View Portfolio
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListHeaderComponent={club ? <ClubDigestHeader club={club} /> : null}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: CMC.text.secondary }]}>{t('no_messages_yet')}</Text>
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('type_a_message')}
              placeholderTextColor={Colors.text.tertiary}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { opacity: inputText.trim() && !sending ? 1 : 0.4 },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.text.primary} />
              ) : (
                <Text style={[styles.sendBtnText, { color: CMC.text.primary }]}>{t('send')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Portfolio Viewer Modal */}
        <Modal visible={viewPortfolioVisible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg }}>
            <View style={{ width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: CMC.bg.secondary, borderRadius: Radius.xl, borderWidth: 1, borderColor: CMC.border.default }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: CMC.border.default }}>
                <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: CMC.text.primary }}>
                  {room?.name ?? 'Friend'}'s Portfolio
                </Text>
                <TouchableOpacity onPress={() => { setViewPortfolioVisible(false); setViewedPortfolio(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 20, color: CMC.text.tertiary }}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: Spacing.lg }} showsVerticalScrollIndicator={false}>
                {viewedPortfolio && (
                  <>
                    <View style={{ marginBottom: Spacing.lg }}>
                      <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold, color: CMC.text.primary }}>
                        {formatCurrency(viewedPortfolio.totalValue ?? 0)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <Text style={{
                          fontSize: FontSize.base, fontWeight: FontWeight.bold,
                          color: (viewedPortfolio.totalGainLoss ?? 0) >= 0 ? Colors.market.gain : Colors.market.loss,
                        }}>
                          {(viewedPortfolio.totalGainLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(viewedPortfolio.totalGainLoss ?? 0)}
                        </Text>
                        <Text style={{
                          fontSize: FontSize.sm,
                          color: (viewedPortfolio.totalGainLoss ?? 0) >= 0 ? Colors.market.gain : Colors.market.loss,
                        }}>
                          ({(viewedPortfolio.totalGainLossPercent ?? 0) >= 0 ? '+' : ''}{(viewedPortfolio.totalGainLossPercent ?? 0).toFixed(2)}%)
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: CMC.border.default }}>
                      <Text style={{ fontSize: FontSize.sm, color: CMC.text.secondary }}>Cash Balance</Text>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: CMC.text.primary }}>
                        {formatCurrency(viewedPortfolio.cashBalance ?? 0)}
                      </Text>
                    </View>

                    <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: CMC.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                      Holdings ({(viewedPortfolio.holdings ?? []).length})
                    </Text>
                    {(viewedPortfolio.holdings ?? []).length === 0 ? (
                      <Text style={{ fontSize: FontSize.sm, color: CMC.text.tertiary, fontStyle: 'italic' }}>No holdings</Text>
                    ) : (
                      (viewedPortfolio.holdings as Holding[]).map((h: Holding, i: number) => (
                        <View key={h.symbol + i} style={{
                          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                          paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: CMC.border.default,
                        }}>
                          <View>
                            <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: CMC.text.primary }}>{h.symbol}</Text>
                            <Text style={{ fontSize: FontSize.xs, color: CMC.text.tertiary }}>{h.shares} shares</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: CMC.text.primary }}>
                              {formatCurrency(h.currentValue ?? 0)}
                            </Text>
                            <Text style={{
                              fontSize: FontSize.xs,
                              color: (h.gainLoss ?? 0) >= 0 ? Colors.market.gain : Colors.market.loss,
                            }}>
                              {(h.gainLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(h.gainLoss ?? 0)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                    <View style={{ height: Spacing.lg }} />
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </Modal>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

function MessagesTab() {
  const t = useT();
  const { chatRooms, user, clubInvites, removeClubInvite, addMyClub, appColorMode } = useAppStore();
  const MC = appColorMode === 'light' ? LightColors : Colors;
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [joiningInviteId, setJoiningInviteId] = useState<string | null>(null);

  // Fetch pending invites directly from Firestore when this tab mounts
  useEffect(() => {
    if (!user?.id) return;
    console.log('[MessagesTab] Fetching invites for user:', user.id);
    fetchPendingInvites(user.id).then((invites) => {
      const typed = invites as Array<{ id: string; type?: string; clubId?: string; clubName?: string; fromUserId: string; fromUsername: string; sentAt: number }>;
      console.log('[MessagesTab] Got invites:', typed.length);
      // Always set state (even if empty) to ensure fresh data
      useAppStore.setState({
        clubInvites: typed.map(inv => ({
          id: inv.id,
          type: (inv.type === 'friend_request' ? 'friend_request' : 'club_invite') as 'club_invite' | 'friend_request',
          clubId: inv.clubId,
          clubName: inv.clubName,
          fromUserId: inv.fromUserId,
          fromUsername: inv.fromUsername,
          sentAt: inv.sentAt,
        })),
      });
    }).catch((err) => {
      console.error('[MessagesTab] Failed to fetch invites:', err);
    });
  }, [user?.id]);

  const openRoom = (room: ChatRoom) => {
    setActiveChatRoom(room);
    setChatModalVisible(true);
  };

  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  // Resolve DM partner usernames
  useEffect(() => {
    if (!user?.id || chatRooms.length === 0) return;
    const dmRooms = chatRooms.filter(r => r.type === 'dm' && !r.name);
    const unknownIds = dmRooms
      .map(r => r.participantIds.find(id => id !== user.id))
      .filter((id): id is string => !!id && !roomNames[id]);
    if (unknownIds.length === 0) return;
    Promise.all(unknownIds.map(id => getUserById(id))).then(users => {
      const names: Record<string, string> = {};
      users.forEach((u: any, i) => {
        if (u?.username) names[unknownIds[i]] = u.username;
        else if (u?.displayName) names[unknownIds[i]] = u.displayName;
      });
      if (Object.keys(names).length > 0) setRoomNames(prev => ({ ...prev, ...names }));
    }).catch(() => {});
  }, [chatRooms, user?.id]);

  const getRoomDisplayName = (room: ChatRoom): string => {
    if (room.name) return room.name;
    if (room.type === 'dm') {
      const otherId = room.participantIds.find((id) => id !== user?.id);
      if (otherId && roomNames[otherId]) return roomNames[otherId];
      return otherId ? `Player` : 'Direct Message';
    }
    return 'Chat Room';
  };

  const handleAcceptInvite = async (invite: ClubInvite) => {
    if (!user) return;
    setJoiningInviteId(invite.id);
    try {
      // Mark invite as accepted FIRST so the listener removes it immediately
      const { updateInviteStatus } = await import('../../src/services/auth');
      await updateInviteStatus(invite.id, 'accepted');
      removeClubInvite(invite.id);

      if (invite.type === 'club_invite' && invite.clubId) {
        const { joinClub: joinClubFn, getClub } = await import('../../src/services/auth');
        await joinClubFn(user.id, invite.clubId);
        // Fetch the full club data to get accurate memberIds
        let clubData: any = null;
        try { clubData = await getClub(invite.clubId); } catch {}
        const club = clubData ?? {
          id: invite.clubId,
          name: invite.clubName ?? 'Club',
          description: '',
          ownerId: invite.fromUserId,
          memberIds: [invite.fromUserId, user.id],
          isPublic: false,
          createdAt: invite.sentAt,
          chatRoomId: `chat_${invite.clubId}`,
        };
        addMyClub(club);
        // Update local user clubIds so the clubs tab refreshes
        const { setUser: su } = useAppStore.getState();
        su({ ...user, clubIds: [...(user.clubIds || []), invite.clubId] });
      } else if (invite.type === 'friend_request') {
        const { addFriend } = await import('../../src/services/auth');
        await addFriend(user.id, invite.fromUserId);
        // Update local user state so friends list refreshes
        const { setUser } = useAppStore.getState();
        setUser({ ...user, friendIds: [...(user.friendIds || []), invite.fromUserId] });
      }
    } catch (err) {
      console.error('Failed to accept invite:', err);
    } finally {
      setJoiningInviteId(null);
    }
  };

  const handleDeclineInvite = async (invite: ClubInvite) => {
    removeClubInvite(invite.id);
    try {
      const { updateInviteStatus } = await import('../../src/services/auth');
      await updateInviteStatus(invite.id, 'declined');
    } catch {}
  };

  const renderRoom = ({ item }: { item: ChatRoom }) => {
    const displayName = getRoomDisplayName(item);
    const lastMsg = item.lastMessage;
    const isUnread = lastMsg && lastMsg.senderId !== user?.id;
    return (
      <TouchableOpacity style={[styles.roomRow, { backgroundColor: MC.bg.primary }]} onPress={() => openRoom(item)}>
        <View>
          <InitialsAvatar name={displayName} />
          {isUnread && (
            <View style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.brand.primary, borderWidth: 2, borderColor: MC.bg.primary }} />
          )}
        </View>
        <View style={styles.roomInfo}>
          <View style={styles.roomHeaderRow}>
            <Text style={[styles.roomName, { color: MC.text.primary, fontWeight: isUnread ? FontWeight.bold : FontWeight.semibold }]} numberOfLines={1}>
              {displayName}
            </Text>
            {lastMsg && (
              <Text style={[styles.roomTime, { color: MC.text.tertiary }]}>
                {formatRelativeTime(lastMsg.timestamp)}
              </Text>
            )}
          </View>
          <Text style={[styles.roomLastMsg, { color: MC.text.secondary }]} numberOfLines={1}>
            {lastMsg
              ? lastMsg.type === 'trade_proposal'
                ? '📊 Trade Proposal'
                : lastMsg.text
              : 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 32 }}>

      {/* ── Pending Invites ── */}
        <View style={[styles.inviteSection, { borderBottomColor: MC.border.default }]}>
          <Text style={[styles.inviteSectionLabel, { color: MC.text.secondary }]}>📬  {t('invites')}</Text>
          {clubInvites.length === 0 && (
            <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
              <Text style={{ color: MC.text.tertiary, fontSize: 13, textAlign: 'center' }}>{t('no_pending_invites')}</Text>
            </View>
          )}
          {clubInvites.map((invite) => (
            <View key={invite.id} style={[styles.inviteCard, { backgroundColor: MC.bg.secondary }]}>
              <View style={styles.inviteIconWrap}>
                <Text style={styles.inviteIcon}>
                  {invite.type === 'friend_request' ? '👤' : '🏠'}
                </Text>
              </View>
              <View style={styles.inviteInfo}>
                <Text style={[styles.inviteTitle, { color: MC.text.primary }]} numberOfLines={1}>
                  {invite.type === 'friend_request'
                    ? `${invite.fromUsername} wants to be friends`
                    : `${invite.fromUsername} invited you to "${invite.clubName}"`}
                </Text>
                <Text style={[styles.inviteSubtitle, { color: MC.text.tertiary }]}>
                  {invite.type === 'friend_request'
                    ? `Friend request · ${formatRelativeTime(invite.sentAt)}`
                    : `Club invite · ${formatRelativeTime(invite.sentAt)}`}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.inviteActionBtn, styles.inviteAcceptBtn]}
                onPress={() => handleAcceptInvite(invite)}
                disabled={joiningInviteId === invite.id}
              >
                {joiningInviteId === invite.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.inviteAcceptText}>✓</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteActionBtn, styles.inviteDeclineBtn]}
                onPress={() => handleDeclineInvite(invite)}
              >
                <Text style={styles.inviteDeclineText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

      {/* ── Chat Rooms ── */}
      {chatRooms.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>💬</Text>
          <Text style={[styles.emptyStateTitle, { color: MC.text.primary }]}>{t('no_conversations_yet')}</Text>
          <Text style={[styles.emptyStateSubtitle, { color: MC.text.secondary }]}>
            Find friends or join clubs to start chatting
          </Text>
        </View>
      ) : chatRooms.length > 0 ? (
        <>
          {chatRooms.map((room) => (
            <React.Fragment key={room.id}>
              {renderRoom({ item: room })}
              <View style={styles.separator} />
            </React.Fragment>
          ))}
        </>
      ) : null}

      <ChatModal
        visible={chatModalVisible}
        room={activeChatRoom}
        onClose={() => setChatModalVisible(false)}
      />
    </ScrollView>
  );
}

// ─── Clubs Tab ────────────────────────────────────────────────────────────────

function ClubsTab() {
  const { user, chatRooms, setChatRooms, myClubs, setMyClubs, addMyClub, appColorMode } = useAppStore();
  const CC = appColorMode === 'light' ? LightColors : Colors;
  const [publicClubs, setPublicClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDesc, setClubDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [activeClub, setActiveClub] = useState<Club | null>(null);

  // ── Invite state ──
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteClub, setInviteClub] = useState<Club | null>(null);
  const [invitePlayerNum, setInvitePlayerNum] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  // ── Edit club state ──
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editClub, setEditClub] = useState<Club | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clubChatVisible, setClubChatVisible] = useState(false);

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    setLoading(true);
    try {
      const userClubIds = user?.clubIds ?? [];
      // Fetch user's clubs directly by their IDs (includes private clubs)
      const [myClubsData, publicClubs] = await Promise.all([
        userClubIds.length > 0 ? getClubsByIds(userClubIds) : Promise.resolve([]),
        getPublicClubs(),
      ]);
      if (myClubsData.length > 0) {
        setMyClubs(myClubsData as Club[]);
      }
      // Discover = public clubs the user hasn't joined
      const myIds = new Set(userClubIds);
      setPublicClubs((publicClubs as Club[]).filter(c => !myIds.has(c.id)));
    } catch (_) {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClub = async () => {
    if (!clubName.trim() || !user) return;
    setCreating(true);
    try {
      const club = await createClub(user.id, clubName.trim(), clubDesc.trim(), isPublic) as Club;
      setCreateModalVisible(false);
      setClubName('');
      setClubDesc('');
      if (club?.id) {
        addMyClub(club);
      } else {
        await loadClubs();
      }
    } catch (_) {
      // silently fail
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (club: Club) => {
    if (!user) return;
    setJoiningId(club.id);
    try {
      await joinClub(user.id, club.id);
      // Move from discover list to my clubs in store (with updated memberIds)
      addMyClub({ ...club, memberIds: [...(club.memberIds || []), user.id] });
      setPublicClubs(prev => prev.filter(c => c.id !== club.id));
      // Also update user's clubIds locally
      const { setUser } = useAppStore.getState();
      if (user) {
        setUser({ ...user, clubIds: [...(user.clubIds || []), club.id] });
      }
    } catch (err) {
      console.error('Failed to join club:', err);
      Alert.alert('Error', 'Failed to join club. Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleSendInvite = async () => {
    if (!user || !inviteClub || !invitePlayerNum.trim()) return;
    setInviting(true);
    setInviteFeedback(null);
    const result = await sendClubInvite(
      user.id,
      user.username ?? user.displayName ?? 'A member',
      invitePlayerNum.trim(),
      inviteClub.id,
      inviteClub.name,
    );
    if (result.success) {
      setInviteFeedback('✓ Invite sent!');
      setInvitePlayerNum('');
      setTimeout(() => {
        setInviteModalVisible(false);
        setInviteFeedback(null);
      }, 1200);
    } else {
      setInviteFeedback(result.error ?? 'Player not found');
    }
    setInviting(false);
  };

  const handleSaveEdit = () => {
    if (!editClub || !editName.trim()) return;
    setSaving(true);
    // Update locally in the store (real apps would persist to Firebase)
    const updated: Club = { ...editClub, name: editName.trim(), description: editDesc.trim(), isPublic: editIsPublic };
    setMyClubs((prev: Club[]) => prev.map(c => c.id === updated.id ? updated : c));
    setSaving(false);
    setEditModalVisible(false);
  };

  const renderClub = (club: Club, isMember: boolean) => (
    <View key={club.id} style={[styles.clubCard, { backgroundColor: CC.bg.secondary, borderColor: CC.border.default }]}>
      <View style={styles.clubCardHeader}>
        <InitialsAvatar name={club.name} color={Colors.brand.accent} />
        <View style={styles.clubCardInfo}>
          <Text style={[styles.clubName, { color: CC.text.primary }]}>{club.name}</Text>
          <Text style={[styles.clubMemberCount, { color: CC.text.tertiary }]}>
            {club.memberIds?.length ?? 0} members
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {/* Add member button — only shown for clubs you're in */}
          {isMember && (
            <TouchableOpacity
              style={[styles.clubActionBtn, { backgroundColor: Colors.brand.gold + '22', borderColor: Colors.brand.gold }]}
              onPress={() => { setInviteClub(club); setInviteModalVisible(true); }}
            >
              <Text style={[styles.clubActionBtnText, { color: Colors.brand.gold }]}>+ Add</Text>
            </TouchableOpacity>
          )}
          {/* Edit button — only shown for club owner */}
          {isMember && club.ownerId === user?.id && (
            <TouchableOpacity
              style={[styles.clubActionBtn, { backgroundColor: Colors.brand.primary + '22', borderColor: Colors.brand.primary }]}
              onPress={() => { setEditClub(club); setEditModalVisible(true); setEditName(club.name); setEditDesc(club.description); setEditIsPublic(club.isPublic); }}
            >
              <Text style={[styles.clubActionBtnText, { color: Colors.brand.primary }]}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.clubActionBtn,
              isMember
                ? { backgroundColor: Colors.brand.accent + '22', borderColor: Colors.brand.accent }
                : { backgroundColor: Colors.brand.primary + '22', borderColor: Colors.brand.primary },
            ]}
            onPress={() => {
              if (isMember) {
                setActiveClub(club);
                setClubChatVisible(true);
              } else {
                handleJoin(club);
              }
            }}
            disabled={joiningId === club.id}
          >
            {joiningId === club.id ? (
              <ActivityIndicator size="small" color={Colors.brand.primary} />
            ) : (
              <Text
                style={[
                  styles.clubActionBtnText,
                  { color: isMember ? Colors.brand.accent : Colors.brand.primary },
                ]}
              >
                {isMember ? 'Enter' : 'Join'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {club.description ? (
        <Text style={[styles.clubDescription, { color: CC.text.secondary }]} numberOfLines={2}>
          {club.description}
        </Text>
      ) : null}
      {/* Leave button — for non-owner members */}
      {isMember && club.ownerId !== user?.id && (
        <TouchableOpacity
          style={{ marginTop: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.base, borderRadius: Radius.md, backgroundColor: Colors.market.loss + '15', borderWidth: 1, borderColor: Colors.market.loss + '44', alignSelf: 'flex-start' }}
          onPress={async () => {
            const confirmed = Platform.OS === 'web'
              ? window.confirm(`Are you sure you want to leave "${club.name}"?`)
              : false;
            if (!confirmed || !user) return;
            try {
              const { leaveClub: leaveClubFn } = await import('../../src/services/firebase');
              await leaveClubFn(club.id, user.id);
              setMyClubs((prev: Club[]) => prev.filter(c => c.id !== club.id));
              const { setUser: su } = useAppStore.getState();
              su({ ...user, clubIds: (user.clubIds || []).filter(id => id !== club.id) });
            } catch (err) {
              console.error('Failed to leave club:', err);
            }
          }}
        >
          <Text style={{ color: Colors.market.loss, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>Leave Club</Text>
        </TouchableOpacity>
      )}
      {/* Delete button — only for club owner */}
      {isMember && club.ownerId === user?.id && (
        <TouchableOpacity
          style={{ marginTop: Spacing.sm, paddingVertical: 8, paddingHorizontal: Spacing.base, borderRadius: Radius.md, backgroundColor: Colors.market.loss + '15', borderWidth: 1, borderColor: Colors.market.loss + '44', alignSelf: 'flex-start' }}
          onPress={async () => {
            const confirmed = Platform.OS === 'web'
              ? window.confirm(`Are you sure you want to delete "${club.name}"? This cannot be undone.`)
              : false;
            if (!confirmed || !user) return;
            try {
              await deleteClub(club.id, user.id);
              setMyClubs((prev: Club[]) => prev.filter(c => c.id !== club.id));
              const { setUser: su } = useAppStore.getState();
              su({ ...user, clubIds: (user.clubIds || []).filter(id => id !== club.id) });
            } catch (err) {
              console.error('Failed to delete club:', err);
            }
          }}
        >
          <Text style={{ color: Colors.market.loss, fontSize: FontSize.xs, fontWeight: FontWeight.semibold }}>Delete Club</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 32 }}>
      <TouchableOpacity
        style={styles.createClubBtn}
        onPress={() => setCreateModalVisible(true)}
      >
        <Text style={styles.createClubBtnText}>+ Create Club</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={Colors.brand.primary} style={{ marginTop: 32 }} />
      ) : (
        <>
          <Text style={[styles.sectionLabel, { color: CC.text.secondary }]}>My Clubs</Text>
          {myClubs.length === 0 ? (
            <Text style={[styles.emptyText, { color: CC.text.tertiary }]}>You haven't joined any clubs yet.</Text>
          ) : (
            myClubs.map((c) => renderClub(c, true))
          )}

          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg, color: CC.text.secondary }]}>Discover</Text>
          {publicClubs.length === 0 ? (
            <Text style={[styles.emptyText, { color: CC.text.tertiary }]}>No public clubs found.</Text>
          ) : (
            publicClubs.map((c) => renderClub(c, false))
          )}
        </>
      )}

      {/* Club Chat Modal */}
      <ChatModal
        visible={clubChatVisible}
        room={activeClub ? {
          id: activeClub.chatRoomId,
          type: 'club',
          name: activeClub.name,
          participantIds: activeClub.memberIds ?? [],
          updatedAt: Date.now(),
        } : null}
        onClose={() => { setClubChatVisible(false); setActiveClub(null); }}
        club={activeClub ?? undefined}
      />

      {/* Create Club Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, { color: CC.text.primary }]}>Create a Club</Text>

            <Text style={[styles.fieldLabel, { color: CC.text.secondary }]}>Club Name</Text>
            <TextInput
              style={styles.modalInput}
              value={clubName}
              onChangeText={setClubName}
              placeholder="e.g. Tech Bulls"
              placeholderTextColor={Colors.text.tertiary}
              maxLength={40}
            />

            <Text style={[styles.fieldLabel, { color: CC.text.secondary }]}>Description</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={clubDesc}
              onChangeText={setClubDesc}
              placeholder="Describe your club..."
              placeholderTextColor={Colors.text.tertiary}
              multiline
              maxLength={200}
            />

            <View style={styles.toggleRow}>
              <Text style={[styles.fieldLabel, { color: CC.text.secondary }]}>Public Club</Text>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.bg.tertiary, true: Colors.brand.primary + '88' }}
                thumbColor={isPublic ? Colors.brand.primary : Colors.text.tertiary}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: CC.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { opacity: clubName.trim() && !creating ? 1 : 0.4 },
                ]}
                onPress={handleCreateClub}
                disabled={!clubName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={Colors.text.primary} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: CC.text.primary }]}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Club Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, { color: CC.text.primary }]}>✏️  Edit Club</Text>
            <Text style={[styles.fieldLabel, { color: CC.text.secondary }]}>Club Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Club name..."
              placeholderTextColor={Colors.text.tertiary}
              maxLength={40}
            />
            <Text style={[styles.fieldLabel, { color: CC.text.secondary }]}>Description</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Describe your club..."
              placeholderTextColor={Colors.text.tertiary}
              multiline
              maxLength={200}
            />
            <View style={styles.toggleRow}>
              <Text style={[styles.fieldLabel, { color: CC.text.secondary }]}>Public Club</Text>
              <Switch
                value={editIsPublic}
                onValueChange={setEditIsPublic}
                trackColor={{ false: Colors.bg.tertiary, true: Colors.brand.primary + '88' }}
                thumbColor={editIsPublic ? Colors.brand.primary : Colors.text.tertiary}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: CC.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { opacity: editName.trim() && !saving ? 1 : 0.4 }]}
                onPress={handleSaveEdit}
                disabled={!editName.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.text.primary} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: CC.text.primary }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Invite Player Modal ── */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setInviteModalVisible(false); setInviteFeedback(null); setInvitePlayerNum(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={[styles.modalTitle, { color: CC.text.primary }]}>
              ➕  Invite to {inviteClub?.name ?? 'Club'}
            </Text>
            <Text style={[styles.fieldLabel, { color: CC.text.secondary }]}>Player Number</Text>
            <TextInput
              style={styles.modalInput}
              value={invitePlayerNum}
              onChangeText={setInvitePlayerNum}
              placeholder="Enter player number..."
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="default"
              autoCapitalize="none"
            />
            {inviteFeedback && (
              <Text style={[
                styles.inviteFeedbackText,
                { color: inviteFeedback.startsWith('✓') ? Colors.market.gain : Colors.market.loss },
              ]}>
                {inviteFeedback}
              </Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setInviteModalVisible(false); setInviteFeedback(null); setInvitePlayerNum(''); }}
              >
                <Text style={[styles.modalCancelText, { color: CC.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { opacity: invitePlayerNum.trim() && !inviting ? 1 : 0.4 }]}
                onPress={handleSendInvite}
                disabled={!invitePlayerNum.trim() || inviting}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color={Colors.text.primary} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: CC.text.primary }]}>Send Invite</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Find Friends Tab ─────────────────────────────────────────────────────────

function FindFriendsTab() {
  const t = useT();
  const { user, chatRooms, setChatRooms, appColorMode } = useAppStore();
  const FC = appColorMode === 'light' ? LightColors : Colors;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [friendAccountNum, setFriendAccountNum] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [addFriendFeedback, setAddFriendFeedback] = useState<string | null>(null);

  // ── Chat modal state ──
  const [friendChatRoom, setFriendChatRoom] = useState<ChatRoom | null>(null);
  const [friendChatVisible, setFriendChatVisible] = useState(false);

  // ── Load friends list ──
  const [friends, setFriends] = useState<UserResult[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // ── Portfolio viewer state ──
  const [viewPortfolioVisible, setViewPortfolioVisible] = useState(false);
  const [viewedPortfolio, setViewedPortfolio] = useState<any>(null);
  const [viewedFriendName, setViewedFriendName] = useState('');
  const [portfolioLoadingId, setPortfolioLoadingId] = useState<string | null>(null);
  // Map of friendId -> privacy meta. Used to hide the "Portfolio" button
  // for friends whose portfolio is private (or unknown).
  type PrivacyMeta = {
    privacy: 'public' | 'friends_only' | 'specific_friends' | 'private';
    allowedAccountNumbers?: string[];
    ownerFriendIds?: string[];
  };
  const [friendPrivacyMap, setFriendPrivacyMap] = useState<Record<string, PrivacyMeta | null>>({});

  const viewerAccountNumber = (user as any)?.accountNumber as string | undefined;
  const canViewFriendPortfolio = useCallback(
    (friendId: string): boolean => {
      if (!user) return false;
      const meta = friendPrivacyMap[friendId];
      if (!meta) return false;
      if (meta.privacy === 'public') return true;
      if (meta.privacy === 'friends_only') return (meta.ownerFriendIds ?? []).includes(user.id);
      if (meta.privacy === 'specific_friends') {
        if (!viewerAccountNumber) return false;
        return (meta.allowedAccountNumbers ?? []).includes(viewerAccountNumber);
      }
      return false;
    },
    [user, friendPrivacyMap, viewerAccountNumber],
  );

  const handleViewFriendPortfolio = async (friend: UserResult) => {
    if (!user || portfolioLoadingId) return;
    // Defence-in-depth: don't even attempt the fetch if the gate says no.
    if (!canViewFriendPortfolio(friend.id)) return;
    setPortfolioLoadingId(friend.id);
    try {
      const { getFriendsPortfolio } = await import('../../src/services/firebase');
      const data = await getFriendsPortfolio(friend.id, user.id, viewerAccountNumber);
      if (data) {
        setViewedPortfolio(data);
        setViewedFriendName(friend.displayName);
        setViewPortfolioVisible(true);
      } else if (typeof window !== 'undefined') {
        window.alert("This player's portfolio is private");
      }
    } catch {
      if (typeof window !== 'undefined') window.alert("Could not load portfolio");
    }
    setPortfolioLoadingId(null);
  };

  useEffect(() => {
    if (!user?.friendIds?.length) {
      setFriends([]);
      setFriendPrivacyMap({});
      return;
    }
    let cancelled = false;
    setLoadingFriends(true);
    Promise.all(
      user.friendIds.map(async (fid) => {
        try {
          const u = await getUserById(fid);
          return u as UserResult | null;
        } catch {
          return null;
        }
      })
    ).then(async (results) => {
      if (cancelled) return;
      const friendList = results.filter(Boolean) as UserResult[];
      setFriends(friendList);
      setLoadingFriends(false);

      // Prefetch each friend's portfolio privacy meta so the UI can hide
      // the "Portfolio" action for friends who have set their portfolio
      // to private (or don't allow this viewer).
      try {
        const { getPortfolioPrivacyMeta } = await import('../../src/services/firebase');
        const metas = await Promise.all(
          friendList.map(async (f) => {
            try { return [f.id, await getPortfolioPrivacyMeta(f.id)] as const; }
            catch { return [f.id, null] as const; }
          })
        );
        if (cancelled) return;
        const next: Record<string, PrivacyMeta | null> = {};
        for (const [id, meta] of metas) next[id] = meta;
        setFriendPrivacyMap(next);
      } catch {
        if (!cancelled) setFriendPrivacyMap({});
      }
    });
    return () => { cancelled = true; };
  }, [user?.friendIds]);

  const handleAddFriend = async () => {
    if (!user || !friendAccountNum.trim() || friendAccountNum.trim().length !== 8) {
      setAddFriendFeedback('Enter a valid 8-digit account number');
      return;
    }
    setAddingFriend(true);
    setAddFriendFeedback(null);
    try {
      const result = await sendFriendRequest(
        user.id,
        user.username ?? user.displayName ?? 'A player',
        friendAccountNum.trim(),
      );
      console.log('[AddFriend] Result:', JSON.stringify(result), 'from:', user.id, 'to account:', friendAccountNum.trim());
      if (result.success) {
        setAddFriendFeedback('✓ Friend request sent!');
        setFriendAccountNum('');
        setTimeout(() => { setAddFriendModalVisible(false); setAddFriendFeedback(null); }, 1200);
      } else {
        setAddFriendFeedback(result.error ?? 'Player not found');
      }
    } catch (err) {
      console.error('[AddFriend] Error:', err);
      setAddFriendFeedback('Error: ' + String(err));
    }
    setAddingFriend(false);
  };

  useEffect(() => {
    if (!user) return;
    // Listen to incoming trade proposals would go here via listenToTradeProposals
    // For now show empty state
  }, [user]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        let results: UserResult[] = [];
        if (/^\d{8}$/.test(text.trim())) {
          const found = await findUserByAccountNumber(text.trim());
          if (found) results = [found as UserResult];
        } else {
          const found = await searchUsers(text.trim());
          results = found as UserResult[];
        }
        setSearchResults(results.filter((r) => r.id !== user?.id));
      } catch (_) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [user]);

  const handleSendMessage = async (targetUser: UserResult) => {
    if (!user) return;
    try {
      const room = await createDMRoom(user.id, targetUser.id);
      const chatRoom: ChatRoom = {
        id: room.id,
        type: 'dm',
        participantIds: [user.id, targetUser.id],
        name: targetUser.displayName,
        updatedAt: Date.now(),
      };
      setFriendChatRoom(chatRoom);
      setFriendChatVisible(true);
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  const handleRemoveFriend = async (targetUser: UserResult) => {
    if (!user) return;
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to remove ${targetUser.displayName} from your friends?`)
      : await new Promise<boolean>(resolve => {
          Alert.alert(
            'Remove Friend',
            `Are you sure you want to remove ${targetUser.displayName} from your friends?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
    if (!confirmed) return;
    try {
      await removeFriend(user.id, targetUser.id);
      const { setUser } = useAppStore.getState();
      setUser({ ...user, friendIds: (user.friendIds || []).filter(id => id !== targetUser.id) });
    } catch (err) {
      console.error('Failed to remove friend:', err);
    }
  };

  const handleSendFriendRequest = async (targetUser: UserResult) => {
    if (!user) return;
    const result = await sendFriendRequest(
      user.id,
      user.username ?? user.displayName ?? 'A player',
      targetUser.accountNumber,
    );
    if (result.success) {
      Alert.alert('Sent', `Friend request sent to ${targetUser.displayName}!`);
    } else {
      Alert.alert('Error', result.error ?? 'Failed to send friend request');
    }
  };

  const handleRespondToProposal = async (
    proposal: TradeProposal,
    status: 'accepted' | 'declined'
  ) => {
    setRespondingId(proposal.id);
    try {
      await respondToTradeProposal(proposal.id, status);
      setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
    } catch (_) {
      // silently fail
    } finally {
      setRespondingId(null);
    }
  };

  const getLevelColor = (level: number): string => {
    const colors = [
      '#94A3B8', '#60A5FA', '#34D399', '#F59E0B', '#F97316',
      '#EF4444', '#8B5CF6', '#EC4899', '#F5C518', '#00D4AA',
    ];
    return colors[Math.min(level - 1, colors.length - 1)] ?? '#94A3B8';
  };

  return (
    <>
    <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: FC.bg.input, borderColor: FC.border.default, color: FC.text.primary }]}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder={t('search_placeholder')}
          placeholderTextColor={FC.text.tertiary}
          clearButtonMode="while-editing"
        />
        {searching && (
          <ActivityIndicator
            size="small"
            color={Colors.brand.primary}
            style={{ marginLeft: Spacing.sm }}
          />
        )}
        <TouchableOpacity
          style={{ marginLeft: Spacing.sm, backgroundColor: Colors.brand.accent + '22', borderWidth: 1, borderColor: Colors.brand.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, justifyContent: 'center' }}
          onPress={() => setAddFriendModalVisible(true)}
        >
          <Text style={{ color: Colors.brand.accent, fontSize: FontSize.sm, fontWeight: FontWeight.semibold }}>{t('add_friend')}</Text>
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <View>
          <Text style={[styles.sectionLabel, { color: FC.text.secondary }]}>{t('results')}</Text>
          {searchResults.map((u) => (
            <View key={u.id} style={[styles.userCard, { backgroundColor: FC.bg.secondary, borderColor: FC.border.default }]}>
              <InitialsAvatar name={u.displayName} />
              <View style={styles.userCardInfo}>
                <View style={styles.userCardNameRow}>
                  <Text style={[styles.userDisplayName, { color: FC.text.primary }]}>{u.displayName}</Text>
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: getLevelColor(u.level) + '22' },
                    ]}
                  >
                    <Text style={[styles.levelBadgeText, { color: getLevelColor(u.level) }]}>
                      Lv {u.level}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.userUsername, { color: FC.text.secondary }]}>@{u.username}</Text>
                <Text style={[styles.userAccountNum, { color: FC.text.tertiary }]}>#{u.accountNumber}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity
                  style={styles.sendMsgBtn}
                  onPress={() => handleSendMessage(u)}
                >
                  <Text style={styles.sendMsgBtnText}>{t('message')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendMsgBtn, { backgroundColor: Colors.brand.accent + '22', borderColor: Colors.brand.accent }]}
                  onPress={() => handleSendFriendRequest(u)}
                >
                  <Text style={[styles.sendMsgBtnText, { color: Colors.brand.accent }]}>+ Friend</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {searchQuery && !searching && searchResults.length === 0 && (
        <Text style={[styles.emptyText, { color: FC.text.tertiary }]}>{t('no_users_found')}</Text>
      )}

      {/* ── Friends List ── */}
      <Text style={[styles.sectionLabel, { marginTop: Spacing.lg, color: FC.text.secondary }]}>
        Friends ({friends.length})
      </Text>
      {loadingFriends ? (
        <ActivityIndicator size="small" color={Colors.brand.primary} style={{ marginVertical: Spacing.base }} />
      ) : friends.length === 0 ? (
        <Text style={[styles.emptyText, { color: FC.text.tertiary }]}>No friends yet. Search for players or enter their account number to add them!</Text>
      ) : (
        friends.map((f) => (
          <View key={f.id} style={[styles.userCard, { backgroundColor: FC.bg.secondary, borderColor: FC.border.default }]}>
            <InitialsAvatar name={f.displayName} color={Colors.brand.accent} />
            <View style={styles.userCardInfo}>
              <View style={styles.userCardNameRow}>
                <Text style={[styles.userDisplayName, { color: FC.text.primary }]}>{f.displayName}</Text>
                {f.level > 0 && (
                  <View style={[styles.levelBadge, { backgroundColor: getLevelColor(f.level) + '22' }]}>
                    <Text style={[styles.levelBadgeText, { color: getLevelColor(f.level) }]}>Lv {f.level}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.userUsername, { color: FC.text.secondary }]}>@{f.username}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[styles.sendMsgBtn, { backgroundColor: Colors.brand.primary + '22', borderColor: Colors.brand.primary }]}
                onPress={() => handleSendMessage(f)}
              >
                <Text style={[styles.sendMsgBtnText, { color: Colors.brand.primary }]}>Chat</Text>
              </TouchableOpacity>
              {canViewFriendPortfolio(f.id) && (
                <TouchableOpacity
                  style={[styles.sendMsgBtn, { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary }]}
                  onPress={() => handleViewFriendPortfolio(f)}
                  disabled={portfolioLoadingId === f.id}
                >
                  {portfolioLoadingId === f.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.sendMsgBtnText, { color: '#FFFFFF' }]}>Portfolio</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.sendMsgBtn, { backgroundColor: Colors.market.loss + '22', borderColor: Colors.market.loss }]}
                onPress={() => handleRemoveFriend(f)}
              >
                <Text style={[styles.sendMsgBtnText, { color: Colors.market.loss }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={[styles.sectionLabel, { marginTop: Spacing.lg, color: FC.text.secondary }]}>
        {t('trade_proposals')}
      </Text>
      {proposals.length === 0 ? (
        <Text style={[styles.emptyText, { color: FC.text.tertiary }]}>No pending proposals.</Text>
      ) : (
        proposals.map((proposal) => (
          <View key={proposal.id} style={[styles.proposalCard, { backgroundColor: FC.bg.secondary, borderColor: FC.border.default }]}>
            <Text style={[styles.proposalTitle, { color: FC.text.primary }]}>
              {proposal.type.toUpperCase()} {proposal.symbol}
            </Text>
            <View style={styles.proposalRow}>
              <Text style={styles.proposalLabel}>Shares</Text>
              <Text style={styles.proposalValue}>{formatShares(proposal.shares)}</Text>
            </View>
            <View style={styles.proposalRow}>
              <Text style={styles.proposalLabel}>Price</Text>
              <Text style={styles.proposalValue}>{formatCurrency(proposal.pricePerShare)}</Text>
            </View>
            <View style={[styles.proposalRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.proposalLabel}>Total</Text>
              <Text style={[styles.proposalValue, { fontWeight: FontWeight.bold }]}>
                {formatCurrency(proposal.total)}
              </Text>
            </View>
            <View style={styles.proposalActions}>
              <TouchableOpacity
                style={[
                  styles.proposalBtn,
                  {
                    backgroundColor: Colors.market.gain + '22',
                    borderColor: Colors.market.gain,
                    opacity: respondingId === proposal.id ? 0.5 : 1,
                  },
                ]}
                onPress={() => handleRespondToProposal(proposal, 'accepted')}
                disabled={respondingId === proposal.id}
              >
                <Text style={[styles.proposalBtnText, { color: Colors.market.gain }]}>
                  {t('accept')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.proposalBtn,
                  {
                    backgroundColor: Colors.market.loss + '22',
                    borderColor: Colors.market.loss,
                    opacity: respondingId === proposal.id ? 0.5 : 1,
                  },
                ]}
                onPress={() => handleRespondToProposal(proposal, 'declined')}
                disabled={respondingId === proposal.id}
              >
                <Text style={[styles.proposalBtnText, { color: Colors.market.loss }]}>
                  {t('decline')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>

    {/* Add Friend Modal */}
    <Modal visible={addFriendModalVisible} animationType="fade" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: FC.bg.secondary, borderRadius: Radius.xl, padding: Spacing.xl, width: '85%', maxWidth: 360 }}>
          <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: FC.text.primary, marginBottom: Spacing.md }}>{t('add_friend')}</Text>
          <Text style={{ fontSize: FontSize.sm, color: FC.text.secondary, marginBottom: Spacing.base }}>{t('enter_player_number')}</Text>
          <TextInput
            style={{ backgroundColor: FC.bg.input ?? FC.bg.tertiary, borderRadius: Radius.md, paddingHorizontal: Spacing.base, paddingVertical: 12, borderWidth: 1, borderColor: FC.border.default, color: FC.text.primary, fontSize: FontSize.base, marginBottom: Spacing.md }}
            value={friendAccountNum}
            onChangeText={setFriendAccountNum}
            placeholder="12345678"
            placeholderTextColor={FC.text.tertiary}
            keyboardType="number-pad"
            maxLength={8}
          />
          {addFriendFeedback && (
            <Text style={{ fontSize: FontSize.sm, color: addFriendFeedback.startsWith('✓') ? Colors.market.gain : Colors.market.loss, marginBottom: Spacing.sm }}>{addFriendFeedback}</Text>
          )}
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: FC.border.default }}
              onPress={() => { setAddFriendModalVisible(false); setFriendAccountNum(''); setAddFriendFeedback(null); }}
            >
              <Text style={{ color: FC.text.secondary, fontWeight: FontWeight.semibold }}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.brand.accent, opacity: addingFriend ? 0.6 : 1 }}
              onPress={handleAddFriend}
              disabled={addingFriend}
            >
              <Text style={{ color: '#fff', fontWeight: FontWeight.bold }}>{addingFriend ? t('loading') : t('send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <ChatModal
      visible={friendChatVisible}
      room={friendChatRoom}
      onClose={() => { setFriendChatVisible(false); setFriendChatRoom(null); }}
    />
    {/* Friend Portfolio Viewer Modal */}
    <Modal visible={viewPortfolioVisible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg }}>
        <View style={{ width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: FC.bg.secondary, borderRadius: Radius.xl, borderWidth: 1, borderColor: FC.border.default }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: FC.border.default }}>
            <Text style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: FC.text.primary }}>
              {viewedFriendName}'s Portfolio
            </Text>
            <TouchableOpacity onPress={() => { setViewPortfolioVisible(false); setViewedPortfolio(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 20, color: FC.text.tertiary }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: Spacing.lg }}>
            {viewedPortfolio && (
              <>
                <Text style={{ fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold, color: FC.text.primary }}>
                  {formatCurrency(viewedPortfolio.totalValue ?? 0)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: Spacing.lg }}>
                  <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: (viewedPortfolio.totalGainLoss ?? 0) >= 0 ? Colors.market.gain : Colors.market.loss }}>
                    {(viewedPortfolio.totalGainLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(viewedPortfolio.totalGainLoss ?? 0)}
                  </Text>
                  <Text style={{ fontSize: FontSize.sm, color: (viewedPortfolio.totalGainLoss ?? 0) >= 0 ? Colors.market.gain : Colors.market.loss }}>
                    ({(viewedPortfolio.totalGainLossPercent ?? 0) >= 0 ? '+' : ''}{(viewedPortfolio.totalGainLossPercent ?? 0).toFixed(2)}%)
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: FC.border.default }}>
                  <Text style={{ fontSize: FontSize.sm, color: FC.text.secondary }}>Cash Balance</Text>
                  <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: FC.text.primary }}>
                    {formatCurrency(viewedPortfolio.cashBalance ?? 0)}
                  </Text>
                </View>
                <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: FC.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                  Holdings ({(viewedPortfolio.holdings ?? []).length})
                </Text>
                {(viewedPortfolio.holdings ?? []).length === 0 ? (
                  <Text style={{ fontSize: FontSize.sm, color: FC.text.tertiary, fontStyle: 'italic' }}>No holdings</Text>
                ) : (
                  (viewedPortfolio.holdings as Holding[]).map((h: Holding, i: number) => (
                    <View key={h.symbol + i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: FC.border.default }}>
                      <View>
                        <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: FC.text.primary }}>{h.symbol}</Text>
                        <Text style={{ fontSize: FontSize.xs, color: FC.text.tertiary }}>{h.shares} shares</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: FC.text.primary }}>{formatCurrency(h.currentValue ?? 0)}</Text>
                        <Text style={{ fontSize: FontSize.xs, color: (h.gainLoss ?? 0) >= 0 ? Colors.market.gain : Colors.market.loss }}>
                          {(h.gainLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(h.gainLoss ?? 0)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
                <View style={{ height: Spacing.lg }} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

// ─── Main Social Screen ───────────────────────────────────────────────────────

export default function SocialScreen() {
  const t = useT();
  const { appColorMode, appTabColors, isSidebarOpen, setSidebarOpen } = useAppStore();
  const tabColor = appTabColors['social'] ?? '#EC4899';
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;
  const screenBg = isLight ? C.bg.primary : Colors.bg.primary;
  const [activeTab, setActiveTab] = useState<SocialTab>('messages');

  const tabs: { key: SocialTab; label: string }[] = [
    { key: 'messages', label: t('messages') },
    { key: 'clubs', label: t('clubs') },
    { key: 'friends', label: t('friends') },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'messages':
        return <MessagesTab />;
      case 'clubs':
        return <ClubsTab />;
      case 'friends':
        return <FindFriendsTab />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      <AppHeader title={t('social')} />

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: isLight ? C.bg.secondary : Colors.bg.secondary, borderBottomColor: isLight ? C.border.default : Colors.border.default }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabItemText,
                { color: C.text.tertiary },
                activeTab === tab.key && styles.tabItemTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>{renderContent()}</View>
    </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // ── Invite section (in MessagesTab) ──
  inviteSection: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  inviteSectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    letterSpacing: 0.3,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.brand.gold + '44',
    gap: Spacing.sm,
  },
  inviteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand.gold + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteIcon: { fontSize: 18 },
  inviteInfo: { flex: 1 },
  inviteTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  inviteSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  inviteActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  inviteAcceptBtn: {
    backgroundColor: Colors.market.gain + '22',
    borderColor: Colors.market.gain,
  },
  inviteAcceptText: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: Colors.market.gain,
  },
  inviteDeclineBtn: {
    backgroundColor: Colors.market.loss + '22',
    borderColor: Colors.market.loss,
  },
  inviteDeclineText: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: Colors.market.loss,
  },
  inviteFeedbackText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  screenHeader: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#3D1A5544',
  },
  screenTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(61, 0, 37, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(180, 0, 100, 0.3)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.brand.primary,
  },
  tabItemText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.tertiary,
  },
  tabItemTextActive: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.semibold,
  },

  tabContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  avatarText: {
    fontWeight: FontWeight.bold,
  },

  // Chat Rooms List
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg.primary,
  },
  roomInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  roomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    flex: 1,
  },
  roomTime: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginLeft: Spacing.sm,
  },
  roomLastMsg: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginLeft: Spacing.base + 40 + Spacing.md,
  },

  // Chat Modal
  chatModalContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    backgroundColor: Colors.bg.secondary,
  },
  chatBackBtn: {
    width: 64,
  },
  chatBackText: {
    color: Colors.brand.primary,
    fontSize: FontSize.base,
  },
  chatTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  messagesList: {
    padding: Spacing.base,
    paddingBottom: Spacing.lg,
  },
  messageBubbleContainer: {
    marginBottom: Spacing.md,
    maxWidth: '80%',
  },
  messageBubbleLeft: {
    alignSelf: 'flex-start',
  },
  messageBubbleRight: {
    alignSelf: 'flex-end',
  },
  messageSenderName: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginBottom: 3,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
  },
  bubbleOwn: {
    backgroundColor: Colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: Colors.bg.tertiary,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FontSize.base,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    backgroundColor: Colors.bg.secondary,
    gap: Spacing.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text.primary,
    fontSize: FontSize.base,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sendBtn: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendBtnText: {
    color: Colors.text.primary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },

  // Trade Proposal Card
  proposalCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.brand.primary + '44',
  },
  proposalTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.brand.primary,
    marginBottom: Spacing.sm,
  },
  proposalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  proposalLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  proposalValue: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
  },
  proposalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  proposalBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  proposalBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },

  // Clubs
  createClubBtn: {
    margin: Spacing.base,
    backgroundColor: Colors.brand.primary + '22',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  createClubBtnText: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSubLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.base,
  },
  clubCard: {
    backgroundColor: Colors.bg.secondary,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  clubCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubCardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  clubName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  clubMemberCount: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  clubDescription: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  clubActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: 64,
    alignItems: 'center',
  },
  clubActionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.text.primary,
    fontSize: FontSize.base,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
  },
  modalCancelText: {
    color: Colors.text.secondary,
    fontWeight: FontWeight.medium,
    fontSize: FontSize.base,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: Colors.text.primary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },

  // Find Friends
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.base,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.text.primary,
    fontSize: FontSize.base,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  userCardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  userCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userDisplayName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  userUsername: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  userAccountNum: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  levelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  levelBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  sendMsgBtn: {
    backgroundColor: Colors.brand.primary + '22',
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  sendMsgBtnText: {
    color: Colors.brand.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Virtual Trading
  toggleButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  priceDisplay: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
  },
  priceValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
  },
  sendProposalBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.base,
  },
  sendProposalBtnText: {
    color: Colors.text.primary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.base,
  },
  errorText: {
    color: Colors.market.loss,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
  },
  successText: {
    color: Colors.market.gain,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    fontWeight: FontWeight.medium,
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyStateTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyStateSubtitle: {
    fontSize: FontSize.base,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
});
