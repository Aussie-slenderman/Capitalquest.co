import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore';
import { updateUser } from '../../src/services/auth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import type { AvatarConfig } from '../../src/types';

// ─── Page 1 animals ───────────────────────────────────────────────────────
const ANIMALS_1 = [
  '🐶','🐱','🦁','🐯','🐻','🐼',
  '🦊','🐺','🐨','🦘','🦝','🦡',
  '🐧','🦅','🦉','🦜','🦚','🦩',
  '🦄','🐉','🐸','🦎','🐢','🐊',
  '🦈','🐙','🐬','🐳','🦑','🦀',
  '🐘','🦒','🦓','🦏','🦛','🐪',
  '🦔','🦦','🦋','🐝','🐞','🦗',
  '🦭','🦬','🦫','🦙','🐑','🐗',
  '🦃','🐓','🐠','🐡','🦐','🦇',
  '🦌','🐿','🦤','🐛','🕷','🦂',
];

// ─── Page 2 animal groups ─────────────────────────────────────────────────
const ANIMALS_2_GROUPS = [
  { label: 'Primates',          animals: ['🐵','🐒','🦍','🦧'] },
  { label: 'Wild Cats',         animals: ['🐅','🐆'] },
  { label: 'Horses',            animals: ['🐴','🐎'] },
  { label: 'Cattle & Farm',     animals: ['🐮','🐂','🐃','🐄','🐷','🐖','🐏','🐐'] },
  { label: 'Giants & Ancients', animals: ['🐫','🦣','🦕','🦖'] },
  { label: 'Rodents & Rabbits', animals: ['🐭','🐁','🐀','🐹','🐰','🐇'] },
  { label: 'More Mammals',      animals: ['🦥','🦨','🐲','🐩','🦮','🐕','🐈','🐈\u200D\u2B1B'] },
  { label: 'More Birds',        animals: ['🐔','🐣','🐤','🐥','🐦','🕊','🦆','🦢','🪶'] },
  { label: 'More Ocean',        animals: ['🐋','🐟','🦞','🦪','🐚','🪸'] },
  { label: 'Reptiles',          animals: ['🐍'] },
  { label: 'More Bugs',         animals: ['🐌','🪲','🦟','🐜','🦠'] },
  { label: 'Forest & Plains',   animals: ['🫎','🫏'] },
];

// Flatten page-2 list, deduplicating against page 1
const page1Set = new Set(ANIMALS_1);
type AnimalGroup = { label: string; animals: string[] };
const ANIMALS_2: AnimalGroup[] = [];
const seenP2 = new Set<string>();
for (const g of ANIMALS_2_GROUPS) {
  const filtered = g.animals.filter(a => !page1Set.has(a) && !seenP2.has(a));
  filtered.forEach(a => seenP2.add(a));
  if (filtered.length > 0) ANIMALS_2.push({ label: g.label, animals: filtered });
}

const BG_COLORS = [
  '#1A2235', '#7C3AED', '#0369A1', '#15803D',
  '#B91C1C', '#C2410C', '#DB2777', '#0F766E',
  '#B45309', '#475569',
];

export default function AvatarScreen() {
  const { user, setUser } = useAppStore();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromProfile = params.from === 'profile';

  const existing = user?.avatarConfig;
  const [selected, setSelected] = useState<string>(existing?.animal ?? ANIMALS_1[0]);
  const [bgColor, setBgColor] = useState<string>(existing?.bgColor ?? BG_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [morePage, setMorePage] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      const config: AvatarConfig = { animal: selected, bgColor };
      if (user) {
        await updateUser(user.id, { avatarConfig: config });
        setUser({ ...user, avatarConfig: config });
      }
    } catch { /* non-critical */ }
    if (fromProfile) {
      router.back();
    } else {
      router.replace('/(auth)/terms');
    }
  };

  // ─── More Animals modal ─────────────────────────────────────────────────
  const renderMoreModal = () => (
    <Modal visible={morePage} animationType="slide" onRequestClose={() => setMorePage(false)}>
      <View style={[styles.container, Platform.OS === 'web' && { height: '100vh' as any }]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <TouchableOpacity style={styles.backBtn} onPress={() => setMorePage(false)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>More Animals</Text>
          <Text style={styles.subtitle}>Hundreds of extra animals to choose from</Text>

          {/* Mini preview */}
          <View style={[styles.miniPreview, { borderColor: Colors.border.default }]}>
            <View style={[styles.animalCircle, { backgroundColor: bgColor }]}>
              <Text style={styles.animalEmoji}>{selected}</Text>
            </View>
          </View>

          {/* Grouped animal grid */}
          {ANIMALS_2.map(group => (
            <View key={group.label} style={styles.sectionBox}>
              <Text style={styles.sectionLabel}>{group.label}</Text>
              <View style={styles.grid}>
                {group.animals.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.animalTile, selected === emoji && styles.animalTileSelected]}
                    onPress={() => setSelected(emoji)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.tileEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.doneButton} onPress={handleDone} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={[Colors.brand.primary, '#0096C7']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.doneText}>{saving ? 'Saving…' : fromProfile ? 'Save Changes' : "Let's Go →"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );

  // ─── Main page ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, Platform.OS === 'web' && { height: '100vh' as any }]}>
      {renderMoreModal()}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {fromProfile && (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>Choose Your Animal</Text>
        <Text style={styles.subtitle}>{fromProfile ? 'Update your animal and background' : 'Pick an animal and background to represent you'}</Text>

        {/* Preview */}
        <View style={styles.previewCard}>
          <View style={[styles.animalCircle, { backgroundColor: bgColor }]}>
            <Text style={styles.animalEmoji}>{selected}</Text>
          </View>
          <Text style={styles.previewName}>{user?.username ?? 'Player'}</Text>
        </View>

        {/* Background Colour */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>Background Colour</Text>
          <View style={styles.colorRow}>
            {BG_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setBgColor(c)}
                style={[styles.colorSwatch, { backgroundColor: c }, bgColor === c && styles.colorSwatchSelected]}
                activeOpacity={0.8}
              />
            ))}
          </View>
        </View>

        {/* Page 1 animals */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>Animal</Text>
          <View style={styles.grid}>
            {ANIMALS_1.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.animalTile, selected === emoji && styles.animalTileSelected]}
                onPress={() => setSelected(emoji)}
                activeOpacity={0.75}
              >
                <Text style={styles.tileEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* More animals arrow */}
        <TouchableOpacity style={styles.moreBtn} onPress={() => setMorePage(true)} activeOpacity={0.8}>
          <Text style={styles.moreBtnText}>More Animals</Text>
          <Text style={styles.moreArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.doneButton} onPress={handleDone} disabled={saving} activeOpacity={0.85}>
          <LinearGradient colors={[Colors.brand.primary, '#0096C7']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.doneText}>{saving ? 'Saving…' : fromProfile ? 'Save Changes' : "Let's Go →"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { padding: Spacing['2xl'], paddingTop: 60, paddingBottom: 60, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontSize: FontSize.base, color: Colors.brand.primary, fontWeight: FontWeight.semibold },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold, color: Colors.text.primary, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: FontSize.base, color: Colors.text.secondary, marginBottom: Spacing.xl, textAlign: 'center' },
  previewCard: {
    backgroundColor: Colors.bg.secondary, borderRadius: Radius.xl,
    paddingVertical: Spacing.xl, paddingHorizontal: Spacing['2xl'],
    alignItems: 'center', marginBottom: Spacing.xl,
    width: '100%', borderWidth: 1, borderColor: Colors.border.default,
  },
  miniPreview: {
    width: '100%', alignItems: 'center', paddingVertical: Spacing.base,
    marginBottom: Spacing.base, borderRadius: Radius.xl,
    borderWidth: 1, backgroundColor: Colors.bg.secondary,
  },
  animalCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.brand.primary },
  animalEmoji: { fontSize: 52 },
  previewName: { marginTop: 12, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text.primary },
  sectionBox: {
    width: '100%', backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.xl, padding: Spacing.base,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border.default, gap: 12,
  },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text.secondary },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchSelected: { borderColor: Colors.brand.primary, transform: [{ scale: 1.18 }] },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  animalTile: { width: 58, height: 58, borderRadius: Radius.lg, backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  animalTileSelected: { borderColor: Colors.brand.primary, backgroundColor: 'rgba(0,179,230,0.15)', transform: [{ scale: 1.1 }] },
  tileEmoji: { fontSize: 30 },
  moreBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.bg.secondary, borderRadius: Radius.xl,
    paddingVertical: 16, borderWidth: 1, borderColor: Colors.border.default, marginBottom: Spacing.base,
  },
  moreBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text.secondary },
  moreArrow: { fontSize: 20, color: Colors.brand.primary },
  doneButton: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.lg, width: '100%' },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  doneText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
});
