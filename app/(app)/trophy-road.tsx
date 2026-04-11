/**
 * Awards Screen
 *
 * Three sub-tabs:
 *  1. Trophy Road  – 10 circular milestones (every $5k up to $50k)
 *  2. Achievements – placeholder (blank for now)
 *  3. Ranked       – global leaderboard (moved from social)
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import { ACHIEVEMENTS, getXPProgress } from '../../src/constants/achievements';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { formatCurrency } from '../../src/utils/formatters';
import { getLeaderboard } from '../../src/services/firebase';
import type { LeaderboardEntry } from '../../src/types';

// Fixed accent color
const FIXED_ACCENT = Colors.brand.primary;

// ─── Sub-tab type ────────────────────────────────────────────────────────────
type AwardsTab = 'trophy-road' | 'achievements' | 'ranked';

// ─── 10 XP-based milestones with titles ───────────────────────────────────────
const MILESTONES = [
  { xp: 0,    title: 'The Observer',              color: '#94A3B8', icon: '🌱' },
  { xp: 500,  title: 'Market Scout',              color: '#60A5FA', icon: '🔍' },
  { xp: 750,  title: 'Tactical Trader',           color: '#34D399', icon: '⚙️' },
  { xp: 1000, title: 'Asset Architect',           color: '#F59E0B', icon: '📐' },
  { xp: 1500, title: 'Value Guardian',            color: '#F97316', icon: '🛡️' },
  { xp: 2000, title: 'Global Strategist',         color: '#EF4444', icon: '🌐' },
  { xp: 2500, title: 'Alpha Elite',               color: '#8B5CF6', icon: '⛰️' },
  { xp: 3000, title: 'The Wolf of Wall Street',   color: '#EC4899', icon: '🐺' },
  { xp: 3500, title: 'Market Sovereign',          color: '#F5C518', icon: '🏆' },
  { xp: 4000, title: 'The Whale',                 color: '#00D4AA', icon: '🐋' },
];

// ─── Pulsing dot (current position) ─────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);
  return <Animated.View style={[styles.pulseDot, { backgroundColor: color, transform: [{ scale }] }]} />;
}

// ─── Trophy Road Tab Content ─────────────────────────────────────────────────

function TrophyRoadTab() {
  const { user, portfolio } = useAppStore();
  const scrollRef = useRef<ScrollView>(null);

  const currentXP          = user?.xp ?? 0;
  const currentGainDollars = portfolio?.totalGainLoss ?? 0;
  const currentLevel       = user?.level ?? 1;
  const xpInfo             = getXPProgress(currentXP);

  // Find which milestone the user is currently at (by XP)
  const currentMilestoneIdx = (() => {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (currentXP >= MILESTONES[i].xp) return i;
    }
    return 0;
  })();
  const currentMilestoneXP = MILESTONES[currentMilestoneIdx].xp;
  const levelColor = MILESTONES[currentMilestoneIdx].color;

  const reversed = [...MILESTONES].reverse();

  const scrollToMe = useCallback(() => {
    const idx = reversed.findIndex(m => m.xp === currentMilestoneXP);
    const ROW_H = SEGMENT_H * 2 + NODE_SIZE;
    const targetY = Math.max(0, (idx - 1) * ROW_H);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [currentMilestoneXP]);

  useEffect(() => {
    const timer = setTimeout(scrollToMe, 400);
    return () => clearTimeout(timer);
  }, [scrollToMe]);

  return (
    <View style={{ flex: 1 }}>
      {/* ── Status Header ── */}
      <LinearGradient
        colors={['#0D1830', '#0A1225', Colors.bg.primary]}
        style={styles.header}
      >
        <Text style={styles.headerSub}>Earn XP to unlock new titles</Text>

        <View style={styles.statusCard}>
          <View style={[styles.rankBadge, { borderColor: `${levelColor}88` }]}>
            <LinearGradient
              colors={[`${levelColor}33`, `${levelColor}11`]}
              style={styles.rankBadgeInner}
            >
              <Text style={styles.rankBadgeIcon}>{MILESTONES[currentMilestoneIdx].icon}</Text>
            </LinearGradient>
          </View>

          <View style={styles.statusInfo}>
            <Text style={[styles.rankTitle, { color: levelColor }]}>
              {MILESTONES[currentMilestoneIdx].title}
            </Text>
            <Text style={styles.statusGain}>
              {currentXP.toLocaleString()} XP
            </Text>
            {/* Next milestone progress */}
            {currentMilestoneIdx < MILESTONES.length - 1 && (
              <Text style={styles.statusNext}>
                {MILESTONES[currentMilestoneIdx + 1].xp - currentXP} XP to {MILESTONES[currentMilestoneIdx + 1].title}
              </Text>
            )}
            {currentMilestoneIdx === MILESTONES.length - 1 && (
              <Text style={[styles.statusNext, { color: levelColor }]}>Max rank reached!</Text>
            )}
          </View>
        </View>

        <View style={styles.xpBarOuter}>
          <Animated.View
            style={[
              styles.xpBarInner,
              { width: `${Math.min(xpInfo.progress * 100, 100)}%`, backgroundColor: levelColor },
            ]}
          />
        </View>
      </LinearGradient>

      {/* ── Road with 10 milestones ── */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.road}
          contentContainerStyle={styles.roadContent}
          showsVerticalScrollIndicator={false}
        >
          {reversed.map((ms, idx) => {
            const isAchieved = currentXP >= ms.xp;
            const isCurrent  = ms.xp === currentMilestoneXP;
            const isFirst    = idx === reversed.length - 1;
            const isLast     = idx === 0;

            const segmentColor  = isAchieved ? FIXED_ACCENT : `${FIXED_ACCENT}20`;
            const nodeBorderCol = isCurrent ? ms.color : isAchieved ? FIXED_ACCENT : `${FIXED_ACCENT}35`;
            const nodeBgCol     = isCurrent ? `${ms.color}33` : isAchieved ? `${FIXED_ACCENT}22` : Colors.bg.secondary;
            const msNumber = MILESTONES.length - idx;

            return (
              <React.Fragment key={ms.xp}>
                <View style={styles.milestoneRow}>
                  <View style={styles.spineCol}>
                    {!isLast && (
                      <View style={[styles.segment, { backgroundColor: segmentColor }]} />
                    )}
                    <View style={[
                      styles.node,
                      { borderColor: nodeBorderCol, backgroundColor: nodeBgCol },
                      isCurrent && styles.nodeCurrent,
                    ]}>
                      {isCurrent
                        ? <PulsingDot color={ms.color} />
                        : isAchieved
                          ? <Text style={styles.nodeEmoji}>{ms.icon}</Text>
                          : <Text style={[styles.nodeLevelNum, { color: `${ms.color}55` }]}>{msNumber}</Text>
                      }
                    </View>
                    {!isFirst && (
                      <View style={[styles.segment, { backgroundColor: segmentColor }]} />
                    )}
                  </View>

                  <View style={styles.milestoneInfo}>
                    <Text style={[
                      styles.levelTitle,
                      isAchieved
                        ? { color: isCurrent ? ms.color : FIXED_ACCENT }
                        : styles.milestonePctLocked,
                      isCurrent && { fontWeight: FontWeight.extrabold },
                    ]}>
                      {ms.title}
                    </Text>
                    <Text style={{
                      fontSize: FontSize.xs,
                      color: isAchieved ? Colors.text.secondary : Colors.text.tertiary,
                      opacity: isAchieved ? 1 : 0.5,
                    }}>
                      {ms.xp === 0 ? 'Start' : `${ms.xp.toLocaleString()} XP`}
                    </Text>
                    {isCurrent && (
                      <View style={[styles.hereBadge, { backgroundColor: ms.color }]}>
                        <Text style={styles.hereText}>YOU ARE HERE</Text>
                      </View>
                    )}
                  </View>
                </View>
              </React.Fragment>
            );
          })}

          <View style={styles.bottomPad} />
        </ScrollView>

        <TouchableOpacity
          style={[styles.locateMeBtn, { borderColor: `${levelColor}66`, backgroundColor: `${levelColor}18` }]}
          onPress={scrollToMe}
          activeOpacity={0.75}
        >
          <Text style={[styles.locateMeText, { color: levelColor }]}>FIND ME</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Achievements Tab Content ────────────────────────────────────────────────

function AchievementsTab() {
  const { user } = useAppStore();
  const unlocked = user?.achievements ?? [];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.base, paddingBottom: 32 }}>
      <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md }}>
        {unlocked.length} / {ACHIEVEMENTS.length} Unlocked
      </Text>
      {ACHIEVEMENTS.map((ach) => {
        const isUnlocked = unlocked.includes(ach.id);
        return (
          <View
            key={ach.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isUnlocked ? 'rgba(0,179,230,0.06)' : Colors.bg.secondary,
              borderRadius: Radius.lg,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.base,
              marginBottom: Spacing.xs,
              borderWidth: 1,
              borderColor: isUnlocked ? Colors.brand.primary + '55' : Colors.border.default,
            }}
          >
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: isUnlocked ? `${Colors.brand.primary}22` : Colors.bg.tertiary,
              marginRight: Spacing.sm,
            }}>
              <Text style={{ fontSize: 22, opacity: isUnlocked ? 1 : 0.4 }}>{ach.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{
                  fontSize: FontSize.base, fontWeight: FontWeight.semibold,
                  color: isUnlocked ? Colors.text.primary : Colors.text.secondary,
                }} numberOfLines={1}>{ach.title}</Text>
                {isUnlocked && (
                  <Text style={{ fontSize: 14, color: Colors.market.gain }}>✓</Text>
                )}
              </View>
              <Text style={{
                fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: 2,
              }} numberOfLines={2}>{ach.requirement}</Text>
            </View>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3,
              borderRadius: Radius.full, backgroundColor: `${Colors.brand.accent}20`,
              borderWidth: 1, borderColor: `${Colors.brand.accent}40`,
              marginLeft: Spacing.sm,
            }}>
              <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.brand.accent }}>
                +{ach.xpReward} XP
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Ranked Tab Content (moved from social) ──────────────────────────────────

function RankedTab() {
  const { user, portfolio } = useAppStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRankings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard('global');
      let mapped = Array.isArray(data) && data.length > 0
        ? (data as LeaderboardEntry[]).map(e => ({
            ...e,
            gainDollars: e.gainDollars ?? (e.currentValue - e.startingBalance),
            isCurrentUser: e.userId === user?.id,
          }))
        : [];

      if (user && !mapped.some(e => e.userId === user.id)) {
        const startBal = portfolio?.startingBalance ?? user.startingBalance ?? 10000;
        const curVal = portfolio?.totalValue ?? startBal;
        const gain = curVal - startBal;
        mapped.push({
          rank: mapped.length + 1,
          userId: user.id,
          username: user.username ?? 'Player',
          displayName: user.displayName ?? user.username ?? 'Player',
          level: user.level ?? 1,
          country: user.country ?? '',
          startingBalance: startBal,
          currentValue: curVal,
          gainDollars: gain,
          isCurrentUser: true,
        });
      }
      mapped.sort((a, b) => b.gainDollars - a.gainDollars);
      mapped.forEach((e, i) => { e.rank = i + 1; });
      setEntries(mapped);
    } catch {}
    setLoading(false);
  }, [user?.id, portfolio?.totalValue]);

  useEffect(() => { loadRankings(); }, []);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
        <ActivityIndicator color={Colors.brand.primary} size="large" />
        <Text style={{ color: Colors.text.secondary, marginTop: 12, fontSize: FontSize.base }}>Loading rankings...</Text>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
        <Text style={{ color: Colors.text.primary, fontSize: FontSize.lg, fontWeight: FontWeight.bold }}>No rankings yet</Text>
        <Text style={{ color: Colors.text.secondary, fontSize: FontSize.base, textAlign: 'center', marginTop: 8 }}>
          Rankings will appear once players start trading.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.base, paddingBottom: 32 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
        <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>
          Global Rankings
        </Text>
        <TouchableOpacity onPress={loadRankings} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.bg.secondary, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border.default }}>
          <Text style={{ color: Colors.text.secondary, fontSize: FontSize.sm }}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>
      {entries.map(entry => {
        const isGain = entry.gainDollars >= 0;
        const gainColor = isGain ? Colors.market.gain : Colors.market.loss;
        const levelColor = Colors.levels[(Math.max(1, entry.level ?? 1) - 1) % Colors.levels.length];
        return (
          <View
            key={entry.userId + entry.rank}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.bg.secondary,
              borderRadius: Radius.lg,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.base,
              marginBottom: Spacing.xs,
              borderWidth: 1,
              borderColor: entry.isCurrentUser ? Colors.brand.primary + '55' : Colors.border.default,
              ...(entry.isCurrentUser ? { backgroundColor: 'rgba(0,179,230,0.06)' } : {}),
            }}
          >
            {/* Rank */}
            <View style={{ width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, backgroundColor: entry.rank <= 3 ? 'rgba(245,197,24,0.12)' : 'transparent' }}>
              {entry.rank <= 3 ? (
                <Text style={{ fontSize: 22 }}>{RANK_MEDALS[entry.rank]}</Text>
              ) : (
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.secondary }}>#{entry.rank}</Text>
              )}
            </View>
            {/* Avatar */}
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, backgroundColor: levelColor + '33', borderWidth: 1, borderColor: levelColor + '55' }}>
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: levelColor }}>{getInitials(entry.displayName)}</Text>
            </View>
            {/* Name */}
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text.primary, flexShrink: 1 }} numberOfLines={1}>{entry.displayName}</Text>
                {entry.isCurrentUser && (
                  <View style={{ backgroundColor: Colors.brand.primary, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}>
                    <Text style={{ fontSize: 9, fontWeight: FontWeight.extrabold, color: '#fff', letterSpacing: 0.5 }}>YOU</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: FontSize.xs, color: Colors.text.tertiary, marginTop: 2 }}>@{entry.username}</Text>
            </View>
            {/* Stats */}
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.bold, color: gainColor }}>
                {isGain ? '+' : ''}{formatCurrency(entry.gainDollars, 'USD', true)}
              </Text>
              <View style={{ borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, borderColor: levelColor + '66' }}>
                <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: levelColor }}>Lv {entry.level}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TrophyRoadScreen() {
  const [activeTab, setActiveTab] = useState<AwardsTab>('ranked');

  const tabs: { key: AwardsTab; label: string }[] = [
    { key: 'ranked',        label: 'Ranked' },
    { key: 'trophy-road',   label: 'Trophy Road' },
    { key: 'achievements',  label: 'Achievements' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'trophy-road':  return <TrophyRoadTab />;
      case 'achievements': return <AchievementsTab />;
      case 'ranked':       return <RankedTab />;
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Awards" />

      {/* ── Sub-tab bar ── */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabItemText,
                activeTab === tab.key && styles.tabItemTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab content ── */}
      <View style={{ flex: 1 }}>{renderContent()}</View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const NODE_SIZE  = 44;
const SEGMENT_H  = 42;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },

  // Sub-tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    gap: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: 'transparent',
  },
  tabItemActive: {
    backgroundColor: `${Colors.brand.primary}20`,
    borderBottomWidth: 2,
    borderBottomColor: Colors.brand.primary,
  },
  tabItemText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
  tabItemTextActive: {
    color: Colors.brand.primary,
    fontWeight: FontWeight.bold,
  },

  // Header
  header: {
    paddingTop: 12,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.base,
    gap: 4,
    alignItems: 'center',
  },

  headerSub: { fontSize: FontSize.sm, color: Colors.text.secondary, marginBottom: 8 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.xl,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  rankBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    overflow: 'hidden',
    flexShrink: 0,
  },
  rankBadgeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeIcon: { fontSize: 30 },
  rankTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.3,
  },

  statusInfo: { flex: 1, gap: 3 },
  statusGain: { fontSize: FontSize.sm, color: Colors.brand.accent, fontWeight: FontWeight.semibold },
  statusNext: { fontSize: FontSize.xs, color: Colors.text.tertiary },

  xpBarOuter: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  xpBarInner: { height: '100%', borderRadius: 3 },

  // Road
  road: { flex: 1, backgroundColor: '#0A0E1A' },
  roadContent: { paddingTop: Spacing.lg, paddingLeft: 4, paddingRight: Spacing.base },

  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: NODE_SIZE + 2,
    gap: 8,
  },

  // Spine
  spineCol: { alignItems: 'center', width: NODE_SIZE, flexShrink: 0 },
  segment: {
    width: 3,
    height: SEGMENT_H,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 2,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2.5,
    borderColor: Colors.bg.tertiary,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nodeCurrent: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  nodeCheck: { fontSize: 14, color: Colors.brand.primary, fontWeight: FontWeight.bold },
  nodeEmoji: { fontSize: 20 },
  nodeLevelNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // Milestone text
  milestoneInfo: {
    paddingTop: SEGMENT_H + NODE_SIZE / 2 - 10,
    flex: 1,
    gap: 2,
  },
  levelTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  milestonePctLocked: { color: Colors.text.tertiary },
  hereBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    marginTop: 3,
  },
  hereText: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    letterSpacing: 0.8,
  },

  // Scroll-to-me FAB
  locateMeBtn: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  locateMeText: {
    fontSize: 8,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.8,
    lineHeight: 10,
  },

  bottomPad: { height: 100 },
});
