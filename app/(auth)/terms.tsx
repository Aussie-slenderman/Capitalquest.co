import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/constants/theme';
import { auth } from '../../src/services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/services/firebase';

const EFFECTIVE_DATE = 'May 4, 2026';
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '0. Operator',
    body: [
      'Rookie Markets is operated by [Your Full Legal Name or Company Name] ("Operator"). References to "we," "our," or "us" refer to the Operator.',
    ],
  },
  {
    title: '1. Nature of the Service',
    body: [
      'Rookie Markets is a simulation-based stock investment platform intended for educational and entertainment purposes only. The App allows users to interact with simulated market environments and manage virtual portfolios. The App does not provide real trading functionality and does not connect to any brokerage or financial institution.',
    ],
  },
  {
    title: '2. No Real Money or Financial Value',
    body: [
      'The App does not involve real money. All currency, balances, assets, and transactions are entirely virtual. In-game currency has no monetary value and cannot be exchanged, redeemed, or transferred for real-world currency, goods, or services.',
    ],
  },
  {
    title: '3. Educational & No Financial Advice Disclaimer',
    body: [
      'All content provided in the App is for informational and entertainment purposes only. No licensed financial advisors, certified professionals, or academic experts were consulted in creating the educational content. The App does not provide financial, investment, legal, or tax advice, and nothing in the App constitutes a recommendation to buy, sell, or hold any security. You agree that you will not rely on the App for real-world financial decisions and that you are solely responsible for any financial decisions you make outside the App.',
    ],
  },
  {
    title: '4. User Eligibility & Children\u2019s Privacy (COPPA)',
    body: [
      'The App is intended for a general audience. If you are under 13 years of age, you must have permission from a parent or legal guardian to use the App. We do not knowingly collect personal information from children under 13 without verifiable parental consent. If we become aware that such data has been collected without proper consent, we will delete it promptly. Parents or guardians may contact us to request deletion of a child\u2019s data.',
    ],
  },
  {
    title: '5. Accounts & User Responsibilities',
    body: [
      'If the App requires account creation, you agree to provide accurate and complete information, maintain the security of your account, and accept responsibility for all activity under your account. You agree not to use offensive, abusive, or inappropriate usernames, impersonate others, or attempt unauthorized access to systems or data. We reserve the right to suspend or terminate accounts that violate these Terms.',
    ],
  },
  {
    title: '6. Acceptable Use',
    body: [
      'You agree not to reverse engineer, hack, exploit, or interfere with the App, use the App for unlawful or harmful activities, or disrupt the experience of other users. Violations may result in account termination and possible legal action.',
    ],
  },
  {
    title: '7. Intellectual Property',
    body: [
      'All content within the App, including but not limited to text, graphics, logos, software, and design, is owned by or licensed to Rookie Markets and is protected by applicable intellectual property laws. You may not copy, reproduce, distribute, or modify any part of the App without written permission.',
    ],
  },
  {
    title: '8. Third-Party Services',
    body: [
      'The App may include third-party services such as analytics or advertisements. We are not responsible for the content, policies, or practices of third-party providers.',
    ],
  },
  {
    title: '9. Privacy',
    body: [
      'Your use of the App is also governed by our Privacy Policy. By using the App, you consent to the data practices described in that policy.',
    ],
  },
  {
    title: '10. Disclaimer of Warranties',
    body: [
      'The App is provided on an "as is" and "as available" basis. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including the accuracy or reliability of simulated data, fitness for a particular purpose, and non-infringement. We do not guarantee that the App will be uninterrupted, error-free, or secure.',
    ],
  },
  {
    title: '11. Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages, and we are not responsible for losses resulting from reliance on App content. Your use of the App is at your own risk.',
    ],
  },
  {
    title: '12. Indemnification',
    body: [
      'You agree to indemnify and hold harmless Rookie Markets and its Operator from any claims, damages, or expenses arising from your use of the App or your violation of these Terms.',
    ],
  },
  {
    title: '13. Modifications to the App',
    body: [
      'We reserve the right to modify, suspend, or discontinue the App at any time and to add or remove features without notice.',
    ],
  },
  {
    title: '14. Changes to These Terms',
    body: [
      'We may update these Terms from time to time. Continued use of the App after changes means you accept the updated Terms.',
    ],
  },
  {
    title: '15. Termination',
    body: [
      'We may suspend or terminate your access to the App at our discretion, including for violations of these Terms.',
    ],
  },
  {
    title: '16. Governing Law',
    body: [
      'These Terms shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflict of law principles.',
    ],
  },
  {
    title: '17. Dispute Resolution & Arbitration',
    body: [
      'Any dispute arising out of or relating to these Terms or the App shall be resolved through binding arbitration in the State of New York, rather than in court, except that you may bring claims in small claims court if eligible. You agree to waive any right to a jury trial and any right to participate in a class action lawsuit or class-wide arbitration.',
    ],
  },
  {
    title: '18. Apple App Store Compliance',
    body: [
      'If you downloaded the App from Apple\u2019s App Store, Apple Inc. is not responsible for the App or its content, has no obligation to provide maintenance or support services, and may refund the purchase price if applicable. Apple is a third-party beneficiary of these Terms and may enforce them against you.',
    ],
  },
  {
    title: '19. Contact Us',
    body: [
      'If you have any questions or concerns regarding these Terms, please contact us at rookiemarkets@gmail.com.',
    ],
  },
];

export default function TermsScreen() {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!accepted || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const u = auth.currentUser;
      if (u) {
        // Persist acceptance — used for audit + future TOS-version bumps.
        try {
          await updateDoc(doc(db, 'users', u.uid), {
            acceptedTermsAt: serverTimestamp(),
            acceptedTermsVersion: EFFECTIVE_DATE,
          });
        } catch (e) {
          // Non-fatal — proceed to setup even if the write fails. We do
          // not want a transient Firestore error to block the user mid-
          // signup; the box is already legally checked client-side.
          // eslint-disable-next-line no-console
          console.warn('Could not record TOS acceptance:', e);
        }
      }
      router.replace('/(auth)/setup');
    } catch (e: any) {
      setError(e?.message || 'Could not continue. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <Text style={styles.headerSubtitle}>Effective Date: {EFFECTIVE_DATE}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.lead}>
          These Terms of Service ("Terms") govern your access to and use of the Rookie Markets
          mobile application and related services (collectively, the "App," "we," "our," or "us").
          By downloading, accessing, or using the App, you agree to be bound by these Terms. If
          you do not agree, do not use the App.
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {s.body.map((p, i) => (
              <Text key={i} style={styles.sectionBody}>{p}</Text>
            ))}
          </View>
        ))}

        <Text style={styles.acknowledge}>
          By using Rookie Markets, you acknowledge that you have read, understood, and agree to
          these Terms of Service.
        </Text>

        <View style={styles.privacyLinkBlock}>
          <TouchableOpacity onPress={() => Linking.openURL('https://capitalquest.co/privacy-policy.html')}>
            <Text style={styles.privacyLinkText}>Read our Privacy Policy →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAccepted((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>
            I have read and agree to the Terms of Service.
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

        <TouchableOpacity
          style={[styles.continueBtn, (!accepted || submitting) && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!accepted || submitting}
          activeOpacity={0.85}
        >
          {submitting
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
  headerBar: {
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
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  lead: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  sectionBody: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    lineHeight: 22,
    marginBottom: Spacing.xs,
  },
  acknowledge: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    lineHeight: 22,
    fontWeight: FontWeight.semibold,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  privacyLinkBlock: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  privacyLinkText: {
    color: Colors.brand.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  footer: {
    backgroundColor: Colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: FontWeight.extrabold,
    lineHeight: 18,
  },
  checkboxLabel: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  continueBtn: {
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: Colors.bg.tertiary,
    opacity: 0.6,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.extrabold,
  },
  errorText: {
    color: Colors.market.loss,
    fontSize: FontSize.sm,
  },
});
