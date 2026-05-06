import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { auth, db } from '../../src/services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAppStore } from '../../src/store/useAppStore';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

// Same wardrobe vocabulary as Sidebar.tsx so the in-app wardrobe and the
// signup-flow picker stay in sync.
const WARDROBE_ANIMALS = [
  '🐶', '🐱', '🐻', '🐼', '🦊', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
  '🐔', '🐧', '🐦', '🦅', '🦉', '🐴', '🦄', '🐲', '🐙', '🦋', '🐢', '🐬',
  '🦈', '🐠', '🦜', '🦩', '🐺', '🦝', '🐹', '🐰',
];

const WARDROBE_COLORS = [
  '#FF6B6B', '#F59E0B', '#22C55E', '#00B3E6', '#7C3AED', '#EC4899',
  '#00D4AA', '#6366F1', '#F5C518', '#EF4444', '#06B6D4', '#1A2235',
];

export default function AvatarScreen() {
  const { user, setUser } = useAppStore();
  const [animal, setAnimal] = useState(user?.avatarConfig?.animal ?? '🐶');
  const [bgColor, setBgColor] = useState(user?.avatarConfig?.bgColor ?? Colors.brand.primary);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const u = auth.currentUser;
      if (u) {
        const config = { animal, bgColor };
        try {
          await updateDoc(doc(db, 'users', u.uid), { avatarConfig: config });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Could not save avatar:', e);
        }
        // Mirror to local store so the next screen (Terms) and beyond render
        // the chosen animal immediately, even before Firestore acknowledges.
        if (user) setUser({ ...user, avatarConfig: config });
      }
      router.replace('/(auth)/terms' as any);
    } catch (e: any) {
      setError(e?.message || 'Could not continue. Please try again.');
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pick your avatar</Text>
        <Text style={styles.headerSubtitle}>You can change this any time from the wardrobe.</Text>
      </View>

      {/* Live preview */}
      <View style={styles.previewWrap}>
        <View style={[styles.previewCircle, { backgroundColor: bgColor }]}>
          <Text style={styles.previewAnimal}>{animal}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>Choose your animal</Text>
        <View style={styles.grid}>
          {WARDROBE_ANIMALS.map((a) => (
            <TouchableOpacity
              key={a}
              style={[
                styles.animalCell,
                a === animal && { backgroundColor: bgColor + '33', borderColor: bgColor, borderWidth: 2 },
              ]}
              onPress={() => setAnimal(a)}
              activeOpacity={0.7}
            >
              <Text style={styles.animalEmoji}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Choose a background colour</Text>
        <View style={styles.grid}>
          {WARDROBE_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorCell,
                { backgroundColor: c },
                c === bgColor && styles.colorCellSelected,
              ]}
              onPress={() => setBgColor(c)}
              activeOpacity={0.7}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
        <TouchableOpacity
          style={[styles.continueBtn, saving && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.continueBtnText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    ...(Platform.OS === 'web' ? { height: '100vh' as any } : {}),
  },
  header: {
    paddingTop: Platform.OS === 'web' ? Spacing.lg : Spacing.xl + Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
  },
  headerSubtitle: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 4,
  },

  previewWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  previewCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  previewAnimal: { fontSize: 64 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sectionLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  animalCell: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animalEmoji: { fontSize: 28 },
  colorCell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCellSelected: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },

  footer: {
    backgroundColor: Colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  errorText: {
    color: Colors.market.loss,
    fontSize: FontSize.sm,
  },
  continueBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
  },
});
