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

// Fixed accent color
const FIXED_ACCENT = Colors.brand.primary;

// ─── 10 evenly-spaced milestones (up to $50,000) ─────────────────────────────
const MILESTONES = [
  { gain: 0,     label: 'Start',     color: '#94A3B8' },
  { gain: 5000,  label: '+$5,000',   color: '#60A5FA' },
  { gain: 10000, label: '+$10,000',  color: '#34D399' },
  { gain: 15000, label: '+$15,000',  color: '#F59E0B' },
  { gain: 20000, label: '+$20,000',  color: '#F97316' },
  { gain: 25000, label: '+$25,000',  color: '#EF4444' },
  { gain: 30000, label: '+$30,000',  color: '#8B5CF6' },
  { gain: 35000, label: '+$35,000',  color: '#EC4899' },
  { gain: 40000, label: '+$40,000',  color: '#F5C518' },
  { gain: 50000, label: '+$50,000',  color: '#00D4AA' },
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


// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TrophyRoadScreen() {
  const { user, portfolio, isSidebarOpen, setSidebarOpen } = useAppStore();
  const scrollRef = useRef<ScrollView>(null);

  const currentGainDollars = portfolio?.totalGainLoss ?? 0;
  const currentLevel       = user?.level ?? 1;
  const xpInfo             = getXPProgress(user?.xp ?? 0);
  const levelColor         = MILESTONES[Math.min(currentLevel - 1, MILESTONES.length - 1)].color;

  // Highest milestone first (top = $45k, bottom = Start)
  const reversed = [...MILESTONES].reverse();

  // Find which milestone the user is currently at
  const currentMilestoneIdx = (() => {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (currentGainDollars >= MILESTONES[i].gain) return i;
    }
    return 0;
  })();
  const currentGain = MILESTONES[currentMilestoneIdx].gain;

  const scrollToMe = useCallback(() => {
    const idx = reversed.findIndex(m => m.gain === currentGain);
    const ROW_H = SEGMENT_H * 2 + NODE_SIZE;
    const targetY = Math.max(0, (idx - 1) * ROW_H);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [currentGain]);

  useEffect(() => {
    const timer = setTimeout(scrollToMe, 400);
    return () => clearTimeout(timer);
  }, [scrollToMe]);

  return (
    <View style={styles.container}>
      <AppHeader title="Trophy Road" />

      {/* ── Status Header ── */}
      <LinearGradient
        colors={['#0D1830', '#0A1225', Colors.bg.primary]}
        style={styles.header}
      >
        <Text style={styles.headerSub}>Grow your portfolio to unlock milestones</Text>

        {/* Current status card */}
        <View style={styles.statusCard}>
          <View style={[styles.levelCircle, { backgroundColor: levelColor }]}>
            <Text style={styles.levelCircleText}>{currentLevel}</Text>
          </View>

          <View style={styles.statusInfo}>
            <View style={[styles.levelPill, { backgroundColor: levelColor }]}>
              <Text style={styles.levelPillText}>Level {currentLevel}</Text>
            </View>
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

      {/* ── Road with 10 milestones ── */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.road}
          contentContainerStyle={styles.roadContent}
          showsVerticalScrollIndicator={false}
        >
          {reversed.map((ms, idx) => {
            const isAchieved = currentGainDollars >= ms.gain;
            const isCurrent  = ms.gain === currentGain;
            const isFirst    = idx === reversed.length - 1; // bottom node ($0)
            const isLast     = idx === 0; // top node ($45k)

            const segmentColor  = isAchieved ? FIXED_ACCENT : `${FIXED_ACCENT}20`;
            const nodeBorderCol = isCurrent ? ms.color : isAchieved ? FIXED_ACCENT : `${FIXED_ACCENT}35`;
            const nodeBgCol     = isCurrent ? `${ms.color}33` : isAchieved ? `${FIXED_ACCENT}22` : Colors.bg.secondary;

            // Milestone number (1-10, bottom to top)
            const msNumber = MILESTONES.length - idx;

            return (
              <React.Fragment key={ms.gain}>
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
                        ? <PulsingDot color={ms.color} />
                        : isAchieved
                          ? <Text style={[styles.nodeCheck, { color: FIXED_ACCENT }]}>✓</Text>
                          : <Text style={[styles.nodeLevelNum, { color: `${ms.color}55` }]}>{msNumber}</Text>
                      }
                    </View>
                    {!isFirst && (
                      <View style={[styles.segment, { backgroundColor: segmentColor }]} />
                    )}
                  </View>

                  {/* Milestone label */}
                  <View style={styles.milestoneInfo}>
                    <Text style={[
                      styles.levelTitle,
                      isAchieved
                        ? { color: isCurrent ? ms.color : FIXED_ACCENT }
                        : styles.milestonePctLocked,
                      isCurrent && { fontWeight: FontWeight.extrabold },
                    ]}>
                      {ms.label}
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

const NODE_SIZE  = 44;
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
  nodeIcon: { fontSize: 22 },
  nodeLevelNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // Milestone text
  milestoneInfo: {
    paddingTop: SEGMENT_H + NODE_SIZE / 2 - 10,
    flex: 1,
    gap: 2,
  },
  levelTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
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
