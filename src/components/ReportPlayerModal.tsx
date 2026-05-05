import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Colors, LightColors, Spacing, FontSize, Radius } from '../constants/theme';
import { useAppStore } from '../store/useAppStore';

export type ReportReason =
  | 'sexual_hateful'
  | 'scamming'
  | 'harassment'
  | 'spam'
  | 'other';

export type ReportContext = 'friend' | 'club' | 'chat' | 'unknown';

const REASONS: { id: ReportReason; label: string; icon: string; blurb: string }[] = [
  { id: 'sexual_hateful', label: 'Sexual or hateful comment', icon: '🚫', blurb: 'Slurs, threats, sexual content, or hateful language.' },
  { id: 'scamming',       label: 'Scamming',                  icon: '💰', blurb: 'Trying to trick you out of money, items, or your account.' },
  { id: 'harassment',     label: 'Harassment / bullying',     icon: '😡', blurb: 'Repeated targeting, insults, or threats.' },
  { id: 'spam',           label: 'Spam / unwanted messages',  icon: '📨', blurb: 'Repeated unsolicited or off-topic messages.' },
  { id: 'other',          label: 'Other',                     icon: '⚠️', blurb: 'Something else that breaks community guidelines.' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  reportedUid: string;
  reportedUsername: string;
  context: ReportContext;
  /** Pass when context === 'club' */
  clubName?: string;
  /** Pass when context === 'chat' — the specific message text being reported */
  chatMessage?: string;
  /** Pass when context === 'chat' — the chatRoom doc id */
  chatRoomId?: string;
}

export const ReportPlayerModal: React.FC<Props> = ({
  visible,
  onClose,
  reportedUid,
  reportedUsername,
  context,
  clubName,
  chatMessage,
  chatRoomId,
}) => {
  const { appColorMode } = useAppStore();
  const C = appColorMode === 'light' ? LightColors : Colors;
  const styles = useMemo(() => makeStyles(C), [C]);

  const [step, setStep] = useState<'reason' | 'details' | 'confirm'>('reason');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep('reason');
    setReason(null);
    setDetails('');
    setSubmitting(false);
    setDone(false);
    setError(null);
  }

  function handleClose() {
    if (submitting) return;
    onClose();
    // Reset after the modal closes
    setTimeout(reset, 300);
  }

  function pickReason(r: ReportReason) {
    setReason(r);
    setStep('details');
  }

  function detailsPlaceholder(): string {
    switch (reason) {
      case 'sexual_hateful': return 'What did they say? Where did you see it?';
      case 'scamming':       return 'What did they ask for? Did you lose anything?';
      case 'harassment':     return 'How long has this been happening? What have they said or done?';
      case 'spam':           return 'How often, and where (chat / DMs / club)?';
      case 'other':          return 'Tell us what happened…';
      default:               return 'Add any details that help moderators…';
    }
  }

  async function submit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Lazy-import Firebase to avoid loading it for users who never report
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fns = getFunctions();
      const fn = httpsCallable(fns, 'reportPlayer');
      await fn({
        reportedUid,
        reportedUsername,
        reason,
        details,
        context,
        clubName: clubName || '',
        chatMessage: chatMessage || '',
        chatRoomId: chatRoomId || '',
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Could not submit your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────── Render ───────────────────────────
  const selectedReason = reason ? REASONS.find((r) => r.id === reason) : null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>🚩</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Report @{reportedUsername}</Text>
              <Text style={styles.subtitle}>
                {context === 'friend' && 'From your friends list'}
                {context === 'club' && (clubName ? `From the “${clubName}” club` : 'From a club')}
                {context === 'chat' && 'From a chat message'}
                {context === 'unknown' && 'Submit a moderation report'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} disabled={submitting} style={styles.closeBtn}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Done state */}
          {done ? (
            <View style={styles.doneBlock}>
              <Text style={styles.doneIcon}>✅</Text>
              <Text style={styles.doneTitle}>Report submitted</Text>
              <Text style={styles.doneBlurb}>
                Thanks — our moderators have been notified and will review your report.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: Spacing.md }}>
              {/* Step 1 — pick reason */}
              {step === 'reason' && (
                <>
                  <Text style={styles.sectionLabel}>Why are you reporting this player?</Text>
                  {REASONS.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.reasonRow}
                      activeOpacity={0.7}
                      onPress={() => pickReason(r.id)}
                    >
                      <Text style={styles.reasonIcon}>{r.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reasonLabel}>{r.label}</Text>
                        <Text style={styles.reasonBlurb}>{r.blurb}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Step 2 — context details */}
              {step === 'details' && selectedReason && (
                <>
                  <View style={styles.selectedReasonPill}>
                    <Text style={styles.reasonIcon}>{selectedReason.icon}</Text>
                    <Text style={styles.selectedReasonText}>{selectedReason.label}</Text>
                    <TouchableOpacity onPress={() => setStep('reason')}>
                      <Text style={styles.changeLink}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  {context === 'chat' && chatMessage ? (
                    <View style={styles.chatQuote}>
                      <Text style={styles.chatQuoteLabel}>Reported message</Text>
                      <Text style={styles.chatQuoteText}>{chatMessage}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.sectionLabel}>Add details (optional but helps)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={detailsPlaceholder()}
                    placeholderTextColor={C.text.tertiary}
                    multiline
                    numberOfLines={5}
                    maxLength={2000}
                    value={details}
                    onChangeText={setDetails}
                  />

                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('reason')}>
                      <Text style={styles.secondaryBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('confirm')}>
                      <Text style={styles.primaryBtnText}>Review →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Step 3 — confirm */}
              {step === 'confirm' && selectedReason && (
                <>
                  <Text style={styles.sectionLabel}>Confirm and submit</Text>
                  <View style={styles.summaryBox}>
                    <SummaryRow C={C} k="Player"  v={`@${reportedUsername}`} />
                    <SummaryRow C={C} k="Reason"  v={selectedReason.label} />
                    <SummaryRow
                      C={C}
                      k="Where"
                      v={
                        context === 'friend' ? 'Friends list' :
                        context === 'club'   ? (clubName ? `Club — ${clubName}` : 'Club roster') :
                        context === 'chat'   ? 'Chat message' : 'Unknown'
                      }
                    />
                    {context === 'chat' && chatMessage ? (
                      <View style={{ marginTop: Spacing.sm }}>
                        <Text style={[styles.chatQuoteLabel, { marginBottom: 4 }]}>Reported message</Text>
                        <Text style={[styles.chatQuoteText, { fontSize: FontSize.sm }]}>{chatMessage}</Text>
                      </View>
                    ) : null}
                    {details ? (
                      <View style={{ marginTop: Spacing.sm }}>
                        <Text style={[styles.chatQuoteLabel, { marginBottom: 4 }]}>Your details</Text>
                        <Text style={[styles.chatQuoteText, { fontSize: FontSize.sm }]}>{details}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.disclaimer}>
                    Submitting will email this report to our moderation team. Misuse of this feature
                    (false reports) may result in action against your own account.
                  </Text>

                  {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => setStep('details')}
                      disabled={submitting}
                    >
                      <Text style={styles.secondaryBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, styles.confirmBtn, submitting && { opacity: 0.6 }]}
                      onPress={submit}
                      disabled={submitting}
                    >
                      {submitting
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.primaryBtnText}>Confirm & Send</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const SummaryRow: React.FC<{ C: typeof Colors; k: string; v: string }> = ({ C, k, v }) => (
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
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: C.border.default,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm as any,
      marginBottom: Spacing.md,
    },
    headerIcon: { fontSize: 22 },
    title: {
      color: C.text.primary,
      fontSize: FontSize.lg,
      fontWeight: '800',
    },
    subtitle: {
      color: C.text.secondary,
      fontSize: FontSize.xs,
      marginTop: 2,
    },
    closeBtn: { padding: 6 },
    closeIcon: { color: C.text.secondary, fontSize: 18, fontWeight: '700' },

    sectionLabel: {
      color: C.text.secondary,
      fontSize: FontSize.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
    },

    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm as any,
      backgroundColor: C.bg.tertiary,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border.default,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    reasonIcon: { fontSize: 22, width: 28, textAlign: 'center' },
    reasonLabel: {
      color: C.text.primary,
      fontSize: FontSize.md,
      fontWeight: '700',
    },
    reasonBlurb: {
      color: C.text.tertiary,
      fontSize: FontSize.xs,
      marginTop: 2,
    },
    chevron: { color: C.text.tertiary, fontSize: 22, fontWeight: '700', marginLeft: 4 },

    selectedReasonPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm as any,
      backgroundColor: C.bg.tertiary,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.brand.primary,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    selectedReasonText: {
      flex: 1,
      color: C.text.primary,
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
    changeLink: {
      color: C.brand.primary,
      fontSize: FontSize.xs,
      fontWeight: '700',
    },

    chatQuote: {
      backgroundColor: C.bg.tertiary,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: C.market.loss,
      marginBottom: Spacing.sm,
    },
    chatQuoteLabel: {
      color: C.text.tertiary,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '700',
      marginBottom: 4,
    },
    chatQuoteText: {
      color: C.text.primary,
      fontSize: FontSize.md,
      lineHeight: 20,
    },

    input: {
      backgroundColor: C.bg.input,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border.default,
      color: C.text.primary,
      fontSize: FontSize.md,
      padding: Spacing.md,
      minHeight: 100,
      textAlignVertical: 'top',
    },

    summaryBox: {
      backgroundColor: C.bg.tertiary,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: C.border.default,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },

    disclaimer: {
      color: C.text.tertiary,
      fontSize: FontSize.xs,
      lineHeight: 16,
      marginVertical: Spacing.sm,
    },

    errorText: {
      color: C.market.loss,
      fontSize: FontSize.sm,
      marginVertical: Spacing.xs,
    },

    btnRow: {
      flexDirection: 'row',
      gap: Spacing.sm as any,
      marginTop: Spacing.md,
    },

    primaryBtn: {
      flex: 1,
      backgroundColor: C.brand.primary,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: FontSize.md,
      fontWeight: '800',
    },
    confirmBtn: { backgroundColor: C.market.loss },

    secondaryBtn: {
      flex: 1,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border.default,
      backgroundColor: C.bg.tertiary,
    },
    secondaryBtnText: {
      color: C.text.secondary,
      fontSize: FontSize.md,
      fontWeight: '700',
    },

    doneBlock: { alignItems: 'center', paddingVertical: Spacing.lg },
    doneIcon: { fontSize: 44, marginBottom: Spacing.sm },
    doneTitle: {
      color: C.text.primary,
      fontSize: FontSize.lg,
      fontWeight: '800',
      marginBottom: Spacing.xs,
    },
    doneBlurb: {
      color: C.text.secondary,
      fontSize: FontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.sm,
    },
  });

export default ReportPlayerModal;
