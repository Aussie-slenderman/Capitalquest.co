/**
 * Trophy Road
 *
 * Vertical progression road — milestones every $100 gain (up to +$50,000).
 * Every $1,000 a reward card appears: alternating avatar or pet, never both at once.
 * Level 1 avatar (Seedling) is always unlocked and used as the player's profile icon.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import { getXPProgress } from '../../src/constants/achievements';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { formatCurrency } from '../../src/utils/formatters';
import {
  rewardAtGain,
  type TrophyReward,
} from '../../src/constants/trophyRewards';

// Fixed accent color replacing all zone-based accent colors
const FIXED_ACCENT = Colors.brand.primary;

// ─── Road constants ──────────────────────────────────────────────────────────

const MAX_GAIN_DOLLARS = 50000;
const XP_PER_100 = 20; // 20 XP per $100 milestone = 100 XP per $500 = same level pace

/** All $100 milestone steps from $0 to $50,000. */
const MILESTONES = Array.from(
  { length: MAX_GAIN_DOLLARS / 100 + 1 },
  (_, i) => i * 100,
); // [0, 100, 200, …, 50000]

/** Level names for the first 10 defined levels + generic fallback. */
const LEVEL_NAMES: Record<number, string> = {
  1: 'Beginner Trader',
  2: 'Novice Investor',
  3: 'Apprentice Trader',
  4: 'Trader',
  5: 'Senior Trader',
  6: 'Portfolio Manager',
  7: 'Market Analyst',
  8: 'Hedge Fund Manager',
  9: 'Market Legend',
  10: 'Wolf of Wall Street',
};

function getLevelName(level: number): string {
  return LEVEL_NAMES[level] ?? `Elite Trader Lv.${level}`;
}

function getLevelColor(level: number): string {
  const COLORS = [
    '#94A3B8', '#60A5FA', '#34D399', '#F59E0B', '#F97316',
    '#EF4444', '#8B5CF6', '#EC4899', '#F5C518', '#00D4AA',
    '#06B6D4', '#84CC16', '#F43F5E', '#A855F7', '#0EA5E9',
    '#22C55E', '#EAB308', '#FB923C', '#6366F1', '#14B8A6',
  ];
  return COLORS[(level - 1) % COLORS.length];
}

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


// ─── Single-reward card ──────────────────────────────────────────────────────

interface RewardCardProps {
  reward: TrophyReward;
  unlocked: boolean;
}

function RewardCard({ reward, unlocked }: RewardCardProps) {
  const isAvatar = reward.type === 'avatar';
  const typeColor = isAvatar ? Colors.brand.primary : Colors.brand.accent;

  return (
    <View style={[styles.rewardCard, !unlocked && styles.rewardCardLocked]}>
      <LinearGradient
        colors={unlocked ? [reward.color, `${reward.color}44`] : ['#1A2235', '#111827']}
        style={styles.rewardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header row: gain threshold + type pill */}
        <View style={styles.rewardHeader}>
          <View style={[styles.gainTag, { backgroundColor: unlocked ? reward.color : Colors.bg.tertiary }]}>
            <Text style={styles.gainTagText}>
              {reward.gainThreshold === 0 ? 'START' : `+$${reward.gainThreshold.toLocaleString()}`}
            </Text>
          </View>
          <View style={[styles.typePill, { backgroundColor: `${typeColor}22` }]}>
            <Text style={[styles.typePillText, { color: typeColor }]}>
              {isAvatar ? 'AVATAR' : 'PET'}
            </Text>
          </View>
        </View>

        {/* Reward item */}
        <View style={styles.rewardSingle}>
          <View style={[styles.rewardFrame, { borderColor: unlocked ? reward.color : `${reward.color}40` }]}>
            <Text style={[styles.rewardEmoji, !unlocked && { opacity: 0.45 }]}>
              {reward.emoji}
            </Text>
            {!unlocked && (
              <View style={styles.rewardLockOverlay}>
                <Text style={styles.rewardLockIcon}>—</Text>
              </View>
            )}
          </View>
          <Text style={[styles.rewardName, !unlocked && styles.lockedText]}>
            {reward.name}
          </Text>
          {!unlocked && (
            <Text style={styles.rewardTypeHint}>
              {reward.type === 'avatar' ? 'Avatar' : 'Pet'}
            </Text>
          )}
        </View>

        {!unlocked && (
          <Text style={styles.unlockHint}>
            Earn +${reward.gainThreshold.toLocaleString()} to unlock
          </Text>
        )}
      </LinearGradient>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TrophyRoadScreen() {
  const { user, portfolio, isSidebarOpen, setSidebarOpen } = useAppStore();
  const scrollRef = useRef<ScrollView>(null);

  const currentGainDollars = portfolio?.totalGainLoss ?? 0;
  const currentLevel       = user?.level ?? 1;
  const xpInfo             = getXPProgress(user?.xp ?? 0);
  const levelColor         = getLevelColor(currentLevel);

  const scrollToMe = useCallback(() => {
    // For $0 gains just jump straight to the bottom (the Start node)
    if (currentGainDollars <= 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    const idx = [...MILESTONES].reverse()
      .findIndex(m => currentGainDollars >= m && currentGainDollars < m + 100);
    const ROW_H = SEGMENT_H * 2 + NODE_SIZE; // ≈ 116px per row
    // Reward-card rows (every $1,000) are ~180px taller; account for those above idx
    const rewardRowsAbove = Math.floor((MAX_GAIN_DOLLARS - currentGainDollars) / 1000);
    const targetY = Math.max(0, (idx - 2) * ROW_H + rewardRowsAbove * 180);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [currentGainDollars]);

  // Scroll to current position on mount
  useEffect(() => {
    const timer = setTimeout(scrollToMe, 400);
    return () => clearTimeout(timer);
  }, [scrollToMe]);

  // Build reversed milestone list with zone-transition markers
  const reversedMilestones = [...MILESTONES].reverse();

  return (
    <View style={styles.container}>
      <AppHeader title="Trophy Road" />

      {/* ── Status Header ── */}
      <LinearGradient
        colors={['#0D1830', '#0A1225', Colors.bg.primary]}
        style={styles.header}
      >
        <Text style={styles.headerSub}>Grow your portfolio to unlock rewards</Text>

        {/* Current status card */}
        <View style={styles.statusCard}>
          <View style={[styles.levelCircle, { backgroundColor: levelColor }]}>
            <Text style={styles.levelCircleText}>{currentLevel}</Text>
          </View>

          <View style={styles.statusInfo}>
            <View style={[styles.levelPill, { backgroundColor: levelColor }]}>
              <Text style={styles.levelPillText}>Level {currentLevel}</Text>
            </View>
            <Text style={styles.statusName}>{getLevelName(currentLevel)}</Text>
            <Text style={styles.statusGain}>
              Gains: {currentGainDollars >= 0 ? '+' : ''}{formatCurrency(currentGainDollars)}
            </Text>
            {xpInfo.nextLevel && (
              <Text style={styles.statusNext}>
                {xpInfo.xpInLevel} / {xpInfo.xpNeeded} XP to Lv.{xpInfo.nextLevel.level}
              </Text>
            )}
          </View>
        </View>

        {/* XP bar */}
        <View style={styles.xpBarOuter}>
          <Animated.View
            style={[
              styles.xpBarInner,
              { width: `${Math.min(xpInfo.progress * 100, 100)}%`, backgroundColor: levelColor },
            ]}
          />
        </View>
      </LinearGradient>

      {/* ── Road + floating button ── */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.road}
          contentContainerStyle={styles.roadContent}
          showsVerticalScrollIndicator={false}
        >
          {reversedMilestones.map((gainDollars, revIdx) => {
            const isAchieved  = currentGainDollars >= gainDollars;
            const isCurrent   = currentGainDollars >= gainDollars && currentGainDollars < gainDollars + 100;
            // reward cards removed
            const isFirst     = revIdx === MILESTONES.length - 1;
            const isLast      = revIdx === 0;

            // Spine colours using fixed accent
            const segmentColor  = isAchieved ? FIXED_ACCENT : `${FIXED_ACCENT}20`;
            const nodeBorderCol = isCurrent ? levelColor : isAchieved ? FIXED_ACCENT : `${FIXED_ACCENT}35`;
            const nodeBgCol     = isCurrent ? `${levelColor}33` : isAchieved ? `${FIXED_ACCENT}22` : Colors.bg.secondary;

            return (
              <React.Fragment key={gainDollars}>
                <View style={styles.milestoneRow}>

                  {/* Road spine */}
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
                        ? <PulsingDot color={levelColor} />
                        : <Text style={[styles.nodeCheck, { color: FIXED_ACCENT, opacity: isAchieved ? 1 : 0.2 }]}>
                            {isAchieved ? '✓' : ''}
                          </Text>
                      }
                    </View>
                    {!isFirst && (
                      <View style={[styles.segment, { backgroundColor: segmentColor }]} />
                    )}
                  </View>

                  {/* Milestone label */}
                  <View style={styles.milestoneInfo}>
                    <View style={isAchieved && !isCurrent
                      ? [styles.gainPill, { backgroundColor: `${FIXED_ACCENT}20`, borderColor: `${FIXED_ACCENT}40` }]
                      : undefined}>
                      <Text style={[
                        styles.milestonePct,
                        isAchieved ? [styles.milestonePctDone, { color: isCurrent ? levelColor : FIXED_ACCENT }] : styles.milestonePctLocked,
                        isCurrent && { fontWeight: FontWeight.extrabold },
                      ]}>
                        {gainDollars === 0 ? 'Start' : `+$${gainDollars.toLocaleString()}`}
                      </Text>
                    </View>
                    {gainDollars > 0 && (
                      <View style={[styles.xpPill, { backgroundColor: `${FIXED_ACCENT}20`, borderColor: `${FIXED_ACCENT}40` }]}>
                        <Text style={[styles.milestoneXP, { color: FIXED_ACCENT, opacity: isAchieved ? 1 : 0.35 }]}>
                          +{XP_PER_100} XP
                        </Text>
                      </View>
                    )}
                    {isCurrent && (
                      <View style={[styles.hereBadge, { backgroundColor: levelColor }]}>
                        <Text style={styles.hereText}>YOU ARE HERE</Text>
                      </View>
                    )}
                  </View>

                  {/* Reward cards removed */}
                </View>
              </React.Fragment>
            );
          })}

          <View style={styles.bottomPad} />
        </ScrollView>

        {/* ── Scroll-to-me FAB ── */}
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const NODE_SIZE  = 32;
const SEGMENT_H  = 42;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0E1A' },

  // Header
  header: {
    paddingTop: 54,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.base,
    gap: 4,
    alignItems: 'center',
  },


  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
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
  levelCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  levelCircleText: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: '#fff' },

  statusInfo: { flex: 1, gap: 3 },
  levelPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginBottom: 2,
  },
  levelPillText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  statusName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text.primary },
  statusGain: { fontSize: FontSize.xs, color: Colors.brand.accent },
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

  // Pill wrapper for achieved milestone labels
  gainPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 1,
  },

  // Pill wrapper for XP labels
  xpPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },

  // Spine
  spineCol: { alignItems: 'center', width: NODE_SIZE, flexShrink: 0 },
  segment: {
    width: 3,
    height: SEGMENT_H,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 2,
  },
  segmentDone: { backgroundColor: Colors.brand.primary },
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
  nodeDone: {
    borderColor: Colors.brand.primary,
    backgroundColor: `${Colors.brand.primary}22`,
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

  // Milestone text
  milestoneInfo: {
    paddingTop: SEGMENT_H + NODE_SIZE / 2 - 10,
    flex: 1,
    gap: 2,
  },
  milestonePct: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  milestonePctDone: { color: Colors.text.primary },
  milestonePctLocked: { color: Colors.text.tertiary },
  milestoneXP: { fontSize: FontSize.xs, color: Colors.brand.accent },
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

  // Reward card
  rewardCol: { flex: 2, paddingTop: SEGMENT_H - 6 },
  rewardCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 8,
  },
  rewardCardLocked: { opacity: 0.7 },
  rewardGradient: { padding: 10, gap: 8 },

  rewardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gainTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  gainTagText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },
  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    flex: 1,
    alignItems: 'center',
  },
  typePillText: { fontSize: 10, fontWeight: FontWeight.bold },

  rewardSingle: { alignItems: 'center', gap: 4 },
  rewardFrame: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rewardLockOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardLockIcon: { fontSize: 10 },
  rewardEmoji: { fontSize: 26 },
  rewardName: {
    fontSize: FontSize.xs,
    color: Colors.text.primary,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  rewardTypeHint: {
    fontSize: 9,
    color: Colors.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  lockedText: { color: Colors.text.secondary },
  unlockHint: { fontSize: FontSize.xs, color: Colors.text.tertiary, textAlign: 'center', fontStyle: 'italic' },

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
