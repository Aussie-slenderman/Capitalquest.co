import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAppStore } from '../../src/store/useAppStore';
import { updateUser } from '../../src/services/auth';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import type { AvatarConfig } from '../../src/types';

const ANIMALS = [
  '🐶', '🐱', '🦁', '🐯', '🐻', '🐼',
  '🦊', '🐺', '🐨', '🦘', '🐸', '🐧',
  '🦅', '🦉', '🦄', '🐉', '🦈', '🐙',
  '🐘', '🦒', '🦓', '🦔', '🦦', '🦋',
];

export default function AvatarScreen() {
  const { user, setUser } = useAppStore();
  const [selected, setSelected] = useState<string>(ANIMALS[0]);
  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      const config: AvatarConfig = { animal: selected };
      if (user) {
        await updateUser(user.id, { avatarConfig: config });
        setUser({ ...user, avatarConfig: config });
      }
    } catch { /* non-critical */ }
    router.replace('/(auth)/setup');
  };

  return (
    <View style={[styles.container, Platform.OS === 'web' && { height: '100vh' as any }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Choose Your Animal</Text>
        <Text style={styles.subtitle}>Pick an animal to represent you to other players</Text>

        {/* Preview */}
        <View style={styles.previewCard}>
          <View style={styles.animalCircle}>
            <Text style={styles.animalEmoji}>{selected}</Text>
          </View>
          <Text style={styles.previewName}>{user?.username ?? 'Player'}</Text>
        </View>

        {/* Animal grid */}
        <View style={styles.grid}>
          {ANIMALS.map((emoji) => (
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

        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          disabled={saving}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.brand.primary, '#0096C7']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.doneText}>{saving ? 'Saving…' : "Let's Go →"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { padding: Spacing['2xl'], paddingTop: 60, paddingBottom: 60, alignItems: 'center' },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.extrabold, color: Colors.text.primary, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: FontSize.base, color: Colors.text.secondary, marginBottom: Spacing.xl, textAlign: 'center' },
  previewCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  animalCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.brand.primary,
  },
  animalEmoji: { fontSize: 52 },
  previewName: { marginTop: 12, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text.primary },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  animalTile: {
    width: 60, height: 60, borderRadius: Radius.lg,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  animalTileSelected: {
    borderColor: Colors.brand.primary,
    backgroundColor: 'rgba(0,179,230,0.15)',
    transform: [{ scale: 1.1 }],
  },
  tileEmoji: { fontSize: 32 },
  doneButton: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.xl, width: '100%' },
  gradient: { paddingVertical: 16, alignItems: 'center' },
  doneText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
});
