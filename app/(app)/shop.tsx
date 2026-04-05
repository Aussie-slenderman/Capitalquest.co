/**
 * Shop Screen
 *
 * Buy avatar and pet cosmetics using Bling (in-game currency).
 * Bling is earned at every 5% trophy-road milestone.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AppHeader from '../../src/components/AppHeader';
import Sidebar from '../../src/components/Sidebar';
import { useAppStore } from '../../src/store/useAppStore';
import {
  SHOP_ITEMS,
  TIER_COLORS,
  TIER_LABELS,
  TIER_PRICES,
  type ShopItem,
  type ShopTier,
  type ShopItemType,
} from '../../src/constants/shopItems';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_W = (SCREEN_W - Spacing.base * 2 - CARD_GAP) / 2;

const TYPE_FILTERS: { key: ShopItemType | 'all'; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'avatar', label: '🎨 Avatars' },
  { key: 'pet',    label: '🐾 Pets' },
];

const TIER_ORDER: ShopTier[] = [
  'rare', 'super_rare', 'epic', 'mythic', 'legendary', 'ultra_legendary',
];

// ─── Bling coin component ─────────────────────────────────────────────────────

function BlingCoin({ size = 14 }: { size?: number }) {
  return <Text style={{ fontSize: size }}>💎</Text>;
}

// ─── Shop item card ───────────────────────────────────────────────────────────

interface ItemCardProps {
  item: ShopItem;
  owned: boolean;
  canAfford: boolean;
  onBuy: () => void;
  equipped: boolean;
  onEquip: () => void;
}

function ItemCard({ item, owned, canAfford, onBuy, equipped, onEquip }: ItemCardProps) {
  const tierColor = TIER_COLORS[item.tier];
  const borderColor = owned ? tierColor : `${tierColor}55`;

  return (
    <View style={[styles.card, { borderColor }]}>
      {/* Tier ribbon */}
      <View style={[styles.tierRibbon, { backgroundColor: tierColor }]}>
        <Text style={styles.tierRibbonText}>{TIER_LABELS[item.tier].toUpperCase()}</Text>
      </View>

      {/* Glow background for owned */}
      {owned && (
        <LinearGradient
          colors={[`${tierColor}18`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      )}

      {/* Emoji */}
      <Text style={styles.cardEmoji}>{item.emoji}</Text>

      {/* Ultra Legendary ability badge under emoji */}
      {item.ability && item.tier === 'ultra_legendary' && (
        <View style={styles.abilityBadge}>
          <Text style={styles.abilityBadgeIcon}>{item.ability.icon}</Text>
          <Text style={styles.abilityBadgeName}>{item.ability.name}</Text>
        </View>
      )}

      {/* Name + description */}
      <Text style={styles.cardName}>{item.name}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

      {/* Type badge */}
      <View style={[
        styles.typeBadge,
        { backgroundColor: item.type === 'avatar' ? `${Colors.brand.primary}22` : `${Colors.brand.accent}22` },
      ]}>
        <Text style={[styles.typeBadgeText, { color: item.type === 'avatar' ? Colors.brand.primary : Colors.brand.accent }]}>
          {item.type === 'avatar' ? 'AVATAR' : 'PET'}
        </Text>
      </View>

      {/* Price / Buy / Equip */}
      {owned ? (
        <TouchableOpacity
          style={[styles.equipBtn, equipped && { backgroundColor: tierColor }]}
          onPress={onEquip}
        >
          <Text style={[styles.equipBtnText, equipped && { color: '#fff' }]}>
            {equipped ? '✓ Equipped' : 'Equip'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
          onPress={onBuy}
        >
          <BlingCoin size={12} />
          <Text style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDisabled]}>
            {item.price.toLocaleString()}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

// ─── Mystery Box Card ─────────────────────────────────────────────────────────

interface MysteryBoxCardProps {
  tier: ShopTier;
  price: number;
  canAfford: boolean;
  ownedCount: number;
  totalCount: number;
  onPress: () => void;
}

function MysteryBoxCard({ tier, price, canAfford, ownedCount, totalCount, onPress }: MysteryBoxCardProps) {
  const color = TIER_COLORS[tier];
  const allOwned = ownedCount >= totalCount;
  return (
    <TouchableOpacity
      style={[styles.mysteryBox, { borderColor: `${color}66` }, !canAfford && !allOwned && styles.mysteryBoxDisabled]}
      onPress={onPress}
      disabled={allOwned}
    >
      <LinearGradient
        colors={[`${color}33`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <Text style={styles.mysteryBoxEmoji}>🎁</Text>
      <Text style={[styles.mysteryBoxTier, { color }]}>{TIER_LABELS[tier]}</Text>
      {allOwned ? (
        <Text style={[styles.mysteryBoxComplete, { color }]}>✓ Complete</Text>
      ) : (
        <View style={styles.mysteryBoxPriceRow}>
          <Text style={styles.mysteryBoxCoin}>💎</Text>
          <Text style={[styles.mysteryBoxPrice, !canAfford && styles.mysteryBoxPriceDim]}>
            {price.toLocaleString()}
          </Text>
        </View>
      )}
      {!allOwned && (
        <Text style={[styles.mysteryBoxSale, { color }]}>5% OFF</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ShopScreen() {
  const {
    bling, setBling, shopPurchases, addShopPurchase,
    equippedAvatarId, setEquippedAvatarId,
    equippedPetId,   setEquippedPetId,
    appColorMode, appTabColors,
    isSidebarOpen, setSidebarOpen,
  } = useAppStore();
  const tabColor = appTabColors['shop'] ?? '#F59E0B';
  const isLight = appColorMode === 'light';
  const screenBg = isLight ? '#FFF8EC' : '#0A6A7C';

  const [typeFilter, setTypeFilter] = useState<ShopItemType | 'all'>('all');

  // ── Modal state ─────────────────────────────────────────────────────────────
  type BuyModal    = { kind: 'buy'; item: ShopItem };
  type MysteryModal = { kind: 'mystery'; tier: ShopTier; won: ShopItem; price: number };
  type InfoModal   = { kind: 'info'; title: string; body: string };
  type ModalState  = BuyModal | MysteryModal | InfoModal | null;
  const [modal, setModal] = useState<ModalState>(null);

  const filteredItems = useMemo(() => {
    const items = typeFilter === 'all'
      ? SHOP_ITEMS
      : SHOP_ITEMS.filter(i => i.type === typeFilter);
    // Group by tier in display order
    return TIER_ORDER.flatMap(tier => items.filter(i => i.tier === tier));
  }, [typeFilter]);

  // Group displayed items by tier for section headers
  const sections = useMemo(() => {
    const result: { tier: ShopTier; items: ShopItem[] }[] = [];
    for (const tier of TIER_ORDER) {
      const items = filteredItems.filter(i => i.tier === tier);
      if (items.length > 0) result.push({ tier, items });
    }
    return result;
  }, [filteredItems]);

  function handleBuy(item: ShopItem) {
    if (bling < item.price) {
      setModal({ kind: 'info', title: 'Not Enough Bling', body: `You need ${(item.price - bling).toLocaleString()} more 💎 to buy ${item.name}.` });
      return;
    }
    setModal({ kind: 'buy', item });
  }

  function confirmBuy(item: ShopItem) {
    setBling(bling - item.price);
    addShopPurchase(item.id);
    if (item.type === 'avatar') setEquippedAvatarId(item.id);
    else setEquippedPetId(item.id);
    setModal(null);
  }

  function handleEquip(item: ShopItem) {
    if (item.type === 'avatar') {
      setEquippedAvatarId(equippedAvatarId === item.id ? null : item.id);
    } else {
      setEquippedPetId(equippedPetId === item.id ? null : item.id);
    }
  }

  function handleMysteryBox(tier: ShopTier) {
    const price = Math.floor(TIER_PRICES[tier] * 0.95);
    if (bling < price) {
      setModal({ kind: 'info', title: 'Not Enough Bling', body: `You need ${(price - bling).toLocaleString()} more 💎 for a ${TIER_LABELS[tier]} Mystery Box.` });
      return;
    }
    const tierItems = SHOP_ITEMS.filter(i => i.tier === tier);
    const unowned = tierItems.filter(i => !shopPurchases.includes(i.id));
    if (unowned.length === 0) {
      setModal({ kind: 'info', title: '🎁 Collection Complete!', body: `You already own every ${TIER_LABELS[tier]} item!` });
      return;
    }
    const won = unowned[Math.floor(Math.random() * unowned.length)];
    setModal({ kind: 'mystery', tier, won, price });
  }

  function confirmMystery(tier: ShopTier, won: ShopItem, price: number) {
    setBling(bling - price);
    addShopPurchase(won.id);
    if (won.type === 'avatar') setEquippedAvatarId(won.id);
    else setEquippedPetId(won.id);
    setModal(null);
  }

  return (
    <View style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top']}>
      <AppHeader title="Shop" />
      {/* Full-screen colour wash */}
      <LinearGradient
        colors={[`${tabColor}80`, `${tabColor}50`, `${tabColor}30`, screenBg] as any}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', `${tabColor}30`, `${tabColor}40`] as any}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`${tabColor}28`, 'transparent', `${tabColor}28`] as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        pointerEvents="none"
      />

      {/* ── Mystery boxes row (top) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.mysteryScroll}
        style={styles.mysteryScrollBar}
      >
        {TIER_ORDER.map(tier => {
          const tierItems = SHOP_ITEMS.filter(i => i.tier === tier);
          const ownedCount = tierItems.filter(i => shopPurchases.includes(i.id)).length;
          const price = Math.floor(TIER_PRICES[tier] * 0.95);
          return (
            <MysteryBoxCard
              key={tier}
              tier={tier}
              price={price}
              canAfford={bling >= price}
              ownedCount={ownedCount}
              totalCount={tierItems.length}
              onPress={() => handleMysteryBox(tier)}
            />
          );
        })}
      </ScrollView>

      {/* ── Combined filter + bling row ── */}
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>🛒</Text>
        {TYPE_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, typeFilter === f.key && styles.filterTabActive]}
            onPress={() => setTypeFilter(f.key)}
          >
            <Text style={[styles.filterTabText, typeFilter === f.key && styles.filterTabTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.blingBadge} onPress={() => router.push('/(app)/buy-bling')}>
          <BlingCoin size={13} />
          <Text style={styles.blingAmount}>{bling.toLocaleString()}</Text>
          <Text style={styles.blingPlus}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Items grid ── */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {sections.map(({ tier, items }) => (
          <View key={tier} style={styles.section}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: TIER_COLORS[tier] }]} />
              <Text style={[styles.sectionTitle, { color: TIER_COLORS[tier] }]}>
                {TIER_LABELS[tier]}
              </Text>
              <Text style={styles.sectionPrice}>
                {TIER_PRICES[tier].toLocaleString()} 💎 each
              </Text>
            </View>

            {/* 2-column grid */}
            <View style={styles.grid}>
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  owned={shopPurchases.includes(item.id)}
                  canAfford={bling >= item.price}
                  onBuy={() => handleBuy(item)}
                  equipped={
                    item.type === 'avatar'
                      ? equippedAvatarId === item.id
                      : equippedPetId === item.id
                  }
                  onEquip={() => handleEquip(item)}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Modal ── */}
      <Modal
        visible={modal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            {modal?.kind === 'buy' && (
              <>
                <Text style={styles.modalEmoji}>{modal.item.emoji}</Text>
                <Text style={styles.modalTitle}>Confirm Purchase</Text>
                <Text style={styles.modalBody}>
                  Buy{' '}
                  <Text style={[styles.modalHighlight, { color: TIER_COLORS[modal.item.tier] }]}>
                    {modal.item.name}
                  </Text>
                  {' '}for{' '}
                  <Text style={styles.modalHighlight}>
                    {modal.item.price.toLocaleString()} 💎
                  </Text>
                  ?
                </Text>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: TIER_COLORS[modal.item.tier] }]}
                  onPress={() => confirmBuy(modal.item)}
                >
                  <Text style={styles.modalConfirmText}>Buy — {modal.item.price.toLocaleString()} 💎</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModal(null)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {modal?.kind === 'mystery' && (
              <>
                <Text style={styles.modalEmoji}>🎁</Text>
                <Text style={styles.modalTitle}>You Won!</Text>
                <Text style={[styles.modalWonEmoji]}>{modal.won.emoji}</Text>
                <Text style={[styles.modalHighlight, { color: TIER_COLORS[modal.won.tier] }]}>
                  {modal.won.name}
                </Text>
                <Text style={styles.modalBody}>{modal.won.description}</Text>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: TIER_COLORS[modal.won.tier] }]}
                  onPress={() => confirmMystery(modal.tier, modal.won, modal.price)}
                >
                  <Text style={styles.modalConfirmText}>Claim — {modal.price.toLocaleString()} 💎</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModal(null)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {modal?.kind === 'info' && (
              <>
                <Text style={styles.modalEmoji}>💎</Text>
                <Text style={styles.modalTitle}>{modal.title}</Text>
                <Text style={styles.modalBody}>{modal.body}</Text>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: Colors.brand.primary }]}
                  onPress={() => setModal(null)}
                >
                  <Text style={styles.modalConfirmText}>OK</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </Modal>

    </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A3848' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#3D2A0044',
    backgroundColor: '#2A1800',
  },
  headerTitle: {
    fontSize: 18,
    marginRight: 2,
  },
  blingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.brand.gold}22`,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${Colors.brand.gold}55`,
    gap: 3,
    marginLeft: 'auto' as any,
  },
  blingAmount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
    color: Colors.brand.gold,
  },
  blingPlus: {
    fontSize: 12,
    fontWeight: FontWeight.extrabold,
    color: Colors.brand.gold,
    marginLeft: -1,
  },

  filterTab: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  filterTabActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  filterTabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.text.secondary,
  },
  filterTabTextActive: { color: '#fff', fontWeight: FontWeight.bold },

  mysteryScrollBar: {
    height: 66,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    flexShrink: 0,
  },
  mysteryScroll: {
    paddingHorizontal: Spacing.base,
    gap: 8,
    alignItems: 'center',
  },
  mysteryBox: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 5,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    minWidth: 72,
  },
  mysteryBoxDisabled: { opacity: 0.5 },
  mysteryBoxEmoji: { fontSize: 22 },
  mysteryBoxTier: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.3,
  },
  mysteryBoxPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  mysteryBoxCoin: { fontSize: 10 },
  mysteryBoxPrice: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.brand.gold,
  },
  mysteryBoxPriceDim: { color: Colors.text.tertiary },
  mysteryBoxSale: {
    fontSize: 8,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.3,
    opacity: 0.7,
  },
  mysteryBoxComplete: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
  },

  scroll: { flex: 1 },

  section: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.base },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
    flex: 1,
  },
  sectionPrice: { fontSize: FontSize.xs, color: Colors.text.tertiary },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },

  card: {
    width: CARD_W,
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.xl,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
    gap: 4,
    position: 'relative',
  },

  tierRibbon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    alignItems: 'center',
  },
  tierRibbonText: {
    fontSize: 8,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    letterSpacing: 0.8,
  },

  cardEmoji: { fontSize: 44, marginTop: 18 },
  abilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${Colors.brand.accent}22`,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${Colors.brand.accent}55`,
    marginTop: 2,
  },
  abilityBadgeIcon: { fontSize: 10 },
  abilityBadgeName: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    color: Colors.brand.accent,
    letterSpacing: 0.3,
  },
  cardName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 10,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 14,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginTop: 2,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.extrabold,
    letterSpacing: 0.5,
  },

  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    marginTop: 4,
  },
  buyBtnDisabled: {
    backgroundColor: Colors.bg.tertiary,
  },
  buyBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  buyBtnTextDisabled: { color: Colors.text.tertiary },

  equipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 4,
  },
  equipBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 6,
  },
  modalEmoji: { fontSize: 48, marginBottom: 4 },
  modalWonEmoji: { fontSize: 56 },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text.primary,
  },
  modalBody: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalHighlight: {
    fontWeight: FontWeight.extrabold,
    color: Colors.text.primary,
  },
  modalConfirmBtn: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  modalConfirmText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
  },
  modalCancelBtn: {
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  modalCancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text.secondary,
  },
});
