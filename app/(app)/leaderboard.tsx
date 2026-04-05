import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import { getLeaderboard } from '../../src/services/auth';
import {
  formatCurrency,
} from '../../src/utils/formatters';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { useT } from '../../src/constants/translations';
import { ACHIEVEMENTS, getXPProgress, getLevelFromXP } from '../../src/constants/achievements';
import type { LeaderboardEntry, LeaderboardType, Achievement } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_LABELS: { key: LeaderboardType; label: string }[] = [
  { key: 'global', label: 'Global' },
  { key: 'local', label: 'Local' },
  { key: 'club', label: 'Club' },
  { key: 'friends', label: 'Friends' },
];

type TimePeriod = 'monthly' | 'six_month' | 'yearly';

const PERIOD_LABELS: { key: TimePeriod; label: string; icon: string; desc: string }[] = [
  { key: 'monthly',   label: 'Monthly',   icon: '📅', desc: 'This Month' },
  { key: 'six_month', label: '6 Months',  icon: '📈', desc: 'Last 6 Months' },
  { key: 'yearly',    label: 'Yearly',    icon: '🏆', desc: 'This Year' },
];

// ─── Rank medal styling ──────────────────────────────────────────────────────

const RANK_STYLES: Record<number, { color: string; bg: string; label: string }> = {
  1: { color: Colors.brand.gold, bg: 'rgba(245,197,24,0.15)', label: '🥇' },
  2: { color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)', label: '🥈' },
  3: { color: '#CD7F32', bg: 'rgba(205,127,50,0.12)', label: '🥉' },
};

function getRankStyle(rank: number) {
  return RANK_STYLES[rank] ?? { color: Colors.text.secondary, bg: 'transparent', label: String(rank) };
}

// ─── Build a single-entry leaderboard for when no real data exists yet ────────

function buildUserEntry(
  user: { id: string; username: string; displayName: string; level: number; country?: string; startingBalance?: number },
  portfolio: { totalValue?: number; totalGainLoss?: number } | null
): LeaderboardEntry[] {
  const gain = portfolio?.totalGainLoss ?? 0;
  return [{
    rank: 1,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    startingBalance: user.startingBalance ?? 10000,
    currentValue: portfolio?.totalValue ?? 10000,
    gainDollars: gain,
    level: user.level ?? 1,
    country: user.country ?? '',
    isCurrentUser: true,
  }];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const { user, portfolio, globalLeaderboard, localLeaderboard, setGlobalLeaderboard, setLocalLeaderboard, appColorMode, appTabColors, isSidebarOpen, setSidebarOpen } = useAppStore();
  const t = useT();
  const tabColor = appTabColors['leaderboard'] ?? '#F5C518';
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;
  const gcFull = (a: string, b: string, c: string, d: string) => [a,b,c,d] as any;
  const gc = (a: string, b: string, c: string) => [a,b,c] as any;
  const screenBg = isLight ? '#FFFFFF' : '#000000';

  const [activeTab, setActiveTab] = useState<LeaderboardType>('global');
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const tabBarAnim = useRef(new Animated.Value(0)).current;
  const activeTabIndex = TAB_LABELS.findIndex(t => t.key === activeTab);
  const tabWidth = (SCREEN_WIDTH - Spacing.base * 2) / TAB_LABELS.length;

  // XP / Level
  const userXP = user?.xp ?? 0;
  const xpInfo = getXPProgress(userXP);
  const levelInfo = getLevelFromXP(userXP);
  const levelColor = Colors.levels[(levelInfo.level - 1) % Colors.levels.length];

  // Build leaderboard data per tab — real data from store, empty for social tabs
  const leaderboardData: Record<LeaderboardType, LeaderboardEntry[]> = useMemo(() => {
    if (!user) return { global: [], local: [], club: [], friends: [] };
    return {
      global: globalLeaderboard.length > 0 ? globalLeaderboard : buildUserEntry(user, portfolio),
      local:  localLeaderboard.length  > 0 ? localLeaderboard  : buildUserEntry(user, portfolio),
      club:    [],
      friends: [],
    };
  }, [user, portfolio, globalLeaderboard, localLeaderboard]);

  const entries = leaderboardData[activeTab];
  const currentUserEntry = entries.find(e => e.isCurrentUser);

  // Show all entries (up to 500)
  const visibleEntries = entries;
  const userInView = visibleEntries.some(e => e.isCurrentUser);

  // Achievements
  const userAchievements: Set<string> = useMemo(
    () => new Set((user?.achievements ?? []).map(a => a.id)),
    [user?.achievements]
  );

  // ─── Tab animation ────────────────────────────────────────────────────────

  useEffect(() => {
    Animated.spring(tabBarAnim, {
      toValue: activeTabIndex * tabWidth,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  }, [activeTabIndex, tabWidth]);

  // ─── Fetch real leaderboard data ─────────────────────────────────────────

  const loadData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [globalData, localData] = await Promise.all([
        getLeaderboard('global'),
        getLeaderboard('local', user.country),
      ]);

      const markUser = (entries: unknown[]) =>
        (entries as LeaderboardEntry[]).map(e => {
          const entry = e as LeaderboardEntry & { gainPercent?: number };
          const gainDollars = entry.gainDollars ??
            (entry.currentValue != null && entry.startingBalance != null
              ? entry.currentValue - entry.startingBalance
              : 0);
          return { ...entry, gainDollars, isCurrentUser: entry.userId === user.id };
        });

      if (Array.isArray(globalData) && globalData.length > 0) {
        setGlobalLeaderboard(markUser(globalData));
      }
      if (Array.isArray(localData) && localData.length > 0) {
        setLocalLeaderboard(markUser(localData));
      }
    } catch {
      // Non-critical — memoised fallback already shows the current user
    }

    if (isRefresh) setIsRefreshing(false);
    else setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // ─── Check leaderboard achievements whenever data updates ─────────────────

  useEffect(() => {
    const checkLeaderboardAchievements = async () => {
      const currentUser = useAppStore.getState().user;
      if (!currentUser) return;

      const alreadyUnlocked = new Set((currentUser.achievements ?? []).map(a => a.id));

      const grantIfNew = async (achId: string) => {
        if (alreadyUnlocked.has(achId)) return;
        const ach = ACHIEVEMENTS.find(a => a.id === achId);
        if (!ach) return;

        const newAch: Achievement = { ...ach, unlockedAt: Date.now() };
        const mergedAchs = [...(currentUser.achievements ?? []), newAch];
        const newXP = (currentUser.xp ?? 0) + ach.xpReward;
        const newLevel = getLevelFromXP(newXP);
        const updatedUser = { ...currentUser, achievements: mergedAchs, xp: newXP, level: newLevel.level };

        useAppStore.getState().setUser(updatedUser);
        useAppStore.getState().setPendingAchievement(newAch);
        alreadyUnlocked.add(achId); // prevent double-grant in same pass

        try {
          const { updateUser } = await import('../../src/services/auth');
          await updateUser(currentUser.id, { achievements: mergedAchs, xp: newXP, level: newLevel.level });
        } catch { /* non-critical */ }
      };

      // ── Global leaderboard checks ──
      if (globalLeaderboard.length > 0) {
        const userEntry = globalLeaderboard.find(e => e.isCurrentUser);
        if (userEntry) {
          const lastEntry = globalLeaderboard[globalLeaderboard.length - 1];
          if (userEntry.rank === 1) await grantIfNew('global_first');
          else if (userEntry.rank === 2) await grantIfNew('global_second');
          else if (userEntry.rank === 3) await grantIfNew('global_third');
          // Last place — only meaningful if there is more than one player
          if (globalLeaderboard.length > 1 && lastEntry?.userId === currentUser.id) {
            await grantIfNew('global_last');
          }
        }
      }

      // ── Local leaderboard checks ──
      if (localLeaderboard.length > 0) {
        const userEntry = localLeaderboard.find(e => e.isCurrentUser);
        if (userEntry) {
          if (userEntry.rank === 1) await grantIfNew('local_first');
          else if (userEntry.rank === 2) await grantIfNew('local_second');
          else if (userEntry.rank === 3) await grantIfNew('local_third');
        }
      }
    };

    checkLeaderboardAchievements();
  }, [globalLeaderboard, localLeaderboard]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={[styles.safeArea, { backgroundColor: screenBg }]} edges={['top']}>
      {/* Full-screen colour wash — top */}
      <LinearGradient
        colors={gcFull(`${tabColor}80`, `${tabColor}50`, `${tabColor}30`, screenBg)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Full-screen wash — bottom */}
      <LinearGradient
        colors={gc('transparent', `${tabColor}30`, `${tabColor}40`)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Side glow */}
      <LinearGradient
        colors={gc(`${tabColor}28`, 'transparent', `${tabColor}28`)}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
      />
      <AppHeader title={t('leaderboard')} />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadData(true)}
            tintColor={Colors.brand.primary}
          />
        }
      >
        {/* ── XP Progress Banner ── */}
        {user && (
          <View style={[styles.xpBanner, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <View style={styles.xpBannerTop}>
              <View style={styles.xpLevelBadge}>
                <Text style={styles.xpLevelIcon}>{levelInfo.icon}</Text>
                <View>
                  <Text style={[styles.xpLevelName, { color: levelColor }]}>
                    {levelInfo.title}
                  </Text>
                  <Text style={[styles.xpLevelNum, { color: C.text.secondary }]}>Level {levelInfo.level}</Text>
                </View>
              </View>
              <View style={styles.xpValueContainer}>
                <Text style={[styles.xpValue, { color: C.text.primary }]}>{userXP.toLocaleString()} XP</Text>
                {xpInfo.nextLevel && (
                  <Text style={[styles.xpNextLevel, { color: C.text.tertiary }]}>
                    {xpInfo.xpInLevel} / {xpInfo.xpNeeded} to Lvl {xpInfo.nextLevel.level}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.xpBarBg}>
              <View
                style={[
                  styles.xpBarFill,
                  {
                    width: `${Math.min(xpInfo.progress * 100, 100)}%`,
                    backgroundColor: levelColor,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── User Stats Card ── */}
        {user && portfolio && (
          <View style={[styles.statsCard, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Text style={[styles.statsCardTitle, { color: C.text.primary }]}>{t('your_performance')}</Text>
            <View style={styles.statsRow}>
              <StatsItem
                label={t('current_rank')}
                value={currentUserEntry ? `#${currentUserEntry.rank}` : '—'}
                highlight
              />
              <StatsItem
                label={t('starting_balance')}
                value={formatCurrency(portfolio.startingBalance, 'USD', true)}
              />
              <StatsItem
                label={t('current_value')}
                value={formatCurrency(portfolio.totalValue, 'USD', true)}
              />
              <StatsItem
                label={t('total_gain')}
                value={(portfolio.totalGainLoss >= 0 ? '+' : '') + formatCurrency(portfolio.totalGainLoss, 'USD', true)}
                positive={portfolio.totalGainLoss >= 0}
                colored
              />
            </View>
          </View>
        )}

        {/* ── Tab Bar ── */}
        <View style={styles.tabBarContainer}>
          <View style={[styles.tabBar, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
            <Animated.View
              style={[
                styles.tabIndicator,
                { width: tabWidth - 8, transform: [{ translateX: tabBarAnim }], backgroundColor: C.bg.tertiary },
              ]}
            />
            {TAB_LABELS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, { width: tabWidth }]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[
                  styles.tabText,
                  { color: C.text.tertiary },
                  activeTab === tab.key && styles.tabTextActive,
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Period Selector ── */}
        <View style={styles.periodRow}>
          {PERIOD_LABELS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodPill, { backgroundColor: C.bg.secondary, borderColor: C.border.default }, activePeriod === p.key && styles.periodPillActive]}
              onPress={() => setActivePeriod(p.key)}
            >
              <Text style={styles.periodPillIcon}>{p.icon}</Text>
              <Text style={[styles.periodPillText, { color: C.text.secondary }, activePeriod === p.key && styles.periodPillTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Period Label ── */}
        <View style={styles.periodLabelRow}>
          <View style={styles.periodLabelDot} />
          <Text style={[styles.periodLabelText, { color: C.text.tertiary }]}>
            {PERIOD_LABELS.find(p => p.key === activePeriod)?.desc} Rankings
          </Text>
        </View>

        {/* ── Leaderboard List ── */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.brand.primary} size="large" />
            <Text style={[styles.loadingText, { color: C.text.secondary }]}>{t('loading_rankings')}</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={[styles.emptyTitle, { color: C.text.primary }]}>{t('no_rankings')}</Text>
            <Text style={[styles.emptySubtitle, { color: C.text.secondary }]}>
              {activeTab === 'club'
                ? 'Join a trading club to see club rankings.'
                : activeTab === 'friends'
                  ? 'Add friends to see how you compare.'
                  : 'Rankings will appear here once available.'}
            </Text>
          </View>
        ) : (
          <View style={styles.leaderboardList}>
            {visibleEntries.map(entry => (
              <LeaderboardRow key={entry.userId + entry.rank} entry={entry} getInitials={getInitials} />
            ))}
            {entries.length > 20 && (
              <Text style={[styles.moreEntriesText, { color: C.text.tertiary }]}>
                +{entries.length - 20} more traders
              </Text>
            )}
          </View>
        )}

        {/* ── Sticky Current User Row (if not in view) ── */}
        {!isLoading && !userInView && currentUserEntry && (
          <View style={[styles.stickyUserContainer, { borderTopColor: C.border.default }]}>
            <View style={styles.stickyUserLabel}>
              <Text style={[styles.stickyUserLabelText, { color: C.text.tertiary }]}>{t('your_position')}</Text>
            </View>
            <LeaderboardRow entry={currentUserEntry} getInitials={getInitials} isSticky />
          </View>
        )}

        {/* ── Achievements ── */}
        <View style={styles.achievementsSection}>
          <Text style={[styles.sectionTitle, { color: C.text.primary }]}>{t('achievements')}</Text>
          <Text style={[styles.achievementsSubtitle, { color: C.text.secondary }]}>
            {userAchievements.size} / {ACHIEVEMENTS.length} unlocked
          </Text>

          {/* Category groups */}
          {(['milestone', 'trading', 'portfolio', 'social', 'streak'] as const).map(category => {
            const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === category);
            return (
              <View key={category} style={styles.achievementCategory}>
                <Text style={[styles.achievementCategoryTitle, { color: C.text.secondary }]}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <View style={styles.achievementsGrid}>
                  {categoryAchievements.map(achievement => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      unlocked={userAchievements.has(achievement.id)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </SafeAreaView>
    </View>
  );
}

// ─── LeaderboardRow ──────────────────────────────────────────────────────────

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  getInitials: (name: string) => string;
  isSticky?: boolean;
}

function LeaderboardRow({ entry, getInitials, isSticky }: LeaderboardRowProps) {
  const { appColorMode } = useAppStore();
  const LC = appColorMode === 'light' ? LightColors : Colors;
  const rankStyle = getRankStyle(entry.rank);
  const isGain = entry.gainDollars >= 0;
  const gainColor = isGain ? Colors.market.gain : Colors.market.loss;
  const levelColor = Colors.levels[(Math.max(1, entry.level ?? 1) - 1) % Colors.levels.length];

  return (
    <View style={[
      styles.leaderboardRow,
      { backgroundColor: LC.bg.secondary, borderColor: LC.border.default },
      entry.isCurrentUser && styles.leaderboardRowHighlight,
      isSticky && styles.leaderboardRowSticky,
      isSticky && { backgroundColor: LC.bg.tertiary },
    ]}>
      {/* Rank */}
      <View style={[styles.rankContainer, { backgroundColor: rankStyle.bg }]}>
        {entry.rank <= 3 ? (
          <Text style={styles.rankMedal}>{rankStyle.label}</Text>
        ) : (
          <Text style={[styles.rankNumber, { color: rankStyle.color }]} >#{entry.rank}</Text>
        )}
      </View>

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: levelColor + '33', borderColor: levelColor + '55' }]}>
        <Text style={[styles.avatarText, { color: levelColor }]}>
          {getInitials(entry.displayName)}
        </Text>
      </View>

      {/* Name + username */}
      <View style={styles.playerInfo}>
        <View style={styles.playerNameRow}>
          <Text style={[styles.playerDisplayName, { color: LC.text.primary }]} numberOfLines={1}>
            {entry.displayName}
          </Text>
          {entry.isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>YOU</Text>
            </View>
          )}
        </View>
        <Text style={[styles.playerUsername, { color: LC.text.tertiary }]}>@{entry.username}</Text>
      </View>

      {/* Gain + level */}
      <View style={styles.playerStats}>
        <Text style={[styles.gainPercent, { color: gainColor }]}>
          {entry.gainDollars >= 0 ? '+' : ''}{formatCurrency(entry.gainDollars, 'USD', true)}
        </Text>
        <View style={[styles.levelBadge, { borderColor: levelColor + '66' }]}>
          <Text style={[styles.levelBadgeText, { color: levelColor }]}>Lv {entry.level}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── AchievementCard ─────────────────────────────────────────────────────────

interface AchievementCardProps {
  achievement: Achievement;
  unlocked: boolean;
}

function AchievementCard({ achievement, unlocked }: AchievementCardProps) {
  const { appColorMode } = useAppStore();
  const AC = appColorMode === 'light' ? LightColors : Colors;
  return (
    <View style={[
      styles.achievementCard,
      { backgroundColor: AC.bg.secondary, borderColor: AC.border.default },
      !unlocked && styles.achievementCardLocked,
    ]}>
      <Text style={[styles.achievementIcon, !unlocked && styles.achievementIconLocked]}>
        {achievement.icon}
      </Text>
      <Text style={[
        styles.achievementTitle,
        { color: AC.text.primary },
        !unlocked && styles.achievementTitleLocked,
      ]} numberOfLines={2}>
        {achievement.title}
      </Text>
      <Text style={styles.achievementXP}>+{achievement.xpReward} XP</Text>
      {!unlocked && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
      )}
    </View>
  );
}

// ─── StatsItem ───────────────────────────────────────────────────────────────

interface StatsItemProps {
  label: string;
  value: string;
  highlight?: boolean;
  colored?: boolean;
  positive?: boolean;
}

function StatsItem({ label, value, highlight, colored, positive }: StatsItemProps) {
  const { appColorMode } = useAppStore();
  const SIC = appColorMode === 'light' ? LightColors : Colors;
  const valueColor = colored
    ? (positive ? Colors.market.gain : Colors.market.loss)
    : highlight
      ? Colors.brand.primary
      : SIC.text.primary;

  return (
    <View style={styles.statsItem}>
      <Text style={[styles.statsItemLabel, { color: SIC.text.tertiary }]}>{label}</Text>
      <Text style={[styles.statsItemValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#8C6400', // overridden inline
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },

  // XP Banner
  xpBanner: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  xpBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  xpLevelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  xpLevelIcon: {
    fontSize: 32,
  },
  xpLevelName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  xpLevelNum: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  xpValueContainer: {
    alignItems: 'flex-end',
  },
  xpValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  xpNextLevel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  xpBarBg: {
    height: 8,
    backgroundColor: Colors.bg.input,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },

  // Stats Card
  statsCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  statsCardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsItem: {
    alignItems: 'center',
    flex: 1,
  },
  statsItemLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: 4,
  },
  statsItemValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },

  // Tab Bar
  tabBarContainer: {
    marginBottom: Spacing.base,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    height: '100%',
    marginVertical: 0,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.brand.primary + '44',
  },
  tab: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text.tertiary,
  },
  tabTextActive: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.bold,
  },

  // Period selector
  periodRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  periodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  periodPillActive: {
    backgroundColor: `${Colors.brand.primary}18`,
    borderColor: `${Colors.brand.primary}55`,
  },
  periodPillIcon: { fontSize: 14 },
  periodPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  periodPillTextActive: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.bold,
  },
  periodLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  periodLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brand.primary,
  },
  periodLabelText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Loading / Empty
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.base,
  },
  loadingText: {
    color: Colors.text.secondary,
    fontSize: FontSize.base,
  },
  emptyContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Leaderboard
  leaderboardList: {
    marginBottom: Spacing.base,
  },
  moreEntriesText: {
    textAlign: 'center',
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.base,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  leaderboardRowHighlight: {
    borderColor: Colors.brand.primary + '55',
    backgroundColor: 'rgba(0,179,230,0.06)',
  },
  leaderboardRowSticky: {
    borderColor: Colors.brand.accent + '44',
    backgroundColor: Colors.bg.tertiary,
    marginTop: Spacing.sm,
  },
  rankContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  rankMedal: {
    fontSize: 22,
  },
  rankNumber: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    borderWidth: 1,
  },
  avatarText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  playerInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerDisplayName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  playerUsername: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  playerStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  gainPercent: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  levelBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  levelBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // Sticky user
  stickyUserContainer: {
    marginBottom: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    paddingTop: Spacing.sm,
  },
  stickyUserLabel: {
    marginBottom: Spacing.xs,
  },
  stickyUserLabelText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: FontWeight.semibold,
  },

  // Achievements
  achievementsSection: {
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  achievementsSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    marginBottom: Spacing.base,
  },
  achievementCategory: {
    marginBottom: Spacing.base,
  },
  achievementCategoryTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  achievementCard: {
    width: (SCREEN_WIDTH - Spacing.base * 2 - Spacing.sm * 2) / 3,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    minHeight: 100,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  achievementCardLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  achievementIconLocked: {
    opacity: 0.4,
  },
  achievementTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  achievementTitleLocked: {
    color: Colors.text.tertiary,
  },
  achievementXP: {
    fontSize: 9,
    color: Colors.brand.gold,
    fontWeight: FontWeight.bold,
  },
  lockOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  lockIcon: {
    fontSize: 12,
    opacity: 0.6,
  },
});
