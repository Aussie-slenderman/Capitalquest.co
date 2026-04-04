import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import { useT } from '../../src/constants/translations';
import { Colors, LightColors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

const { width: SW } = Dimensions.get('window');

// ─── Preset palettes ─────────────────────────────────────────────────────────

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
  { label: 'Ranks',   tab: 'leaderboard', defaultColor: '#F5C518', icon: '🏆' },
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const {
    appColorMode, setAppColorMode,
    appAccentColor, setAppAccentColor,
    appTileStyle, setAppTileStyle,
    appTabColors, setAppTabColor,
    isSidebarOpen, setSidebarOpen,
  } = useAppStore();

  const t = useT();
  const isDark = appColorMode === 'dark';
  const isLight = !isDark;
  const C = isLight ? LightColors : Colors;

  // Colours derived from current mode
  const bg = isDark ? '#264E88' : '#F0F2F8';
  const sgc = (a: string, b: string, c: string) => [a,b,c] as any;
  const surface = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const border  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const txt     = isDark ? '#F1F5F9' : '#1A1A2E';
  const sub     = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      {/* Full-screen tint */}
      <LinearGradient
        colors={isDark
          ? [`${appAccentColor}30`, `${appAccentColor}18`, 'transparent']
          : [`${appAccentColor}20`, `${appAccentColor}10`, 'transparent']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={sgc('transparent', `${appAccentColor}15`, `${appAccentColor}25`)}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <AppHeader title={t('settings')} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Dark / Light Mode ── */}
        <Section title={t('mode')} icon="🌗" txt={txt}>
          <View style={[styles.modeRow, { backgroundColor: surface, borderColor: border }]}>
            <ModeButton
              label="🌑  Dark"
              active={isDark}
              onPress={() => setAppColorMode('dark')}
              accentColor={appAccentColor}
              txt={txt}
            />
            <ModeButton
              label="☀️  Light"
              active={!isDark}
              onPress={() => setAppColorMode('light')}
              accentColor={appAccentColor}
              txt={txt}
            />
          </View>
        </Section>

        {/* ── Accent Colour ── */}
        <Section title={t('accent_colour')} icon="🎨" txt={txt}>
          <Text style={[styles.sectionDesc, { color: sub }]}>
            Applied to headers, tab bar, and highlights
          </Text>
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
                {appAccentColor === color && <Text style={styles.colorCheckmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.accentPreview, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.accentDot, { backgroundColor: appAccentColor }]} />
            <Text style={[styles.accentPreviewText, { color: txt }]}>
              {ACCENT_COLORS.find(c => c.color === appAccentColor)?.label ?? 'Custom'}
            </Text>
            <View style={[styles.accentBar, { backgroundColor: appAccentColor }]} />
          </View>
        </Section>

        {/* ── Tile Style ── */}
        <Section title={t('tile_style')} icon="🃏" txt={txt}>
          <Text style={[styles.sectionDesc, { color: sub }]}>
            Controls how cards and panels appear
          </Text>
          <View style={styles.tileRow}>
            {TILE_STYLES.map(({ key, label, desc, preview }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.tileOption,
                  { borderColor: appTileStyle === key ? appAccentColor : border },
                  appTileStyle === key && { backgroundColor: `${appAccentColor}20` },
                ]}
                onPress={() => setAppTileStyle(key)}
              >
                <View style={[styles.tilePreviewBox, { backgroundColor: preview, borderColor: border }]} />
                <Text style={[styles.tileLabel, { color: txt }]}>{label}</Text>
                <Text style={[styles.tileDesc, { color: sub }]}>{desc}</Text>
                {appTileStyle === key && (
                  <View style={[styles.tileCheck, { backgroundColor: appAccentColor }]}>
                    <Text style={styles.tileCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* ── Tab Screen Colours ── */}
        <Section title={t('screen_colours')} icon="🖼️" txt={txt}>
          <Text style={[styles.sectionDesc, { color: sub }]}>
            Choose the highlight colour for each tab
          </Text>
          {TAB_COLOR_OPTIONS.map(({ label, tab, icon }) => {
            const current = appTabColors[tab] ?? TAB_COLOR_OPTIONS.find(t => t.tab === tab)?.defaultColor ?? '#00B3E6';
            return (
              <View key={tab} style={[styles.tabColorRow, { borderBottomColor: border }]}>
                <Text style={[styles.tabColorIcon]}>{icon}</Text>
                <Text style={[styles.tabColorLabel, { color: txt }]}>{label}</Text>
                <View style={styles.tabMiniSwatches}>
                  {TAB_PALETTE.map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.miniSwatch,
                        { backgroundColor: color },
                        current === color && styles.miniSwatchActive,
                      ]}
                      onPress={() => setAppTabColor(tab, color)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </Section>

        {/* ── Reset ── */}
        <TouchableOpacity
          style={[styles.resetBtn, { borderColor: border }]}
          onPress={() => {
            setAppColorMode('dark');
            setAppAccentColor('#00B3E6');
            setAppTileStyle('default');
            TAB_COLOR_OPTIONS.forEach(({ tab, defaultColor }) => setAppTabColor(tab, defaultColor));
          }}
        >
          <Text style={[styles.resetText, { color: sub }]}>↺  {t('reset_defaults')}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
    <Sidebar visible={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, icon, txt, children }: { title: string; icon: string; txt: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={[styles.sectionTitle, { color: txt }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ModeButton({ label, active, onPress, accentColor, txt }: {
  label: string; active: boolean; onPress: () => void; accentColor: string; txt: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.modeBtn,
        active && { backgroundColor: accentColor },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.modeBtnText, { color: active ? '#fff' : txt }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const SWATCH_SIZE = Math.floor((SW - Spacing.base * 2 - 8 * 11) / 12);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  headerSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },

  // Section
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },

  // Mode toggle
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
  modeBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
  },

  // Accent colour swatches
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  colorSwatch: {
    width: SWATCH_SIZE + 6,
    height: SWATCH_SIZE + 6,
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
  colorCheckmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },
  accentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  accentDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  accentPreviewText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  accentBar: {
    width: 60,
    height: 6,
    borderRadius: 3,
  },

  // Tile style
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  tileCheckText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.bold },

  // Per-tab colour rows
  tabColorRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tabColorIcon: { fontSize: 18, marginBottom: 4 },
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

  // Reset
  resetBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  resetText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
