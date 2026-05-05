import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Colors, LightColors, Spacing, FontSize, FontWeight, Radius } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

export interface ModerationWarning {
  category: string;
  categoryLabel?: string;
  matched: string;
  messageExcerpt?: string;
  offenseNumber?: number;
  detectedAt?: number;
  banned?: boolean;
}

interface Props {
  visible: boolean;
  warning: ModerationWarning | null;
  /** Called after the user acknowledges and the warning has been cleared. */
  onAcknowledged: () => void;
}

export const ModerationWarningModal: React.FC<Props> = ({ visible, warning, onAcknowledged }) => {
  const { user, appColorMode } = useAppStore();
  const C = appColorMode === 'light' ? LightColors : Colors;
  const styles = useMemo(() => makeStyles(C), [C]);
  const [clearing, setClearing] = useState(false);

  if (!warning) return null;

  const isFinalWarning = (warning.offenseNumber || 1) === 1;
  const label = warning.categoryLabel || warning.category;

  async function handleAcknowledge() {
    if (clearing) return;
    setClearing(true);
    try {
      // Clear pendingModerationWarning so we don't show this again next
      // login. The accountBanned flag is *not* cleared here — that's a
      // permanent state until an admin reverses it.
      if (user?.id) {
        try {
          await updateDoc(doc(db, 'users', user.id), {
            pendingModerationWarning: deleteField(),
          });
        } catch (e) {
          console.warn('Could not clear pendingModerationWarning:', e);
        }
      }
    } finally {
      setClearing(false);
      onAcknowledged();
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => { /* not dismissable by tap-out */ }}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>
            {isFinalWarning ? 'Warning from moderators' : 'Final warning'}
          </Text>

          <Text style={styles.lead}>
            One of your recent chat messages broke our community guidelines. This is{' '}
            {isFinalWarning ? (
              <Text style={styles.leadEmphasis}>your only warning.</Text>
            ) : (
              <Text style={styles.leadEmphasis}>your second strike.</Text>
            )}
          </Text>

          <View style={styles.detailBox}>
            <DetailRow C={C} k="Category" v={label} />
            <DetailRow C={C} k="Flagged term" v={warning.matched} />
            {warning.messageExcerpt ? (
              <View style={{ marginTop: Spacing.sm }}>
                <Text style={styles.excerptLabel}>Your message</Text>
                <Text style={styles.excerptText} numberOfLines={6}>
                  {warning.messageExcerpt}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.consequence}>
            {isFinalWarning
              ? 'If we detect another violation, your account will be permanently banned and you will not be able to sign back in.'
              : 'Because this is your second violation, your account is now banned. After acknowledging this message you will be signed out.'}
          </Text>

          <TouchableOpacity
            style={[styles.btn, clearing && { opacity: 0.5 }]}
            disabled={clearing}
            onPress={handleAcknowledge}
            activeOpacity={0.85}
          >
            {clearing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{isFinalWarning ? 'I understand' : 'Acknowledge'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const DetailRow: React.FC<{ C: typeof Colors; k: string; v: string }> = ({ C, k, v }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
    <Text style={{ color: C.text.secondary, fontSize: FontSize.sm }}>{k}</Text>
    <Text style={{ color: C.text.primary, fontSize: FontSize.sm, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: Spacing.md }} numberOfLines={2}>
      {v}
    </Text>
  </View>
);

const makeStyles = (C: typeof Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: C.bg.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: C.bg.secondary,
      borderRadius: Radius.lg,
      borderWidth: 2,
      borderColor: C.market.loss,
      padding: Spacing.lg,
    },
    icon: { fontSize: 44, textAlign: 'center', marginBottom: Spacing.sm },
    title: {
      color: C.text.primary,
      fontSize: FontSize.lg,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    lead: {
      color: C.text.primary,
      fontSize: FontSize.sm,
      lineHeight: 22,
      marginBottom: Spacing.md,
    },
    leadEmphasis: {
      color: C.market.loss,
      fontWeight: '800',
    },
    detailBox: {
      backgroundColor: C.bg.tertiary,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border.default,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    excerptLabel: {
      color: C.text.tertiary,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '700',
      marginBottom: 4,
    },
    excerptText: {
      color: C.text.primary,
      fontSize: FontSize.sm,
      lineHeight: 20,
    },
    consequence: {
      color: C.text.secondary,
      fontSize: FontSize.sm,
      lineHeight: 22,
      marginBottom: Spacing.md,
    },
    btn: {
      backgroundColor: C.market.loss,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '800' as any },
  });

export default ModerationWarningModal;
