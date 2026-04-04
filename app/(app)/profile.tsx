import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore';
import { signOut, deleteAccount } from '../../src/services/auth';
import { ACHIEVEMENTS, LEVELS, getXPProgress } from '../../src/constants/achievements';
import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { formatCurrency, formatPercent, formatAccountNumber } from '../../src/utils/formatters';
import type { AvatarConfig } from '../../src/types';

const { width: PROFILE_SW } = Dimensions.get('window');
const PROFILE_SWATCH_SIZE = Math.floor((PROFILE_SW - Spacing.base * 2 - 8 * 11) / 12);

const ACCENT_COLORS = [
  { label: 'Sky Blue',   color: '#00B3E6' },
  { label: 'Emerald',    color: '#00D4AA' },
  { label: 'Purple',     color: '#7C3AED' },
  { label: 'Rose',       color: '#EC4899' },
  { label: 'Gold',       color: '#F5C518' },
  { label: 'Orange',     color: '#F59E0B' },
  { label: 'Lime',       color: '#22C55E' },
  { label: 'Red',        color: '#EF4444' },
  { label: 'Indigo',     color: '#6366F1' },
  { label: 'Cyan',       color: '#06B6D4' },
  { label: 'White',      color: '#F1F5F9' },
  { label: 'Coral',      color: '#FF6B6B' },
];

const TAB_COLOR_OPTIONS = [
  { label: 'Social',  tab: 'social',      defaultColor: '#EC4899', icon: '💬' },
  { label: 'Trade',   tab: 'trade',       defaultColor: '#00C853', icon: '📊' },
  { label: 'Profile', tab: 'profile',     defaultColor: '#7C3AED', icon: '👤' },
];

const TAB_PALETTE = [
  '#F5C518', '#EC4899', '#00D4AA', '#00C853',
  '#F59E0B', '#7C3AED', '#00B3E6', '#EF4444',
  '#22C55E', '#6366F1', '#FF6B6B', '#06B6D4',
];

const TILE_STYLES: { key: 'default' | 'vivid' | 'glass'; label: string; desc: string; preview: string }[] = [
  { key: 'default', label: 'Default',  desc: 'Classic dark cards',   preview: '#111827' },
  { key: 'vivid',   label: 'Vivid',    desc: 'Colourful tinted cards', preview: '#1C1040' },
  { key: 'glass',   label: 'Glass',    desc: 'Frosted glass effect',  preview: 'rgba(255,255,255,0.08)' },
];

function AvatarPreview({ config, size = 'md' }: { config: AvatarConfig; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 80 : size === 'sm' ? 40 : 60;
  const fontSize = size === 'lg' ? 44 : size === 'sm' ? 22 : 32;
  const animal = config?.animal ?? '🐶';
  const bg = config?.bgColor ?? Colors.bg.tertiary;
  return (
    <View style={{
      width: dim, height: dim, borderRadius: dim / 2,
      backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: Colors.brand.primary,
    }}>
      <Text style={{ fontSize }}>{animal}</Text>
    </View>
  );
}

function DefaultAvatarCircle({ initial, levelColor }: { initial: string; levelColor: string }) {
  return (
    <LinearGradient colors={[levelColor, `${levelColor}88`]} style={profileAvatarStyles.circle}>
      <Text style={profileAvatarStyles.initial}>{initial.toUpperCase()}</Text>
    </LinearGradient>
  );
}

const profileAvatarStyles = StyleSheet.create({
  circle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 32, fontWeight: FontWeight.bold, color: '#fff' },
});

export default function ProfileScreen() {
  const {
    user, portfolio, setUser,
    appColorMode, setAppColorMode,
    appAccentColor, setAppAccentColor,
    appTileStyle, setAppTileStyle,
    appTabColors, setAppTabColor,
    isSidebarOpen, setSidebarOpen,
  } = useAppStore();
  const tabColor = appTabColors['profile'] ?? '#7C3AED';
  const isLight = appColorMode === 'light';
  const C = isLight ? LightColors : Colors;
  const screenBg = isLight ? '#F5F0FF' : '#4A1898';
  const gc = (a: string, b: string, c: string) => [a,b,c] as any;
  const gcFull = (a: string, b: string, c: string, d: string) => [a,b,c,d] as any;
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  if (!user) return null;

  const xpInfo = getXPProgress(user.xp || 0);
  const levelColor = LEVELS.find(l => l.level === user.level)?.color ?? Colors.brand.primary;

  const handleSignOut = () => setSignOutVisible(true);

  const confirmSignOut = async () => {
    setSignOutVisible(false);
    await signOut();
    setUser(null);
    router.replace('/(auth)/welcome');
  };

  const confirmDeleteAccount = async () => {
    setDeleteVisible(false);
    await deleteAccount(user.id);
    setUser(null);
    router.replace('/(auth)/welcome');
  };

  const totalGainPercent = portfolio?.totalGainLossPercent ?? 0;
  const unlockedAchievements = (user.achievements || []).filter(a => a.unlockedAt);

  return (
    <View style={[styles.rootContainer, { backgroundColor: screenBg }]}>
      {/* Full-screen colour wash */}
      <LinearGradient
        colors={gcFull(`${tabColor}80`, `${tabColor}50`, `${tabColor}30`, screenBg)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={gc('transparent', `${tabColor}30`, `${tabColor}40`)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={gc(`${tabColor}28`, 'transparent', `${tabColor}28`)}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
      />
      <AppHeader title="Profile" />
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <LinearGradient
        colors={gcFull(`${tabColor}CC`, `${tabColor}88`, `${tabColor}22`, screenBg)}
        style={styles.headerGradient}
      >
        <View style={styles.avatarContainer}>
          {user.avatarConfig ? (
            <View style={styles.avatarWrapper}>
              <AvatarPreview config={user.avatarConfig} size="md" />
              <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
                <Text style={styles.levelBadgeText}>Lv.{user.level}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.avatarWrapper}>
              <DefaultAvatarCircle initial={user.username[0] ?? '?'} levelColor={levelColor} />
              <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
                <Text style={styles.levelBadgeText}>Lv.{user.level}</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.displayName, { color: C.text.primary }]}>{user.displayName}</Text>
        <Text style={[styles.username, { color: C.text.secondary }]}>@{user.username}</Text>
        <Text style={[styles.accountNumber, { color: C.text.tertiary }]}>{formatAccountNumber(user.accountNumber)}</Text>

        {/* XP Bar */}
        <View style={styles.xpContainer}>
          <View style={styles.xpLabelRow}>
            <Text style={[styles.xpLabel, { color: C.text.secondary }]}>{xpInfo.current.title}</Text>
            <Text style={[styles.xpValue, { color: C.text.secondary }]}>{user.xp} XP</Text>
          </View>
          <View style={styles.xpTrack}>
            <LinearGradient
              colors={[levelColor, `${levelColor}88`]}
              style={[styles.xpFill, { width: `${Math.min(xpInfo.progress * 100, 100)}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          {xpInfo.nextLevel && (
            <Text style={[styles.xpNext, { color: C.text.tertiary }]}>
              {xpInfo.xpInLevel} / {xpInfo.xpNeeded} XP to {xpInfo.nextLevel.title}
            </Text>
          )}
        </View>
      </LinearGradient>

      {/* Profile Header */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabPill, { backgroundColor: tabColor }]}
        >
          <Text style={[styles.tabPillText, { color: '#fff' }]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      <>
      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Portfolio Value"
          value={formatCurrency(portfolio?.totalValue ?? user.startingBalance)}
          icon="💼"
        />
        <StatCard
          label="Total Gain"
          value={formatPercent(totalGainPercent)}
          icon={totalGainPercent >= 0 ? '📈' : '📉'}
          valueColor={totalGainPercent >= 0 ? Colors.market.gain : Colors.market.loss}
        />
        <StatCard
          label="Starting Balance"
          value={formatCurrency(user.startingBalance)}
          icon="💰"
        />
        <StatCard
          label="Achievements"
          value={`${unlockedAchievements.length} / ${ACHIEVEMENTS.length}`}
          icon="🏆"
        />
      </View>

      {/* Settings */}
      <SectionHeader title="Settings" icon="⚙️" />
      <View style={[styles.settingsContainer, { backgroundColor: C.bg.secondary, borderColor: C.border.default }]}>
        <SettingsRow
          label="Account Number"
          right={<Text style={[styles.settingsValue, { color: C.text.secondary }]}>{formatAccountNumber(user.accountNumber)}</Text>}
        />
      </View>

      {/* ── Appearance Settings ── */}
      <View style={[styles.settingsSection, { borderTopColor: C.border.default }]}>
        <Text style={[styles.sectionTitle, { color: C.text.primary }]}>Appearance</Text>

        {/* Dark / Light Mode */}
        <Text style={[styles.settingsSubhead, { color: C.text.secondary }]}>Mode</Text>
        <View style={[styles.modeRow, { backgroundColor: C.bg.tertiary, borderColor: C.border.default }]}>
          <TouchableOpacity
            style={[styles.modeBtn, appColorMode === 'dark' && { backgroundColor: appAccentColor }]}
            onPress={() => setAppColorMode('dark')}
          >
            <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: appColorMode === 'dark' ? '#fff' : C.text.primary }}>🌑  Dark</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, appColorMode === 'light' && { backgroundColor: appAccentColor }]}
            onPress={() => setAppColorMode('light')}
          >
            <Text style={{ fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: appColorMode === 'light' ? '#fff' : C.text.primary }}>☀️  Light</Text>
          </TouchableOpacity>
        </View>

        {/* Accent Colour */}
        <Text style={[styles.settingsSubhead, { color: C.text.secondary }]}>Accent Colour</Text>
        <View style={styles.colorGrid}>
          {ACCENT_COLORS.map(({ label, color }) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                appAccentColor === color && styles.colorSwatchActive,
              ]}
              onPress={() => setAppAccentColor(color)}
            >
              {appAccentColor === color && <Text style={{ color: '#fff', fontSize: 16, fontWeight: FontWeight.bold }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tile Style and Screen Colours removed */}

        {/* Reset */}
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: C.border.default }]}
          onPress={() => {
            setAppColorMode('dark');
            setAppAccentColor('#00B3E6');
            setAppTileStyle('default');
            TAB_COLOR_OPTIONS.forEach(({ tab, defaultColor }) => setAppTabColor(tab, defaultColor));
          }}
        >
          <Text style={[styles.resetText, { color: C.text.tertiary }]}>↺  Reset to Defaults</Text>
        </TouchableOpacity>
      </View>

      {/* Achievements */}
      <SectionHeader title="Achievements" icon="🏆" />
      <View style={styles.achievementsList}>
        {ACHIEVEMENTS.map(ach => {
          const unlocked = (user.achievements || []).some(a => a.id === ach.id && a.unlockedAt);
          return (
            <View
              key={ach.id}
              style={[styles.achievementRow, { backgroundColor: C.bg.secondary, borderColor: C.border.default }, !unlocked && styles.achievementRowLocked]}
            >
              <View style={[styles.achIconWrapper, { backgroundColor: unlocked ? `${Colors.brand.gold}22` : `${C.bg.tertiary}88` }]}>
                <Text style={[styles.achievementIcon, !unlocked && { opacity: 0.4 }]}>{ach.icon}</Text>
              </View>
              <View style={styles.achBody}>
                <View style={styles.achTitleRow}>
                  <Text style={[styles.achievementTitle, { color: C.text.primary }, !unlocked && styles.lockedText]}>
                    {ach.title}
                  </Text>
                  {unlocked
                    ? <Text style={styles.xpReward}>+{ach.xpReward} XP ✓</Text>
                    : <Text style={styles.xpRewardLocked}>+{ach.xpReward} XP</Text>
                  }
                </View>
                {unlocked
                  ? <Text style={[styles.achDescription, { color: C.text.secondary }]}>{ach.description}</Text>
                  : <Text style={[styles.achRequirement, { color: C.text.tertiary }]}>{ach.requirement ?? ach.description}</Text>
                }
              </View>
              {!unlocked && <Text style={styles.lockIcon}>🔒</Text>}
            </View>
          );
        })}
      </View>

      {/* XP Levels */}
      <SectionHeader title="XP Levels" icon="⭐" />
      <View style={styles.levelsList}>
        {LEVELS.map(lvl => {
          const isCurrentLevel = user.level === lvl.level;
          const isUnlocked = (user.xp || 0) >= lvl.xpRequired;
          return (
            <View
              key={lvl.level}
              style={[
                styles.levelRow,
                { backgroundColor: C.bg.secondary, borderColor: C.border.default },
                isCurrentLevel && { borderColor: `${lvl.color}88`, backgroundColor: `${lvl.color}0D` },
              ]}
            >
              <View style={[styles.levelIconBadge, { backgroundColor: `${lvl.color}22` }]}>
                <Text style={styles.levelIconText}>{lvl.icon}</Text>
              </View>
              <View style={styles.levelBody}>
                <Text style={[styles.levelTitle, { color: C.text.primary }, !isUnlocked && styles.lockedText]}>
                  {lvl.title}
                </Text>
                <Text style={[styles.levelSubtitle, { color: C.text.tertiary }]}>
                  {lvl.xpRequired === 0 ? 'Starting level' : `${lvl.xpRequired} XP`}
                </Text>
              </View>
              <View style={styles.levelRight}>
                <View style={[styles.levelBadgePill, { backgroundColor: `${lvl.color}22` }]}>
                  <Text style={[styles.levelBadgePillText, { color: lvl.color }]}>Lv.{lvl.level}</Text>
                </View>
              </View>
              {isCurrentLevel && (
                <View style={[styles.currentLevelBar, { backgroundColor: lvl.color }]} />
              )}
            </View>
          );
        })}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <TouchableOpacity style={styles.deleteAccountButton} onPress={() => setDeleteVisible(true)}>
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: C.text.tertiary }]}>CapitalQuest v1.0.0 · Virtual trading only · No real money involved</Text>
      </>
    </ScrollView>

    {/* ── Delete Account Confirmation ── */}
    <Modal
      visible={deleteVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setDeleteVisible(false)}
    >
      <View style={styles.signOutOverlay}>
        <View style={styles.signOutCard}>
          <Text style={styles.deleteModalIcon}>⚠️</Text>
          <Text style={[styles.signOutTitle, { color: C.text.primary }]}>Delete Account</Text>
          <Text style={[styles.deleteModalMessage, { color: C.text.secondary }]}>
            This will permanently delete your account, portfolio, and all progress. This cannot be undone.
          </Text>
          <View style={styles.signOutButtons}>
            <TouchableOpacity style={styles.signOutCancelBtn} onPress={() => setDeleteVisible(false)}>
              <Text style={[styles.signOutCancelText, { color: C.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDeleteAccount}>
              <Text style={styles.signOutConfirmText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* ── Sign Out Confirmation ── */}
    <Modal
      visible={signOutVisible}
      animationType="fade"
      transparent
      onRequestClose={() => setSignOutVisible(false)}
    >
      <View style={styles.signOutOverlay}>
        <View style={styles.signOutCard}>
          <Text style={[styles.signOutTitle, { color: C.text.primary }]}>Sign Out</Text>
          <Text style={[styles.signOutMessage, { color: C.text.secondary }]}>Are you sure you want to sign out?</Text>
          <View style={styles.signOutButtons}>
            <TouchableOpacity style={styles.signOutCancelBtn} onPress={() => setSignOutVisible(false)}>
              <Text style={[styles.signOutCancelText, { color: C.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutConfirmBtn} onPress={confirmSignOut}>
              <Text style={styles.signOutConfirmText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <Sidebar visible={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

function StatCard({ label, value, icon, valueColor }: {
  label: string; value: string; icon: string; valueColor?: string;
}) {
  const { appColorMode } = useAppStore();
  const SC = appColorMode === 'light' ? LightColors : Colors;
  return (
    <View style={[styles.statCard, { backgroundColor: SC.bg.secondary, borderColor: SC.border.default }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: SC.text.primary }, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      <Text style={[styles.statLabel, { color: SC.text.tertiary }]}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  const { appColorMode } = useAppStore();
  const SHC = appColorMode === 'light' ? LightColors : Colors;
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={[styles.sectionTitle, { color: SHC.text.primary }]}>{title}</Text>
    </View>
  );
}

function SettingsRow({ label, right }: { label: string; right: React.ReactNode }) {
  const { appColorMode } = useAppStore();
  const SRC = appColorMode === 'light' ? LightColors : Colors;
  return (
    <View style={[styles.settingsRow, { borderBottomColor: SRC.border.subtle }]}>
      <Text style={[styles.settingsLabel, { color: SRC.text.primary }]}>{label}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  deleteAccountButton: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.market.loss + '60',
    alignItems: 'center',
  },
  deleteAccountText: {
    color: Colors.market.loss,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },
  deleteModalIcon: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  deleteModalMessage: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: '#8B0000',
    alignItems: 'center',
  },
  signOutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  signOutCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  signOutTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  signOutMessage: {
    fontSize: FontSize.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  signOutButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  signOutCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
  },
  signOutCancelText: {
    color: Colors.text.secondary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },
  signOutConfirmBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.market.loss,
    alignItems: 'center',
  },
  signOutConfirmText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.base,
  },
  rootContainer: { flex: 1 },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  headerGradient: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    gap: 4,
  },
  avatarContainer: { position: 'relative', marginBottom: 8 },
  avatarWrapper: { position: 'relative' },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.bg.primary,
  },
  levelBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  displayName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
    marginTop: 4,
  },
  username: { fontSize: FontSize.base, color: Colors.text.secondary },
  accountNumber: {
    fontSize: FontSize.sm,
    color: Colors.text.tertiary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  xpContainer: { width: '100%', gap: 6, marginTop: 12 },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabel: { fontSize: FontSize.sm, color: Colors.text.secondary, fontWeight: FontWeight.medium },
  xpValue: { fontSize: FontSize.sm, color: Colors.text.secondary },
  xpTrack: {
    height: 6,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', borderRadius: 3 },
  xpNext: { fontSize: FontSize.xs, color: Colors.text.tertiary, textAlign: 'center' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: Spacing.base,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  statIcon: { fontSize: 24 },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  statLabel: { fontSize: FontSize.xs, color: Colors.text.secondary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  achievementsList: {
    gap: 8,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  levelsList: {
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  levelIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelIconText: { fontSize: 20 },
  levelBody: { flex: 1, gap: 2 },
  levelTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  levelSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  levelRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  levelBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  levelBadgePillText: {
    fontSize: 10,
    fontWeight: FontWeight.extrabold,
  },
  currentLevelBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  achievementRowLocked: {
    borderColor: `${Colors.border.default}66`,
  },
  achIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  achBody: { flex: 1, gap: 3 },
  achTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  achievementIcon: { fontSize: 24 },
  achievementTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.primary,
    flex: 1,
  },
  achDescription: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  achRequirement: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  lockedText: { color: Colors.text.tertiary },
  xpReward: { fontSize: FontSize.xs, color: Colors.brand.accent, fontWeight: FontWeight.semibold },
  xpRewardLocked: { fontSize: FontSize.xs, color: Colors.text.tertiary },
  lockIcon: { fontSize: 16, marginLeft: 2 },
  settingsContainer: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  settingsLabel: { fontSize: FontSize.base, color: Colors.text.primary },
  settingsValue: { fontSize: FontSize.base, color: Colors.text.secondary },
  signOutButton: {
    margin: Spacing.base,
    marginTop: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.market.loss,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.market.loss,
  },
  version: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  // ─── Tab Switcher ───────────────────────────────────────────────────────────
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.full,
    padding: 4,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  tabPillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // ── Settings section styles ──
  settingsSection: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing['2xl'],
    paddingTop: Spacing.xl,
    borderTopWidth: 1,
  },
  settingsSubhead: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    marginTop: Spacing.base,
  },
  modeRow: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: Radius.lg,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  colorSwatch: {
    width: PROFILE_SWATCH_SIZE + 6,
    height: PROFILE_SWATCH_SIZE + 6,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#fff',
    borderWidth: 2.5,
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  tileOption: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.md,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tilePreviewBox: {
    width: '100%',
    height: 36,
    borderRadius: Radius.md,
    marginBottom: 8,
    borderWidth: 1,
  },
  tileLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  tileDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  tileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabColorRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tabColorLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: 8,
  },
  tabMiniSwatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  miniSwatchActive: {
    borderColor: '#fff',
    borderWidth: 2,
    transform: [{ scale: 1.2 }],
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Spacing.base,
  },
  resetText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
